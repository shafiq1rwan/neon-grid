import Phaser from 'phaser';
import { COLORS, DEPTH, FONT, HACK } from '../config';
import type { Vec2 } from '../data/maps';
import type { Enemy } from '../entities/Enemy';
import { sfx } from '../audio/SoundSystem';
import type { Effects } from '../rendering/EffectsRenderer';
import type { EnemySystem } from './EnemySystem';
import { viewBounds } from '../utils/View';

export type HackOutcome = 'perfect' | 'good';

export interface HackCallbacks {
  onCharge(charges: number): void;
  onDenied(reason: 'charge' | 'firewall'): void;
  onLockStart(): void;
  onHacked(outcome: HackOutcome): void;
}

/** How far outside the target ring the lock-on ring starts. */
const RING_TRAVEL = 74;

/**
 * Signature mechanic: tap a machine to start a timing lock. A ring closes in
 * while the world drops into bullet time; tapping again inside the bright
 * window is a PERFECT hack (bigger blast). Ignoring it still hacks normally.
 */
export class HackSystem {
  charges: number = HACK.startCharges;
  killProgress = 0;
  target: Enemy | null = null;
  /** Real seconds since the current lock started. */
  progress = 0;
  /** World-speed multiplier, easing toward bullet time while locking. */
  warp = 1;
  /** Charges spent on the current lock (refunded if it fails). */
  private lockCost = 1;
  /** Real seconds left in which stray taps are swallowed after a hack resolves. */
  private tapGuard = 0;
  private t = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly tapText: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: EnemySystem,
    private readonly effects: Effects,
    private readonly reactor: Vec2,
    private readonly callbacks: HackCallbacks,
  ) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.EFFECT + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.tapText = scene.add
      .text(0, 0, 'TAP!', {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#00a7c2',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.FLOAT + 1)
      .setVisible(false);
    // bullet-time wash over the battlefield (screen space)
    this.overlay = scene.add
      .rectangle(-2000, -2000, 6000, 5000, COLORS.cyan, 1)
      .setOrigin(0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.EFFECT - 2)
      .setAlpha(0);
  }

  get locking(): boolean {
    return this.target !== null;
  }

  /** True while a second tap would be a PERFECT hack. */
  get inPerfectWindow(): boolean {
    if (!this.target) return false;
    const k = this.progress / HACK.lockTime;
    return k >= HACK.perfectFrom && this.progress <= HACK.lockTime + HACK.perfectGrace;
  }

  /** Progress toward the next charge, 0..1 (1 when full). */
  get chargeFraction(): number {
    return this.charges >= HACK.maxCharges ? 1 : this.killProgress / HACK.killsPerCharge;
  }

  onKill(): void {
    if (this.charges >= HACK.maxCharges) return;
    this.killProgress++;
    if (this.killProgress >= HACK.killsPerCharge) {
      this.killProgress = 0;
      this.addCharge();
    }
  }

  onWaveStart(index: number): void {
    // the first wave is covered by the starting charge; then every third wave
    if (index > 0 && index % 3 === 0) this.addCharge();
  }

  /** Give a charge from outside (supply drops). Returns false when already full. */
  grantCharge(): boolean {
    if (this.charges >= HACK.maxCharges) return false;
    this.addCharge();
    return true;
  }

  private addCharge(): void {
    if (this.charges >= HACK.maxCharges) return;
    this.charges++;
    sfx.play('hackCharge');
    this.callbacks.onCharge(this.charges);
  }

  /** Handle a tap at a world point. Returns true when the tap was used by hacking. */
  tap(x: number, y: number): boolean {
    if (this.target) {
      this.resolve(true);
      return true;
    }
    // a late "perfect" tap right after an auto-resolve must not open a build menu
    if (this.tapGuard > 0) return true;
    const e = this.pick(x, y);
    if (!e) return false;
    if (e.def.type === 'titan') {
      this.effects.ring(e.x, e.y, 70, COLORS.red, 380);
      this.effects.popup(e.x, e.y - 40, 'FIREWALL', '#ff526f');
      sfx.play('hackDeny');
      this.callbacks.onDenied('firewall');
      return true;
    }
    const cost = this.costOf(e);
    if (this.charges < cost) {
      this.effects.ring(e.x, e.y, 40, COLORS.red, 260);
      this.effects.popup(e.x, e.y - 30, cost > 1 ? `NEEDS ${cost} CHARGES` : 'NO CHARGE', '#ff9b32');
      sfx.play('hackDeny');
      this.callbacks.onDenied('charge');
      return true;
    }
    this.startLock(e);
    return true;
  }

  /** Charges needed to hack a machine (Juggernauts cost more). */
  costOf(e: Enemy): number {
    return e.def.type === 'juggernaut' ? HACK.heavyCost : 1;
  }

  /** Machine under a world point (generous radius for fingers). */
  pick(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies.list) {
      // burrowed machines are underground: nothing to tap
      if (!e.alive || e.hacked || e.burrowed) continue;
      const r = Math.max(28, e.def.radius * 1.6);
      const d = (e.x - x) ** 2 + (e.y - 3 - y) ** 2;
      if (d <= r * r && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Start locking onto a machine (also used by the balance bot). */
  startLock(e: Enemy): void {
    const cost = this.costOf(e);
    if (this.target || this.charges < cost || !e.alive || e.hacked || e.burrowed || e.def.type === 'titan') return;
    this.charges -= cost;
    this.lockCost = cost;
    this.target = e;
    // pins a Burrower to the surface until the lock resolves
    e.hackLock = true;
    this.progress = 0;
    this.effects.ring(e.x, e.y, 46, COLORS.cyan, 260);
    sfx.play('hackLock');
    this.callbacks.onLockStart();
  }

  /** Finish the lock. A tap inside the window is PERFECT; otherwise a normal hack. */
  resolve(tapped: boolean): void {
    const e = this.target;
    if (!e) return;
    const perfect = tapped && this.inPerfectWindow;
    this.target = null;
    e.hackLock = false;
    if (!tapped) this.tapGuard = 0.4;
    if (!e.alive || e.hacked || e.burrowed) {
      this.charges = Math.min(HACK.maxCharges, this.charges + this.lockCost);
      return;
    }
    this.enemies.hack(e, perfect);

    // upload zaps from the reactor, then the hit
    const r = this.reactor;
    this.effects.arc(r.x, r.y, e.x, e.y, COLORS.cyan, 3.2, 0.28);
    this.effects.arc(r.x, r.y, e.x, e.y, 0xffffff, 1.6, 0.18);
    this.effects.ring(e.x, e.y, 54, COLORS.cyan, 360);
    this.effects.burst(e.x, e.y, COLORS.cyan, 16);
    this.effects.burst(e.x, e.y, 0xffffff, 6);
    if (perfect) {
      this.effects.ring(e.x, e.y, 120, 0xffffff, 520);
      this.effects.flash(e.x, e.y, COLORS.cyan, 2.4, 240);
      this.bigText(e.x, e.y - 50, 'PERFECT HACK!');
      this.scene.cameras.main.flash(140, 40, 150, 170);
      this.scene.cameras.main.shake(140, 0.004);
      sfx.play('hackPerfect');
    } else {
      this.effects.popup(e.x, e.y - 34, 'HACKED', '#7ff6ff');
      sfx.play('hack');
    }
    this.callbacks.onHacked(perfect ? 'perfect' : 'good');
  }

  /** Drop any lock (game over / restart) and refund its charge. */
  cancel(): void {
    if (!this.target) return;
    this.target.hackLock = false;
    this.target = null;
    this.charges = Math.min(HACK.maxCharges, this.charges + this.lockCost);
  }

  /** Per-frame update in REAL seconds (the lock ignores game speed and bullet time). */
  update(realDt: number): void {
    this.t += realDt;
    this.tapGuard = Math.max(0, this.tapGuard - realDt);
    const want = this.target ? HACK.timeWarp : 1;
    this.warp += (want - this.warp) * Math.min(1, realDt * 12);
    if (Math.abs(this.warp - want) < 0.005) this.warp = want;
    this.overlay.setAlpha(((1 - this.warp) / (1 - HACK.timeWarp)) * 0.07);

    const e = this.target;
    if (e) {
      if (!e.alive || e.hacked || e.burrowed) {
        this.cancel();
      } else {
        this.progress += realDt;
        if (this.progress >= HACK.lockTime + HACK.perfectGrace) this.resolve(false);
      }
    }
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const e = this.target;
    if (!e) {
      this.tapText.setVisible(false);
      return;
    }
    const k = Phaser.Math.Clamp(this.progress / HACK.lockTime, 0, 1);
    const inner = e.def.radius + 12;
    const band = RING_TRAVEL * (1 - HACK.perfectFrom);
    const perfect = this.inPerfectWindow;
    const radius = inner + RING_TRAVEL * (1 - k);
    const cx = e.x;
    const cy = e.y - 3;

    // data beam from the reactor with packets streaming toward the target
    const r = this.reactor;
    g.lineStyle(2, COLORS.cyan, 0.3);
    g.lineBetween(r.x, r.y, cx, cy);
    for (let i = 0; i < 7; i++) {
      const f = (this.t * 1.6 + i / 7) % 1;
      g.fillStyle(i % 2 ? 0xffffff : COLORS.cyan, 0.9);
      g.fillCircle(r.x + (cx - r.x) * f, r.y + (cy - r.y) * f, 2.6);
    }

    // perfect band: where the closing ring must be when you tap
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 30);
    g.lineStyle(band, perfect ? 0xffffff : COLORS.cyan, perfect ? 0.32 + pulse * 0.25 : 0.14);
    g.strokeCircle(cx, cy, inner + band / 2);
    g.lineStyle(2, perfect ? 0xffffff : COLORS.cyan, 0.9);
    g.strokeCircle(cx, cy, inner);

    // closing lock-on ring with a soft glow
    g.lineStyle(10, COLORS.cyan, 0.16);
    g.strokeCircle(cx, cy, radius);
    g.lineStyle(3.5, perfect ? 0xffffff : COLORS.cyan, 1);
    g.strokeCircle(cx, cy, radius);

    // rotating reticle brackets
    const spin = this.t * 4;
    g.lineStyle(3, COLORS.cyan, 0.95);
    for (let q = 0; q < 4; q++) {
      const a = spin + (q * Math.PI) / 2;
      g.beginPath();
      g.arc(cx, cy, radius + 9, a - 0.28, a + 0.28);
      g.strokePath();
    }
    // crosshair ticks
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2 - spin * 0.5;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.lineBetween(cx + c * (inner - 8), cy + s * (inner - 8), cx + c * (inner + 4), cy + s * (inner + 4));
    }

    // above the reticle, unless that would slide under the HUD at the top of the screen
    let ty = cy - inner - band - 26;
    if (ty < viewBounds(this.scene).top + 150) ty = cy + inner + band + 28;
    this.tapText
      .setVisible(perfect)
      .setPosition(cx, ty)
      .setScale(1 + pulse * 0.12);
  }

  private bigText(x: number, y: number, message: string): void {
    const t = this.scene.add
      .text(x, y, message, {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#00a7c2',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.FLOAT + 2)
      .setScale(0.4);
    this.scene.tweens.add({ targets: t, scale: 1.15, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, scale: 1, y: y - 26, delay: 160, duration: 420, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 760, duration: 260, onComplete: () => t.destroy() });
  }

  destroy(): void {
    if (this.target) this.target.hackLock = false;
    this.target = null;
  }
}
