import Phaser from 'phaser';
import { DEPTH } from '../config';
import { totalInvestment, type TowerDef, type TowerLevel } from '../data/towers';
import {
  GUN_OFFSET_Y,
  TESLA_ANCHOR_Y,
  TESLA_TEX_H,
  baseKey,
  cryoCoreY,
  gunKey,
  teslaTopY,
} from '../rendering/TowerRenderer';
import type { Enemy } from './Enemy';

/** Distance from the weapon pivot to the muzzle at level 1. */
const MUZZLE: Record<string, number> = { pulse: 34, cannon: 36, missile: 18, laser: 36, tesla: 0, cryo: 0 };

export class Tower {
  readonly base: Phaser.GameObjects.Image;
  readonly gun: Phaser.GameObjects.Image | null = null;
  readonly gunShadow: Phaser.GameObjects.Image | null = null;
  readonly coreGlow: Phaser.GameObjects.Image;
  readonly orb: Phaser.GameObjects.Image | null = null;

  /** 1-based level. */
  level = 1;
  aim = -Math.PI / 2;
  cooldown = 0;
  target: Enemy | null = null;
  retarget = 0;
  recoil = 0;
  charge = 0;
  idle = Math.random() * 10;
  missileSide = 1;
  kills = 0;
  beamSfxTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: TowerDef,
    readonly platformIndex: number,
    readonly x: number,
    readonly y: number,
  ) {
    const depth = DEPTH.TOWER + y / 1000;
    this.base = scene.add.image(x, y, baseKey(def.type, 1)).setDepth(depth);
    if (def.type === 'tesla') {
      this.base.setOrigin(0.5, TESLA_ANCHOR_Y / TESLA_TEX_H);
      this.orb = scene.add
        .image(x, y + teslaTopY(1) - 6, 'tesla_orb')
        .setDepth(depth + 0.002)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.coreGlow = scene.add
        .image(x, y + teslaTopY(1) - 6, 'fx_glow')
        .setDepth(depth + 0.001)
        .setTint(def.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.2)
        .setAlpha(0.5);
    } else if (def.type === 'cryo') {
      // stationary emitter: glow sits on the frost crystal
      this.base.setOrigin(0.5, 0.5);
      this.coreGlow = scene.add
        .image(x, y + cryoCoreY(1), 'fx_glow')
        .setDepth(depth + 0.001)
        .setTint(def.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.8)
        .setAlpha(0.4);
    } else {
      this.base.setOrigin(0.5, 0.5);
      this.gunShadow = scene.add
        .image(x + 3, y + GUN_OFFSET_Y + 5, gunKey(def.type, 1))
        .setDepth(depth + 0.0005)
        .setTintFill(0x000000)
        .setAlpha(0.35);
      this.gun = scene.add.image(x, y + GUN_OFFSET_Y, gunKey(def.type, 1)).setDepth(depth + 0.001);
      this.coreGlow = scene.add
        .image(x, y + GUN_OFFSET_Y, 'fx_glow')
        .setDepth(depth + 0.002)
        .setTint(def.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.45)
        .setAlpha(0.35);
      this.gun.setRotation(this.aim);
      this.gunShadow.setRotation(this.aim);
    }
  }

  get stats(): TowerLevel {
    return this.def.levels[this.level - 1];
  }

  get nextStats(): TowerLevel | null {
    return this.level < 3 ? this.def.levels[this.level] : null;
  }

  get invested(): number {
    return totalInvestment(this.def, this.level - 1);
  }

  get pivotY(): number {
    if (this.def.type === 'tesla') return this.y + teslaTopY(this.level) - 6;
    if (this.def.type === 'cryo') return this.y + cryoCoreY(this.level);
    return this.y + GUN_OFFSET_Y;
  }

  /** World position of the muzzle / emitter. */
  muzzle(out: { x: number; y: number }, lateral = 0): void {
    if (this.def.type === 'tesla' || this.def.type === 'cryo') {
      out.x = this.x;
      out.y = this.pivotY;
      return;
    }
    const len = MUZZLE[this.def.type] * (1 + (this.level - 1) * 0.09) + (this.def.type === 'laser' ? (this.level - 1) * 4 : 0);
    const c = Math.cos(this.aim);
    const s = Math.sin(this.aim);
    out.x = this.x + c * len - s * lateral;
    out.y = this.y + GUN_OFFSET_Y + s * len + c * lateral;
  }

  setLevel(level: number): void {
    this.level = level;
    this.base.setTexture(baseKey(this.def.type, level));
    if (this.gun && this.gunShadow) {
      this.gun.setTexture(gunKey(this.def.type, level));
      this.gunShadow.setTexture(gunKey(this.def.type, level));
    }
  }

  /** Per-frame visual update (no allocations). */
  updateVisuals(dt: number): void {
    this.idle += dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    const pulse = 0.5 + 0.5 * Math.sin(this.idle * 3);
    if (this.gun && this.gunShadow) {
      const back = this.recoil * 6;
      const c = Math.cos(this.aim);
      const s = Math.sin(this.aim);
      const gx = this.x - c * back;
      const gy = this.y + GUN_OFFSET_Y - s * back;
      this.gun.setPosition(gx, gy).setRotation(this.aim);
      this.gunShadow.setPosition(gx + 3, gy + 5).setRotation(this.aim);
      this.coreGlow.setPosition(gx, gy);
      const charged = this.def.attack === 'beam' ? this.charge : 0;
      this.coreGlow.setAlpha(0.22 + pulse * 0.18 + this.recoil * 0.5 + charged * 0.4);
      this.coreGlow.setScale(0.4 + this.level * 0.05 + this.recoil * 0.25 + charged * 0.2);
    } else if (this.orb) {
      const top = this.y + teslaTopY(this.level) - 6 + Math.sin(this.idle * 2.2) * 1.5;
      this.orb.setPosition(this.x, top).setScale(0.85 + this.level * 0.08 + pulse * 0.08 + this.recoil * 0.3);
      this.coreGlow.setPosition(this.x, top).setAlpha(0.35 + pulse * 0.25 + this.recoil * 0.4);
      this.coreGlow.setScale(1 + this.level * 0.15 + this.recoil * 0.6);
    } else {
      // cryo: crystal shimmer, flaring on each frost pulse
      const top = this.pivotY + Math.sin(this.idle * 1.8) * 1;
      this.coreGlow.setPosition(this.x, top).setAlpha(0.3 + pulse * 0.2 + this.recoil * 0.5);
      this.coreGlow.setScale(0.7 + this.level * 0.12 + this.recoil * 0.8);
    }
  }

  /** Squash-and-stretch pop used when building and upgrading. */
  pop(): void {
    const targets: Phaser.GameObjects.Image[] = [this.base];
    if (this.gun) targets.push(this.gun);
    for (const t of targets) t.setScale(1);
    this.scene.tweens.add({
      targets,
      scaleX: { from: 0.7, to: 1 },
      scaleY: { from: 1.25, to: 1 },
      duration: 420,
      ease: 'Back.easeOut',
    });
  }

  destroy(): void {
    this.base.destroy();
    this.gun?.destroy();
    this.gunShadow?.destroy();
    this.coreGlow.destroy();
    this.orb?.destroy();
    this.target = null;
  }
}
