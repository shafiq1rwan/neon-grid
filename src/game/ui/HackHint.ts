import Phaser from 'phaser';
import { COLORS } from '../config';
import { createPointer } from './Tutorial';
import { text } from './widgets';

/**
 * One-time coaching for hacking (never blocks play): a hand taps the leading
 * machine with "Tap to hack!", then during the lock it explains the timing.
 */
export class HackHint {
  private readonly root: Phaser.GameObjects.Container;
  private readonly ripple: Phaser.GameObjects.Graphics;
  private readonly hand: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private t = 0;
  /** Seconds the "Tap to hack!" pointer has been on screen. */
  shownTime = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.ripple = scene.add.graphics();
    this.hand = createPointer(scene);
    this.label = text(scene, 0, 0, '', 26, COLORS.text, { stroke: '#05080f', strokeThickness: 7 }).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.ripple, this.hand, this.label]).setDepth(40).setVisible(false);
  }

  /** Point at a machine to hack (`locking` = the ring is already closing on it). */
  show(
    target: { x: number; y: number },
    locking: boolean,
    dt: number,
    view: { left: number; right: number; top: number; bottom: number },
  ): void {
    this.t += dt;
    this.root.setVisible(true);
    const g = this.ripple;
    g.clear();
    if (locking) {
      this.hand.setVisible(false);
      this.label.setText('Tap again when the rings meet!').setScale(0.85);
      // well clear of the reticle and its "TAP!" cue, and on screen
      const below = target.y + 140;
      this.label.setPosition(this.clampX(target.x, view), below < view.bottom - 30 ? below : target.y - 140);
      return;
    }
    this.shownTime += dt;
    const k = (this.t * 1.2) % 1;
    g.lineStyle(4, COLORS.cyan, 1 - k);
    g.strokeCircle(target.x, target.y, 16 + k * 30);
    const press = Math.abs(Math.sin(this.t * 4));
    this.hand.setVisible(true).setPosition(target.x + 8, target.y + 12 + press * 9);
    this.label.setText('Tap to hack!').setScale(1 + Math.sin(this.t * 5) * 0.04);
    this.label.setPosition(this.clampX(target.x, view), target.y - 58);
  }

  /** Keep the label fully on screen. */
  private clampX(x: number, view: { left: number; right: number }): number {
    const half = (this.label.width * this.label.scaleX) / 2 + 12;
    return Math.min(Math.max(x, view.left + half), view.right - half);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Fade out and remove. */
  retire(): void {
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 400, onComplete: () => this.root.destroy() });
  }

  destroy(): void {
    this.root.destroy();
  }
}
