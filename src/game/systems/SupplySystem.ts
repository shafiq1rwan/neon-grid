import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config';
import type { MapDef } from '../data/maps';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import type { Effects } from '../rendering/EffectsRenderer';
import { bakeShape, text } from '../ui/widgets';
import type { PathData } from '../utils/MathUtils';

export type SupplyReward = { kind: 'credits'; amount: number } | { kind: 'hack' };

export interface SupplyCallbacks {
  /** Decide and pay the reward (GameScene owns the economy and hacking). */
  collect(x: number, y: number): SupplyReward;
}

/** Seconds a pod waits on the ground before it powers down. */
const LIFETIME = 12;
const POD_KEY = 'supply_pod';

/**
 * Supply drops: a glowing pod crashes onto empty ground after some waves and
 * pays a bonus when tapped. Fit-test finding (v1.2.3/1.2.4): about 38% of
 * players drifted away in waves 2–5 without losing, with nothing to do
 * between waves. This gives them a small, rewarding action in that gap.
 */
export class SupplySystem {
  private readonly spots: { x: number; y: number }[] = [];
  private pod: Phaser.GameObjects.Container | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private life = 0;
  private landed = false;
  private lastSpot = -1;
  /** Drops collected this run. */
  collected = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    map: MapDef,
    paths: PathData[],
    private readonly effects: Effects,
    private readonly callbacks: SupplyCallbacks,
  ) {
    bakeShape(scene, POD_KEY, 64, 64, (g) => {
      // hexagonal neon pod: dark shell, gold rim, cyan core
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        pts.push(new Phaser.Math.Vector2(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26));
      }
      g.fillStyle(0x000000, 0.4);
      g.fillCircle(33, 36, 27);
      g.fillStyle(0x19243a, 1);
      g.fillPoints(pts, true);
      g.lineStyle(3, COLORS.gold, 1);
      g.strokePoints(pts, true);
      g.lineStyle(1.5, COLORS.gold, 0.5);
      g.lineBetween(14, 32, 50, 32);
      g.fillStyle(COLORS.cyan, 1);
      g.fillCircle(32, 32, 8);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(30, 30, 3);
    });
    this.findSpots(map, paths);
  }

  /** Empty ground away from roads, platforms, the reactor, the beacon and the HUD. */
  private findSpots(map: MapDef, paths: PathData[]): void {
    const roadClear = map.roadWidth / 2 + 46;
    const samples: { x: number; y: number }[] = [];
    const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
    for (const path of paths) {
      let seg = 0;
      for (let d = 0; d < path.length; d += 24) {
        seg = path.sample(d, s, seg);
        samples.push({ x: s.x, y: s.y });
      }
    }
    const far = (x: number, y: number, px: number, py: number, r: number) => (x - px) ** 2 + (y - py) ** 2 > r * r;
    for (let y = 170; y <= 640; y += 40) {
      for (let x = 120; x <= 1160; x += 40) {
        if (x < 470 && y < 170) continue; // HUD panel + hack pill
        if (!samples.every((p) => far(x, y, p.x, p.y, roadClear))) continue;
        if (!map.platforms.every((p) => far(x, y, p.x, p.y, 72))) continue;
        if (!far(x, y, map.reactor.x, map.reactor.y, 130)) continue;
        if (!far(x, y, map.waveButton.x, map.waveButton.y, 100)) continue;
        this.spots.push({ x, y });
      }
    }
  }

  get active(): boolean {
    return this.pod !== null;
  }

  /** Drop a pod (ignored if one is already waiting or there's no free ground). */
  drop(): void {
    if (this.pod || this.spots.length === 0) return;
    let i = Math.floor(Math.random() * this.spots.length);
    if (i === this.lastSpot && this.spots.length > 1) i = (i + 1) % this.spots.length;
    this.lastSpot = i;
    const { x, y } = this.spots[i];
    const s = this.scene;
    this.glow = s.add.image(x, y, 'fx_glow').setTint(COLORS.gold).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.6).setAlpha(0).setDepth(DEPTH.PLATFORM_HINT);
    const img = s.add.image(0, 0, POD_KEY);
    const label = text(s, 0, -46, 'TAP!', 18, COLORS.gold, { stroke: '#05080f', strokeThickness: 5 }).setOrigin(0.5);
    const hit = s.add.zone(0, 0, 84, 84).setInteractive({ useHandCursor: true });
    const pod = s.add.container(x, y - 420, [img, label, hit]).setDepth(DEPTH.TOWER + 1);
    hit.on('pointerdown', () => this.collect());
    this.pod = pod;
    this.life = LIFETIME;
    this.landed = false;
    poki.measure('supply', 'drop', 'shown');
    // falls in, then lands with a thud
    s.tweens.add({
      targets: pod, y, duration: 520, ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.pod !== pod) return;
        this.landed = true;
        this.effects.ring(x, y + 10, 52, COLORS.gold, 420);
        this.effects.puff(x, y + 12, 4);
        this.scene.cameras.main.shake(80, 0.0018);
        sfx.play('place');
        s.tweens.add({ targets: this.glow, alpha: 0.55, duration: 260 });
        s.tweens.add({ targets: label, y: -54, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        s.tweens.add({ targets: img, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
  }

  /** Tick (world time): pods power down if ignored. */
  update(dt: number): void {
    if (!this.pod || !this.landed) return;
    this.life -= dt;
    if (this.life < 3) this.pod.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(this.life * 6)));
    if (this.life <= 0) {
      this.effects.puff(this.pod.x, this.pod.y, 3);
      this.clear();
    }
  }

  private collect(): void {
    const pod = this.pod;
    if (!pod) return;
    const { x, y } = pod;
    this.collected++;
    const reward = this.callbacks.collect(x, y);
    poki.measure('supply', reward.kind, 'collected');
    this.effects.ring(x, y, 70, reward.kind === 'hack' ? COLORS.cyan : COLORS.gold, 420);
    this.effects.burst(x, y, reward.kind === 'hack' ? COLORS.cyan : COLORS.gold, 18);
    this.effects.flash(x, y, COLORS.gold, 1.2, 160);
    sfx.play('coin');
    this.clear();
  }

  clear(): void {
    if (this.pod) {
      this.scene.tweens.killTweensOf(this.pod.list);
      this.scene.tweens.killTweensOf(this.pod);
      this.pod.destroy();
    }
    if (this.glow) {
      this.scene.tweens.killTweensOf(this.glow);
      this.glow.destroy();
    }
    this.pod = null;
    this.glow = null;
  }
}

/** Which waves (0-based, after they finish spawning) bring a supply drop. */
export function dropsAfterWave(mapIndex: number, endless: boolean, index: number): boolean {
  if (endless) return (index + 1) % 4 === 0;
  // Sector 1 is where players drift away: a drop after waves 1, 3, 5, 7 and 9
  if (mapIndex === 0) return index % 2 === 0 && index < 9;
  return (index + 1) % 3 === 0;
}
