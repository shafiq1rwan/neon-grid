import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { TowerDef } from '../data/towers';
import type { Enemy } from './Enemy';

export type ProjectileKind = 'bolt' | 'shell' | 'missile';

export const PROJECTILE_TEXTURE: Record<ProjectileKind, string> = {
  bolt: 'proj_bolt',
  shell: 'proj_shell',
  missile: 'proj_missile',
};

/** Pooled projectile. Fields are reset by `launch` on reuse. */
export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  active = false;
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;
  maxSpeed = 0;
  target: Enemy | null = null;
  tx = 0;
  ty = 0;
  damage = 0;
  splash = 0;
  turnRate = 0;
  ttl = 0;
  trailTimer = 0;
  source: TowerDef | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly kind: ProjectileKind,
  ) {
    this.sprite = scene.add
      .image(0, 0, PROJECTILE_TEXTURE[kind])
      .setDepth(DEPTH.PROJECTILE)
      .setVisible(false);
    if (kind !== 'missile') this.sprite.setBlendMode(Phaser.BlendModes.ADD);
    if (kind === 'missile') this.sprite.setOrigin(0.7, 0.5);
  }

  launch(
    x: number,
    y: number,
    angle: number,
    speed: number,
    target: Enemy,
    damage: number,
    source: TowerDef,
    splash = 0,
  ): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.maxSpeed = speed;
    this.speed = this.kind === 'missile' ? speed * 0.35 : speed;
    this.target = target;
    this.tx = target.x;
    this.ty = target.y;
    this.damage = damage;
    this.source = source;
    this.splash = splash;
    this.turnRate = this.kind === 'missile' ? 6 : 0;
    this.ttl = 3;
    this.trailTimer = 0;
    this.sprite.setPosition(x, y).setRotation(angle).setVisible(true).setAlpha(1);
  }

  deactivate(): void {
    this.active = false;
    this.target = null;
    this.source = null;
    this.sprite.setVisible(false);
  }
}
