import Phaser from 'phaser';
import { COLORS } from '../config';
import type { TowerDef } from '../data/towers';
import type { Enemy } from '../entities/Enemy';
import { Projectile, type ProjectileKind } from '../entities/Projectile';
import { sfx } from '../audio/SoundSystem';
import type { Effects } from '../rendering/EffectsRenderer';
import { ObjectPool } from '../utils/ObjectPool';
import { rotateToward } from '../utils/MathUtils';
import { Targeting } from './TargetingSystem';
import type { EnemySystem } from './EnemySystem';

export class ProjectileSystem {
  private readonly active: Projectile[] = [];
  private readonly pools: Record<ProjectileKind, ObjectPool<Projectile>>;
  private readonly splashBuf: Enemy[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly enemies: EnemySystem,
    private readonly effects: Effects,
  ) {
    const make = (kind: ProjectileKind) =>
      new ObjectPool(
        () => new Projectile(scene, kind),
        (p) => p.deactivate(),
      );
    this.pools = { bolt: make('bolt'), shell: make('shell'), missile: make('missile') };
  }

  fire(
    kind: ProjectileKind,
    x: number,
    y: number,
    angle: number,
    speed: number,
    target: Enemy,
    damage: number,
    source: TowerDef,
    splash = 0,
  ): void {
    const p = this.pools[kind].get();
    p.launch(x, y, angle, speed, target, damage, source, splash);
    this.active.push(p);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.ttl -= dt;
      if (p.target && p.target.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      } else {
        p.target = null;
      }

      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);

      if (p.kind === 'missile') {
        p.speed = Math.min(p.maxSpeed, p.speed + p.maxSpeed * 2.2 * dt);
        p.turnRate += dt * 6;
        p.angle = rotateToward(p.angle, desired, p.turnRate * dt);
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.02;
          this.effects.trail(p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, COLORS.orange);
        }
      } else {
        p.angle = desired;
      }

      const step = p.speed * dt;
      const hitR = p.target ? p.target.def.radius * 0.6 : 4;
      if (dist <= step + hitR || p.ttl <= 0) {
        this.impact(p);
        this.release(i);
        continue;
      }
      p.x += Math.cos(p.angle) * step;
      p.y += Math.sin(p.angle) * step;
      p.sprite.setPosition(p.x, p.y).setRotation(p.angle);
    }
  }

  private impact(p: Projectile): void {
    const src = p.source;
    if (!src) return;
    switch (p.kind) {
      case 'bolt':
        if (p.target) this.enemies.damage(p.target, p.damage, src);
        this.effects.burst(p.x, p.y, COLORS.cyan, 3);
        break;
      case 'shell':
        if (p.target) this.enemies.damage(p.target, p.damage, src);
        this.effects.flash(p.tx, p.ty, COLORS.pink, 0.9, 120);
        this.effects.burst(p.tx, p.ty, COLORS.pink, 8);
        break;
      case 'missile': {
        const hits = Targeting.within(this.enemies.list, p.tx, p.ty, p.splash, this.splashBuf);
        for (const e of hits) {
          const d = Math.hypot(e.x - p.tx, e.y - p.ty);
          const falloff = d < p.splash * 0.5 ? 1 : 0.6;
          this.enemies.damage(e, p.damage * falloff, src);
        }
        this.effects.explosion(p.tx, p.ty, p.splash, COLORS.orange);
        sfx.play('explosion');
        break;
      }
    }
  }

  private release(index: number): void {
    const p = this.active[index];
    this.active.splice(index, 1);
    this.pools[p.kind].release(p);
  }

  clear(): void {
    while (this.active.length) this.release(this.active.length - 1);
  }
}
