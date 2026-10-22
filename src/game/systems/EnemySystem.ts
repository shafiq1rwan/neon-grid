import Phaser from 'phaser';
import { COLORS, DEPTH, HACK, WAVE_TIMING } from '../config';
import { ENEMIES, type EnemyType } from '../data/enemies';
import type { TowerDef } from '../data/towers';
import { Enemy } from '../entities/Enemy';
import { sfx } from '../audio/SoundSystem';
import type { Effects } from '../rendering/EffectsRenderer';
import { TANK_TEXTURES } from '../rendering/EnemyRenderer';
import { rotateToward, type PathData, type PathSample } from '../utils/MathUtils';
import { Targeting } from './TargetingSystem';

/** Icy tint for slowed machines. */
const FROST_TINT = 0xa6e9ff;
/** Damage multiplier against frost-slowed machines (Cryo Tower synergy). */
const FROST_BRITTLE = 1.15;
/** Tint for hacked machines. */
const HACK_TINT = 0x7ff6ff;

/** What a hit needs to know about its source (towers, hack blasts). */
export type DamageSource = Pick<TowerDef, 'shieldMultiplier' | 'piercing'>;
/** Hack blasts ignore armour and tear through shields. */
const HACK_BLAST: DamageSource = { shieldMultiplier: 2, piercing: true };
/** Hacked Specters detonate as an EMP that is brutal against shields. */
const HACK_EMP: DamageSource = { shieldMultiplier: 3, piercing: true };
/** Seconds a Burrower takes to dig in or out (purely visual). */
const SINK_TIME = 0.35;
/** A Burrower never digs in this close to the end of its road, so it surfaces before the reactor. */
const BURROW_END_MARGIN = 140;
/** Seconds the repair beams stay visible after a pulse. */
const HEAL_FX_TIME = 0.4;
/** Most beams one repair pulse draws (every machine in range is still repaired). */
const HEAL_MAX_LINKS = 6;

interface HealLink {
  medic: Enemy | null;
  target: Enemy | null;
  ttl: number;
}

export interface EnemyCallbacks {
  onKilled(enemy: Enemy): void;
  /** Several machines destroyed by one blast, splash or chain. */
  onCombo?(count: number, x: number, y: number): void;
  onEscaped(enemy: Enemy): void;
}

export class EnemySystem {
  readonly list: Enemy[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly blastBuf: Enemy[] = [];
  /** Repair beams (medic -> repaired machine), pooled and drawn on the shared Effects graphics. */
  private readonly healLinks: HealLink[] = [];
  private readonly s: PathSample = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
  private time = 0;
  kills = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly paths: PathData[],
    private readonly roadWidth: number,
    private readonly effects: Effects,
    private readonly callbacks: EnemyCallbacks,
  ) {
    this.bars = scene.add.graphics().setDepth(DEPTH.BARS);
  }

  get count(): number {
    return this.list.length;
  }

  spawn(type: EnemyType, hpScale: number, lane = 0, startDist = 0, offset?: number): Enemy {
    const def = ENEMIES[type];
    const spread = this.roadWidth * 0.22;
    const off = offset ?? (Math.random() * 2 - 1) * spread;
    const road = Math.min(lane, this.paths.length - 1);
    const e = new Enemy(this.scene, def, hpScale, startDist, off, road);
    e.seg = this.paths[road].sample(startDist, this.s, 0);
    e.x = this.s.x + this.s.nx * off;
    e.y = this.s.y + this.s.ny * off;
    e.angle = this.s.angle;
    this.place(e, 0);
    this.list.push(e);
    return e;
  }

  update(dt: number): void {
    this.time += dt;
    const s = this.s;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) {
        this.list.splice(i, 1);
        continue;
      }
      e.impactTimer = Math.max(0, e.impactTimer - dt);
      if (e.hacked) {
        // a hacked Repair Drone repairs nothing; a hacked Burrower stays on the surface
        this.updateHacked(e, dt);
        if (!e.alive) continue;
        if (e.def.spawn) this.updateSpawner(e, dt);
        if (e.def.type === 'juggernaut' || e.def.type === 'titan') this.updateTank(e, dt);
        this.place(e, dt);
        continue;
      }
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowAmount = 0;
          if (e.flashTimer <= 0) e.sprite.clearTint();
        }
      }
      const step = e.def.speed * (1 - e.slowAmount) * dt;
      e.dist += step;
      const path = this.paths[e.lane];
      if (e.dist >= path.length) {
        this.callbacks.onEscaped(e);
        e.destroy();
        this.list.splice(i, 1);
        continue;
      }
      e.seg = path.sample(e.dist, s, e.seg);
      e.x = s.x + s.nx * e.offset;
      e.y = s.y + s.ny * e.offset;
      e.angle = rotateToward(e.angle, s.angle, 7 * dt);

      if (e.beamFlashCooldown > 0) e.beamFlashCooldown -= dt;
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        if (e.flashTimer <= 0) {
          if (e.hacked) e.sprite.setTint(HACK_TINT);
          else if (e.slowAmount > 0) e.sprite.setTint(FROST_TINT);
          else e.sprite.clearTint();
        }
      }

      if (e.def.type === 'runner') {
        e.trailTimer -= dt;
        if (e.trailTimer <= 0) {
          e.trailTimer = 0.035;
          this.effects.trail(e.x - Math.cos(e.angle) * 12, e.y - Math.sin(e.angle) * 12, COLORS.teal);
        }
      }

      if (e.def.spawn) this.updateSpawner(e, dt);
      if (e.def.heal) this.updateMedic(e, dt);
      if (e.def.burrow) this.updateBurrow(e, dt, step, path.length);
      if (e.def.type === 'juggernaut' || e.def.type === 'titan') this.updateTank(e, dt);
      this.place(e, dt);
    }
    this.drawHealLinks(dt);
    this.drawBars();
  }

  /** Repair Drone: charge up, then pulse-repair nearby machines (see `EnemyDef.heal`). */
  private updateMedic(e: Enemy, dt: number): void {
    const heal = e.def.heal!;
    e.healTimer -= dt;
    const warn = 0.8;
    if (e.aura) {
      const k = e.healTimer < warn ? 1 - Math.max(0, e.healTimer) / warn : 0;
      e.aura.setAlpha(0.2 + k * 0.5).setScale((e.def.radius * 2.6 + k * 20) / 64);
    }
    if (e.healTimer > 0) return;
    const cap = heal.cap * (e.maxHp / e.def.hp);
    const r2 = heal.radius * heal.radius;
    let healed = 0;
    for (let j = 0; j < this.list.length; j++) {
      const o = this.list[j];
      if (o === e || !o.alive || o.hacked || o.burrowed || o.hp >= o.maxHp) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > r2) continue;
      o.hp = Math.min(o.maxHp, o.hp + Math.min(o.maxHp * heal.fraction, cap));
      // repaired above half health: tanks lose their battle-damage look (place() swaps the texture)
      if (o.damagedLook && o.hp >= o.maxHp * 0.5) o.damagedLook = false;
      this.effects.burst(o.x, o.y - 3, e.def.color, 3);
      if (healed < HEAL_MAX_LINKS) this.addHealLink(e, o);
      healed++;
    }
    if (healed === 0) {
      // nothing to repair yet: stay charged and check again shortly
      e.healTimer = 0.25;
      return;
    }
    e.healTimer = heal.interval;
    this.effects.ring(e.x, e.y, heal.radius, e.def.color, 520);
    this.effects.flash(e.x, e.y - 3, e.def.color, 1.1, 180);
    sfx.play('heal');
  }

  private addHealLink(medic: Enemy, target: Enemy): void {
    let link: HealLink | null = null;
    for (const l of this.healLinks) {
      if (l.ttl <= 0) {
        link = l;
        break;
      }
    }
    if (!link) {
      link = { medic: null, target: null, ttl: 0 };
      this.healLinks.push(link);
    }
    link.medic = medic;
    link.target = target;
    link.ttl = HEAL_FX_TIME;
  }

  /** Fading repair beams from each medic to the machines it just repaired. */
  private drawHealLinks(dt: number): void {
    const g = this.effects.gfx;
    for (const l of this.healLinks) {
      if (l.ttl <= 0) continue;
      l.ttl -= dt;
      const m = l.medic;
      const o = l.target;
      if (!m || !o || l.ttl <= 0 || !m.alive || !o.alive || m.hacked || o.burrowed) {
        l.ttl = 0;
        l.medic = null;
        l.target = null;
        continue;
      }
      const k = l.ttl / HEAL_FX_TIME;
      const c = m.def.color;
      g.lineStyle(8, c, 0.18 * k);
      g.lineBetween(m.x, m.y - 3, o.x, o.y - 3);
      g.lineStyle(2.4, c, 0.9 * k);
      g.lineBetween(m.x, m.y - 3, o.x, o.y - 3);
      g.fillStyle(0xffffff, 0.9 * k);
      g.fillCircle(o.x, o.y - 3, 2.5 + 3 * k);
    }
  }

  /**
   * Burrower: stays up for `burrow.surface` s, then digs in and travels
   * `burrow.distance` px underground. While burrowed it is skipped by every
   * targeting query (towers, splash, chains, frost, beams, hack picks and blasts)
   * and `damage` / `applySlow` ignore it.
   */
  private updateBurrow(e: Enemy, dt: number, step: number, roadLength: number): void {
    const b = e.def.burrow!;
    if (e.burrowed) {
      e.burrowLeft -= step;
      e.trailTimer -= dt;
      if (e.trailTimer <= 0) {
        // V-shaped dust wake behind the mound, alternating sides
        e.trailTimer = 0.05;
        e.wakeSide = -e.wakeSide;
        const c = Math.cos(e.angle);
        const sn = Math.sin(e.angle);
        const side = e.wakeSide * 9;
        this.effects.engineExhaust(e.x - c * 16 - sn * side, e.y - sn * 16 + c * side, false);
      }
      if (e.burrowLeft <= 0) {
        e.burrowed = false;
        e.surfaceTimer = b.surface;
        this.effects.puff(e.x, e.y, 3);
        this.effects.burst(e.x, e.y, e.def.color, 8);
        this.effects.ring(e.x, e.y, 32, e.def.color, 320);
      }
    } else if (e.sink <= 0) {
      e.surfaceTimer -= dt;
      // never dig in mid hack-lock, or so close to the reactor that it would leak unseen
      if (e.surfaceTimer <= 0 && !e.hackLock && e.dist + b.distance + BURROW_END_MARGIN < roadLength) {
        e.burrowed = true;
        e.burrowLeft = b.distance;
        sfx.play('burrow');
        e.slowAmount = 0;
        e.slowTimer = 0;
        e.flashTimer = 0;
        e.sprite.clearTint();
        this.effects.puff(e.x, e.y, 3);
        this.effects.burst(e.x, e.y, e.def.color, 6);
      }
    }
    const want = e.burrowed ? 1 : 0;
    if (e.sink !== want) {
      e.sink = want > e.sink ? Math.min(1, e.sink + dt / SINK_TIME) : Math.max(0, e.sink - dt / SINK_TIME);
    }
  }

  private updateTank(e: Enemy, dt: number): void {
    const size = e.def.type === 'titan' ? 1.6 : 1;
    const rearX = e.x - Math.cos(e.angle) * 22 * size;
    const rearY = e.y - 3 - Math.sin(e.angle) * 22 * size;
    e.exhaustTimer -= dt;
    if (e.exhaustTimer <= 0) {
      e.exhaustTimer = 0.24;
      this.effects.engineExhaust(rearX, rearY, false);
    }
    if (e.damagedLook) {
      e.damageSmokeTimer -= dt;
      if (e.damageSmokeTimer <= 0) {
        e.damageSmokeTimer = e.hp < e.maxHp * 0.25 ? 0.16 : 0.32;
        this.effects.engineExhaust(rearX, rearY, true);
      }
    }
  }

  private place(e: Enemy, _dt: number): void {
    const t = this.time + e.phase;
    let bob = 0;
    let scale = 1;
    switch (e.def.type) {
      case 'drone':
      case 'mini':
        bob = Math.sin(t * 6) * 1.5;
        scale = 1 + Math.sin(t * 12) * 0.03;
        break;
      case 'specter':
        bob = Math.sin(t * 3) * 2.5;
        break;
      case 'juggernaut':
      case 'titan': {
        const size = e.def.type === 'titan' ? 1.6 : 1;
        const frame = Math.floor(e.dist / (1.5 * size)) % 4;
        const key = TANK_TEXTURES[e.def.type][e.damagedLook ? 1 : 0][frame];
        if (e.sprite.texture.key !== key) e.sprite.setTexture(key);
        bob = Math.sin(e.dist * 0.4 / size) * 0.35;
        break;
      }
      case 'spawner':
        bob = Math.sin(t * 2) * 1.2;
        break;
      case 'medic':
        bob = Math.sin(t * 3.5) * 2;
        break;
      case 'burrower':
        // digging in: shrinks and sinks below the road
        scale = 1 - e.sink * 0.55;
        bob = e.sink * 6;
        break;
      default:
        break;
    }
    const depth = DEPTH.ENEMY + e.y / 10000;
    let jx = 0;
    let jy = 0;
    if (e.glitchTimer > 0) {
      // digital glitch: jitter and flicker between white and cyan
      jx = (Math.random() - 0.5) * 6;
      jy = (Math.random() - 0.5) * 4;
      // light-cyan flashes rather than pure white, so big tanks don't become white blocks
      if (Math.random() < 0.35) e.sprite.setTintFill(0xc8fbff);
      else e.sprite.setTint(HACK_TINT);
    }
    e.sprite.setPosition(e.x + jx, e.y + bob - 3 + jy).setRotation(e.angle).setScale(scale).setDepth(depth);
    if (e.hackGlow) {
      e.hackGlow
        .setPosition(e.x, e.y - 3)
        .setAlpha(0.45 + Math.sin(t * 6) * 0.12)
        .setDepth(depth - 0.0001);
    }
    if (e.hackMark) {
      e.hackMark
        .setPosition(e.x, e.y - e.def.radius - 16 + Math.sin(t * 5) * 2)
        .setRotation(Math.sin(t * 3) * 0.2)
        .setAlpha(0.75 + Math.sin(t * 9) * 0.25)
        .setDepth(depth + 0.0002);
    }
    e.shadow.setPosition(e.x + 3, e.y + 6);
    if (e.mound) {
      const under = e.sink;
      e.sprite.setAlpha(1 - under * 0.95);
      e.shadow.setAlpha(1 - under);
      e.mound
        .setVisible(under > 0)
        .setPosition(e.x, e.y)
        .setRotation(e.angle)
        .setAlpha(under)
        .setScale(0.9 + under * 0.2 + Math.sin(t * 14) * 0.04 * under);
    }
    if (e.aura) e.aura.setPosition(e.x, e.y + bob - 3).setDepth(depth - 0.0002);
    if (e.shieldSprite) {
      e.shieldSprite
        .setPosition(e.x, e.y + bob - 3)
        .setRotation(t * 0.6)
        .setAlpha(0.65 + Math.sin(t * 5) * 0.15)
        .setDepth(depth + 0.0001);
    }
    if (e.hatch) e.hatch.setPosition(e.x, e.y + bob - 3).setRotation(e.angle).setDepth(depth + 0.0001);
  }

  private updateSpawner(e: Enemy, dt: number): void {
    const spawn = e.def.spawn!;
    e.spawnTimer -= dt;
    const warn = 0.9;
    if (e.hatch) {
      const k = e.spawnTimer < warn ? 1 - e.spawnTimer / warn : 0;
      e.hatch.setAlpha(k).setScale(0.8 + k * 0.5);
    }
    if (e.spawnTimer <= 0) {
      e.spawnTimer = spawn.interval;
      const hpScale = e.maxHp / e.def.hp;
      const color = e.hacked ? COLORS.cyan : COLORS.red;
      for (let k = 0; k < spawn.count; k++) {
        // hacked spawners walk backwards, so "behind" them is further along the road
        const d = e.hacked ? e.dist + 8 + k * 14 : Math.max(0, e.dist - 6 - k * 14);
        const child = this.spawn(spawn.type, hpScale, e.lane, d, (k - (spawn.count - 1) / 2) * 9);
        child.angle = e.angle;
        if (e.hacked) this.hack(child, e.hackPerfect, e.hackTimer);
      }
      this.effects.ring(e.x, e.y, 34, color, 300);
      this.effects.burst(e.x, e.y, color, 8);
      e.hatch?.setAlpha(0);
    }
  }

  /** Frost slow; bosses ignore part of it. Stronger slows replace weaker ones. */
  applySlow(e: Enemy, amount: number, duration: number): void {
    if (!e.alive || e.hacked || e.burrowed) return;
    const effective = amount * (1 - (e.def.slowResist ?? 0));
    if (effective >= e.slowAmount || e.slowTimer < duration * 0.5) {
      e.slowAmount = Math.max(effective, e.slowTimer > 0 ? e.slowAmount : 0);
      e.slowTimer = duration;
    }
    if (e.flashTimer <= 0) e.sprite.setTint(FROST_TINT);
  }

  /**
   * Apply damage. Shields absorb first (scaled by the source's shield
   * multiplier); armour reduces non-piercing hits. Returns true on kill.
   */
  damage(e: Enemy, amount: number, source: DamageSource, continuous = false): boolean {
    // burrowed machines are underground: shots already in flight hit the dirt
    if (!e.alive || e.hacked || e.burrowed || amount <= 0) return false;
    // frozen machines are brittle: every tower deals extra damage to them
    let dmg = e.slowTimer > 0 ? amount * FROST_BRITTLE : amount;
    if (e.shield > 0) {
      const sd = dmg * source.shieldMultiplier;
      if (sd >= e.shield) {
        dmg = (sd - e.shield) / source.shieldMultiplier;
        e.shield = 0;
        this.breakShield(e);
      } else {
        e.shield -= sd;
        dmg = 0;
        if (!continuous && e.shieldSprite) e.shieldSprite.setAlpha(1);
      }
    }
    if (dmg > 0) {
      if (!source.piercing && e.def.armor > 0 && !continuous) {
        dmg = Math.max(dmg - e.def.armor, dmg * 0.25);
      }
      e.hp -= dmg;
      // beams pulse the flash (~5x a second) instead of holding it every frame
      if (!continuous || e.beamFlashCooldown <= 0) {
        e.sprite.setTintFill(0xffffff);
        e.flashTimer = continuous ? 0.04 : 0.06;
        if (continuous) e.beamFlashCooldown = 0.2;
      }
      const heavy = e.def.type === 'juggernaut' || e.def.type === 'titan';
      if (heavy && !e.damagedLook && e.hp < e.maxHp * 0.5) {
        e.damagedLook = true;
        e.sprite.setTexture(`en_${e.def.type}_dmg`);
        this.effects.burst(e.x, e.y, e.def.color, 10);
        this.effects.puff(e.x, e.y, 3);
      }
      if (heavy && e.hp > 0 && e.impactTimer <= 0) {
        e.impactTimer = continuous ? 0.14 : 0.07;
        this.effects.armorHit(e.x, e.y - 3, source.piercing);
      }
    }
    if (e.hp <= 0) {
      this.kill(e);
      return true;
    }
    return false;
  }

  /**
   * Turn a machine to our side: it walks back down the road and detonates
   * when it touches the horde (see docs/GAME_DESIGN.md → Hacking). `duration` lets hacked
   * spawners pass their remaining time to their swarmlings.
   */
  hack(e: Enemy, perfect: boolean, duration?: number): void {
    if (!e.alive || e.hacked) return;
    e.hacked = true;
    e.hackPerfect = perfect;
    e.hackTimer = duration ?? HACK.duration + (perfect ? HACK.perfectBonusDuration : 0);
    e.glitchTimer = duration === undefined ? 0.32 : 0.12;
    e.slowAmount = 0;
    e.slowTimer = 0;
    e.flashTimer = 0;
    e.sprite.setTint(HACK_TINT);
    e.shieldSprite?.setTint(HACK_TINT);
    e.hatch?.setTint(HACK_TINT);
    e.aura?.setAlpha(0);
    e.hackLock = false;
    if (e.burrowed || e.sink > 0) {
      // defensive only (hack picks skip burrowed machines): pop it back up
      e.burrowed = false;
      e.sink = 0;
      e.sprite.setAlpha(1);
      e.shadow.setAlpha(1);
      e.mound?.setVisible(false);
    }
    e.hackMark = this.scene.add.image(e.x, e.y, 'hack_mark').setBlendMode(Phaser.BlendModes.ADD);
    e.hackGlow = this.scene.add
      .image(e.x, e.y, 'fx_glow')
      .setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((e.def.radius * 3.4) / 64);
  }

  private updateHacked(e: Enemy, dt: number): void {
    e.hackTimer -= dt;
    if (e.glitchTimer > 0) {
      e.glitchTimer -= dt;
      if (e.glitchTimer <= 0) e.sprite.setTint(HACK_TINT);
    }
    e.dist -= e.def.speed * dt;
    if (e.hackTimer <= 0 || e.dist <= 0) {
      this.shortCircuit(e);
      return;
    }
    const s = this.s;
    // sampling backwards: restart the segment search from the beginning
    e.seg = this.paths[e.lane].sample(e.dist, s, 0);
    e.x = s.x + s.nx * e.offset;
    e.y = s.y + s.ny * e.offset;
    e.angle = rotateToward(e.angle, s.angle + Math.PI, 9 * dt);

    e.trailTimer -= dt;
    if (e.trailTimer <= 0) {
      e.trailTimer = 0.05;
      this.effects.trail(e.x - Math.cos(e.angle) * e.def.radius, e.y - Math.sin(e.angle) * e.def.radius, COLORS.cyan);
    }

    // contact with any machine still on the enemy side?
    for (let j = 0; j < this.list.length; j++) {
      const o = this.list[j];
      if (!o.alive || o.hacked || o.burrowed) continue;
      const r = e.def.radius + o.def.radius + HACK.contactPad;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy <= r * r) {
        this.detonate(e);
        return;
      }
    }
  }

  /** Report a combo if one blast / splash / chain (started at `before` kills) destroyed several machines. */
  comboFrom(before: number, x: number, y: number): void {
    const n = this.kills - before;
    if (n >= WAVE_TIMING.comboMin) this.callbacks.onCombo?.(n, x, y);
  }

  /** Hacked machine blows up in the horde: big area damage, no armour, 2x vs shields. */
  private detonate(e: Enemy): void {
    const hpScale = e.maxHp / e.def.hp;
    const heavy = e.def.type === 'juggernaut' || e.def.type === 'titan';
    let damage = Math.min(e.maxHp * HACK.blastHpMult, HACK.blastCap * hpScale);
    let radius = HACK.blastRadius * (heavy ? 1.3 : e.def.type === 'mini' ? 0.7 : 1);
    if (e.hackPerfect) {
      damage *= HACK.perfectDamage;
      radius *= HACK.perfectRadius;
    }
    const source = e.def.type === 'specter' ? HACK_EMP : HACK_BLAST;
    const x = e.x;
    const y = e.y;
    e.alive = false;
    e.destroy();
    const before = this.kills;
    const hits = Targeting.within(this.list, x, y, radius, this.blastBuf);
    for (const o of hits) {
      const d = Math.hypot(o.x - x, o.y - y);
      this.damage(o, damage * (d < radius * 0.5 ? 1 : 0.65), source);
    }
    this.comboFrom(before, x, y);
    this.effects.hackBlast(x, y, radius, e.hackPerfect);
    this.scene.cameras.main.shake(e.hackPerfect ? 180 : 110, e.hackPerfect ? 0.006 : 0.0035);
    sfx.play('hackBlast');
  }

  /** Hacked machine ran out of time or reached the entrance: a harmless pop. */
  private shortCircuit(e: Enemy): void {
    this.effects.burst(e.x, e.y, COLORS.cyan, 8);
    this.effects.flash(e.x, e.y, COLORS.cyan, 0.6, 140);
    e.alive = false;
    e.destroy();
  }

  private breakShield(e: Enemy): void {
    if (!e.shieldSprite) return;
    const img = e.shieldSprite;
    e.shieldSprite = null;
    this.scene.tweens.add({
      targets: img,
      scale: img.scale * 1.6,
      alpha: 0,
      duration: 260,
      onComplete: () => img.destroy(),
    });
    this.effects.burst(e.x, e.y, COLORS.purple, 14);
    this.effects.ring(e.x, e.y, 30, COLORS.purple, 300);
    sfx.play('shieldBreak');
  }

  private kill(e: Enemy): void {
    e.alive = false;
    this.kills++;
    const big = e.def.radius >= 18;
    const tank = e.def.type === 'juggernaut' || e.def.type === 'titan';
    if (tank) {
      this.effects.tankDestruction(e.x, e.y, e.def.color, e.def.type === 'titan');
    } else {
      this.effects.burst(e.x, e.y, e.def.color, big ? 26 : 12);
      this.effects.burst(e.x, e.y, 0xffffff, big ? 8 : 3);
      this.effects.flash(e.x, e.y, e.def.color, big ? 1.6 : 0.8, 160);
      if (big) {
        this.effects.ring(e.x, e.y, 60, e.def.color, 450);
        this.effects.puff(e.x, e.y, 4);
      }
    }
    // a little kick when something big goes down
    if (big) this.scene.cameras.main.shake(90, 0.0025);
    sfx.play(big ? 'bigKill' : 'kill');
    this.callbacks.onKilled(e);
    e.destroy();
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive || e.burrowed) continue;
      const w = Math.max(18, Math.min(36, e.def.radius * 2));
      const x = e.x - w / 2;
      const y = e.y - e.def.radius - 12;
      if (e.hacked) {
        // fuse: time left before the hacked machine short-circuits
        const total = HACK.duration + (e.hackPerfect ? HACK.perfectBonusDuration : 0);
        g.fillStyle(0x05080f, 0.85);
        g.fillRect(x - 1, y - 1, w + 2, 5);
        g.fillStyle(COLORS.cyan, 1);
        g.fillRect(x, y, w * Math.max(0, e.hackTimer / total), 3);
        continue;
      }
      if (!e.damaged) continue;
      g.fillStyle(0x05080f, 0.85);
      g.fillRect(x - 1, y - 1, w + 2, 5);
      const hpK = Math.max(0, e.hp / e.maxHp);
      g.fillStyle(hpK > 0.5 ? 0x4dff88 : hpK > 0.25 ? 0xffd34d : 0xff526f, 1);
      g.fillRect(x, y, w * hpK, 3);
      if (e.maxShield > 0 && e.shield > 0) {
        g.fillStyle(0x05080f, 0.85);
        g.fillRect(x - 1, y - 5, w + 2, 4);
        g.fillStyle(0xa78bfa, 1);
        g.fillRect(x, y - 4, w * (e.shield / e.maxShield), 2);
      }
    }
  }

  /** Remove every enemy without rewards (used by revive / restart). */
  clear(withFx = false): void {
    for (const e of this.list) {
      if (withFx && e.alive) {
        this.effects.burst(e.x, e.y, e.def.color, 8);
        this.effects.flash(e.x, e.y, 0xffffff, 0.8, 200);
      }
      e.destroy();
    }
    this.list.length = 0;
    for (const l of this.healLinks) {
      l.ttl = 0;
      l.medic = null;
      l.target = null;
    }
  }

  destroy(): void {
    this.clear();
    this.bars.destroy();
  }
}
