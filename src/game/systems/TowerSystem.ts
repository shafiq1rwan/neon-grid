import Phaser from 'phaser';
import { COLORS, ECONOMY } from '../config';
import type { Vec2 } from '../data/maps';
import { TOWERS, type TowerType } from '../data/towers';
import type { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { sfx } from '../audio/SoundSystem';
import type { Effects } from '../rendering/EffectsRenderer';
import { rotateToward, wrapAngle } from '../utils/MathUtils';
import type { EnemySystem } from './EnemySystem';
import type { ProjectileSystem } from './ProjectileSystem';
import { Targeting } from './TargetingSystem';

const RETARGET_INTERVAL = 0.15;

export class TowerSystem {
  readonly towers: (Tower | null)[];
  private readonly muzzlePt = { x: 0, y: 0 };
  private readonly chainBuf: Enemy[] = [];
  private readonly frostBuf: Enemy[] = [];
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly platforms: readonly Vec2[],
    private readonly enemies: EnemySystem,
    private readonly projectiles: ProjectileSystem,
    private readonly effects: Effects,
  ) {
    this.towers = platforms.map(() => null);
  }

  at(platformIndex: number): Tower | null {
    return this.towers[platformIndex] ?? null;
  }

  build(platformIndex: number, type: TowerType): Tower {
    const p = this.platforms[platformIndex];
    const tower = new Tower(this.scene, TOWERS[type], platformIndex, p.x, p.y);
    this.towers[platformIndex] = tower;
    tower.pop();
    this.effects.ring(p.x, p.y, 46, tower.def.color, 420);
    this.effects.burst(p.x, p.y, tower.def.color, 12);
    this.effects.puff(p.x, p.y + 10, 4);
    sfx.play('place');
    return tower;
  }

  upgrade(tower: Tower): void {
    if (tower.level >= 3) return;
    tower.setLevel(tower.level + 1);
    tower.pop();
    const c = tower.def.color;
    this.effects.ring(tower.x, tower.y, 52, c, 500);
    this.effects.ring(tower.x, tower.y, 30, 0xffffff, 300);
    this.effects.burst(tower.x, tower.y - 10, c, 20);
    this.effects.flash(tower.x, tower.pivotY, c, 1.6, 260);
    this.effects.popup(tower.x, tower.y - 40, `LEVEL ${tower.level}`, '#ffffff');
    sfx.play('upgrade');
  }

  /** Returns the refund amount. */
  sell(tower: Tower): number {
    const refund = Math.floor(tower.invested * ECONOMY.sellRefund);
    this.towers[tower.platformIndex] = null;
    this.effects.puff(tower.x, tower.y, 5);
    this.effects.burst(tower.x, tower.y, tower.def.color, 10);
    tower.destroy();
    sfx.play('sell');
    return refund;
  }

  update(dt: number): void {
    this.time += dt;
    for (const t of this.towers) {
      if (!t) continue;
      this.updateTower(t, dt);
      t.updateVisuals(dt);
    }
  }

  private updateTower(t: Tower, dt: number): void {
    const stats = t.stats;
    const list = this.enemies.list;
    t.cooldown -= dt;
    t.retarget -= dt;

    // Validate the current target; beams keep their lock to preserve charge.
    if (t.target && !Targeting.inRange(t.target, t.x, t.y, stats.range)) t.target = null;
    if (!t.target || (t.retarget <= 0 && t.def.attack !== 'beam')) {
      t.retarget = RETARGET_INTERVAL;
      t.target = Targeting.first(list, t.x, t.y, stats.range);
    }

    const target = t.target;
    let aligned = false;
    if (target && t.def.turnRate > 0) {
      const desired = Math.atan2(target.y - t.pivotY, target.x - t.x);
      t.aim = rotateToward(t.aim, desired, t.def.turnRate * dt);
      aligned = Math.abs(wrapAngle(desired - t.aim)) < 0.2;
    } else if (!target && t.def.turnRate > 0) {
      // idle scan
      t.aim += Math.sin(t.idle * 0.7) * 0.25 * dt;
    }

    switch (t.def.attack) {
      case 'bolt':
      case 'shell':
      case 'missile':
        if (target && aligned && t.cooldown <= 0) {
          t.cooldown = stats.fireInterval;
          this.fireProjectile(t, target);
        }
        break;
      case 'chain':
        if (target && t.cooldown <= 0) {
          t.cooldown = stats.fireInterval;
          this.fireChain(t, target);
        }
        break;
      case 'beam':
        this.updateBeam(t, target, aligned, dt);
        break;
      case 'frost':
        if (target && t.cooldown <= 0) {
          t.cooldown = stats.fireInterval;
          this.fireFrost(t);
        }
        break;
    }
  }

  private fireProjectile(t: Tower, target: Enemy): void {
    const s = t.stats;
    const m = this.muzzlePt;
    const c = t.def.color;
    switch (t.def.attack) {
      case 'bolt':
        t.muzzle(m);
        this.projectiles.fire('bolt', m.x, m.y, t.aim, s.projectileSpeed ?? 600, target, s.damage, t.def);
        this.effects.flash(m.x, m.y, c, 0.45, 70);
        t.recoil = 0.35;
        sfx.play('pulse');
        break;
      case 'shell':
        t.muzzle(m, t.level === 3 ? (t.missileSide *= -1) * 7 : 0);
        this.projectiles.fire('shell', m.x, m.y, t.aim, s.projectileSpeed ?? 560, target, s.damage, t.def);
        this.effects.flash(m.x, m.y, c, 1.1, 120);
        this.effects.burst(m.x, m.y, c, 4);
        this.effects.puff(m.x, m.y, 1);
        t.recoil = 1;
        sfx.play('cannon');
        break;
      case 'missile': {
        t.missileSide *= -1;
        t.muzzle(m, t.missileSide * (4 + t.level * 2));
        const spread = t.missileSide * 0.35;
        this.projectiles.fire(
          'missile',
          m.x,
          m.y,
          t.aim + spread,
          s.projectileSpeed ?? 320,
          target,
          s.damage,
          t.def,
          s.splashRadius ?? 60,
        );
        this.effects.flash(m.x, m.y, c, 0.6, 90);
        this.effects.puff(m.x, m.y, 2);
        t.recoil = 0.5;
        sfx.play('missile');
        break;
      }
      default:
        break;
    }
  }

  private fireChain(t: Tower, first: Enemy): void {
    const s = t.stats;
    const chain = this.chainBuf;
    chain.length = 0;
    let fromX = t.x;
    let fromY = t.pivotY;
    let current: Enemy | null = first;
    let dmg = s.damage;
    const maxJumps = s.chainCount ?? 1;
    while (current && chain.length < maxJumps) {
      chain.push(current);
      const cx = current.x;
      const cy = current.y;
      this.effects.arc(fromX, fromY, cx, cy, COLORS.purple, chain.length === 1 ? 2.8 : 2);
      this.effects.flash(cx, cy, COLORS.purple, 0.6, 90);
      this.enemies.damage(current, dmg, t.def);
      dmg *= 0.85;
      fromX = cx;
      fromY = cy;
      current = Targeting.nearest(this.enemies.list, cx, cy, s.chainRange ?? 80, chain);
    }
    // little discharge sparks around the orb
    this.effects.burst(t.x, t.pivotY, COLORS.purple, 4);
    t.recoil = 1;
    sfx.play('tesla');
  }

  /** Frost pulse: chills and slows every machine in range. */
  private fireFrost(t: Tower): void {
    const s = t.stats;
    const hits = Targeting.within(this.enemies.list, t.x, t.y, s.range, this.frostBuf);
    for (const e of hits) {
      this.enemies.damage(e, s.damage, t.def);
      this.enemies.applySlow(e, s.slow ?? 0.3, s.slowDuration ?? 1.5);
    }
    this.effects.ring(t.x, t.y, s.range, t.def.color, 520);
    this.effects.burst(t.x, t.pivotY, t.def.color, 6);
    this.effects.burst(t.x, t.pivotY, 0xffffff, 3);
    t.recoil = 1;
    sfx.play('frost');
  }

  private updateBeam(t: Tower, target: Enemy | null, aligned: boolean, dt: number): void {
    const s = t.stats;
    const warmup = s.warmup ?? 0.6;
    if (!target) {
      t.charge = Math.max(0, t.charge - dt * 1.5);
      return;
    }
    if (aligned) {
      const before = t.charge;
      t.charge = Math.min(1, t.charge + dt / warmup);
      if (before === 0) sfx.play('charge');
      if (before < 1 && t.charge >= 1) sfx.play('laser');
    }
    const m = this.muzzlePt;
    t.muzzle(m);
    if (t.charge >= 1) {
      this.effects.beam(m.x, m.y, target.x, target.y, t.def.color, 1, this.time);
      this.enemies.damage(target, s.damage * dt, t.def, true);
      t.beamSfxTimer -= dt;
      if (t.beamSfxTimer <= 0) {
        t.beamSfxTimer = 0.18;
        this.effects.burst(target.x, target.y, t.def.color, 2);
      }
    } else if (aligned) {
      // thin aiming beam while charging
      this.effects.beam(m.x, m.y, target.x, target.y, t.def.color, t.charge * 0.25, this.time);
    }
  }

  clear(): void {
    for (let i = 0; i < this.towers.length; i++) {
      this.towers[i]?.destroy();
      this.towers[i] = null;
    }
  }
}
