import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config';
import { ENEMIES, type EnemyType } from '../data/enemies';
import type { TowerDef } from '../data/towers';
import { Enemy } from '../entities/Enemy';
import { sfx } from '../audio/SoundSystem';
import type { Effects } from '../rendering/EffectsRenderer';
import { rotateToward, type PathData, type PathSample } from '../utils/MathUtils';

/** Icy tint for slowed machines. */
const FROST_TINT = 0xa6e9ff;
/** Damage multiplier against frost-slowed machines (Cryo Tower synergy). */
const FROST_BRITTLE = 1.15;

export interface EnemyCallbacks {
  onKilled(enemy: Enemy): void;
  onEscaped(enemy: Enemy): void;
}

export class EnemySystem {
  readonly list: Enemy[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
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
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowAmount = 0;
          if (e.flashTimer <= 0) e.sprite.clearTint();
        }
      }
      e.dist += e.def.speed * (1 - e.slowAmount) * dt;
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

      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        if (e.flashTimer <= 0) {
          if (e.slowAmount > 0) e.sprite.setTint(FROST_TINT);
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
      this.place(e, dt);
    }
    this.drawBars();
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
        scale = 1 + Math.sin(t * 14) * 0.012;
        break;
      case 'spawner':
        bob = Math.sin(t * 2) * 1.2;
        break;
      default:
        break;
    }
    const depth = DEPTH.ENEMY + e.y / 10000;
    e.sprite.setPosition(e.x, e.y + bob - 3).setRotation(e.angle).setScale(scale).setDepth(depth);
    e.shadow.setPosition(e.x + 3, e.y + 6);
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
      for (let k = 0; k < spawn.count; k++) {
        const d = Math.max(0, e.dist - 6 - k * 14);
        const child = this.spawn(spawn.type, hpScale, e.lane, d, (k - (spawn.count - 1) / 2) * 9);
        child.angle = e.angle;
      }
      this.effects.ring(e.x, e.y, 34, COLORS.red, 300);
      this.effects.burst(e.x, e.y, COLORS.red, 8);
      e.hatch?.setAlpha(0);
    }
  }

  /** Frost slow; bosses ignore part of it. Stronger slows replace weaker ones. */
  applySlow(e: Enemy, amount: number, duration: number): void {
    if (!e.alive) return;
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
  damage(e: Enemy, amount: number, source: TowerDef, continuous = false): boolean {
    if (!e.alive || amount <= 0) return false;
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
      if (!continuous || e.flashTimer <= 0) {
        e.sprite.setTintFill(0xffffff);
        e.flashTimer = continuous ? 0.03 : 0.06;
      }
      const heavy = e.def.type === 'juggernaut' || e.def.type === 'titan';
      if (heavy && !e.damagedLook && e.hp < e.maxHp * 0.5) {
        e.damagedLook = true;
        e.sprite.setTexture(`en_${e.def.type}_dmg`);
        this.effects.burst(e.x, e.y, e.def.color, 10);
        this.effects.puff(e.x, e.y, 3);
      } else if (heavy && !continuous) {
        this.effects.burst(e.x, e.y, e.def.color, 3);
      }
    }
    if (e.hp <= 0) {
      this.kill(e);
      return true;
    }
    return false;
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
    this.effects.burst(e.x, e.y, e.def.color, big ? 26 : 12);
    this.effects.burst(e.x, e.y, 0xffffff, big ? 8 : 3);
    this.effects.flash(e.x, e.y, e.def.color, big ? 1.6 : 0.8, 160);
    if (big) {
      this.effects.ring(e.x, e.y, 60, e.def.color, 450);
      this.effects.puff(e.x, e.y, 4);
      sfx.play('bigKill');
    } else {
      sfx.play('kill');
    }
    this.callbacks.onKilled(e);
    e.destroy();
  }

  private drawBars(): void {
    const g = this.bars;
    g.clear();
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive || !e.damaged) continue;
      const w = Math.max(18, Math.min(36, e.def.radius * 2));
      const x = e.x - w / 2;
      const y = e.y - e.def.radius - 12;
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
  }

  destroy(): void {
    this.clear();
    this.bars.destroy();
  }
}
