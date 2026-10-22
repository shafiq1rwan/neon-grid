import Phaser from 'phaser';
import { COLORS } from '../config';
import { poki } from '../platform/PokiAdapter';
import { createPointer } from './Tutorial';
import { text } from './widgets';

export type NudgeKind = 'build' | 'upgrade';

export interface NudgeTarget {
  kind: NudgeKind;
  x: number;
  y: number;
  /** No towers built yet ("Build a tower!" rather than "another"). */
  first: boolean;
}

/** Seconds the player can act on their own before the nudge appears. */
const DELAY = 4;
/** Seconds a nudge stays up if ignored. */
const SHOW_TIME = 8;
/** Seconds to stay quiet after an ignored nudge. */
const COOLDOWN = 20;

const LABELS: Record<NudgeKind, string> = {
  build: 'Build another tower!',
  upgrade: 'Upgrade a tower!',
};

/**
 * Playtest finding (v1.2.0 fit test): players built one or two towers and
 * then either left out of boredom (wave 2) or were overrun later (waves 4
 * and 8). This hint points at an empty platform whenever the player can
 * afford a tower, or at an upgrade once every platform is full. It never
 * blocks taps, waits a few seconds before showing, and backs off if ignored.
 */
export class BuildNudge {
  private readonly root: Phaser.GameObjects.Container;
  private readonly ripple: Phaser.GameObjects.Graphics;
  private readonly hand: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private t = 0;
  /** Seconds the current opportunity has existed without the player acting. */
  private waiting = 0;
  /** Seconds the nudge has been on screen (0 = hidden). */
  private shown = 0;
  private cooldown = 0;
  private showingKind: NudgeKind | null = null;

  constructor(scene: Phaser.Scene) {
    this.ripple = scene.add.graphics();
    this.hand = createPointer(scene);
    this.label = text(scene, 0, 0, '', 24, COLORS.text, { stroke: '#05080f', strokeThickness: 7 }).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.ripple, this.hand, this.label]).setDepth(39).setVisible(false);
  }

  /**
   * Call every frame with the current opportunity (null when there is none)
   * and whether hints must stay out of the way right now.
   */
  update(target: NudgeTarget | null, blocked: boolean, dt: number, view: { left: number; right: number; top: number }): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!target) {
      // the opportunity is gone; if we were pointing at it, the player followed
      if (this.showingKind) poki.measure('nudge', this.showingKind, 'followed');
      this.reset();
      return;
    }
    if (this.showingKind && this.showingKind !== target.kind) {
      poki.measure('nudge', this.showingKind, 'followed');
      this.reset();
    }
    if (blocked) {
      this.hide();
      return;
    }
    if (this.shown <= 0) {
      this.waiting += dt;
      if (this.waiting < DELAY || this.cooldown > 0) return;
      this.showingKind = target.kind;
      poki.measure('nudge', target.kind, 'shown');
    }
    this.shown += dt;
    if (this.shown > SHOW_TIME) {
      // ignored: back off for a while
      this.cooldown = COOLDOWN;
      this.reset();
      return;
    }
    this.t += dt;
    this.root.setVisible(true);
    const k = (this.t * 1.2) % 1;
    const g = this.ripple;
    g.clear();
    g.lineStyle(4, target.kind === 'build' ? COLORS.green : COLORS.gold, 1 - k);
    g.strokeCircle(target.x, target.y, 22 + k * 30);
    const press = Math.abs(Math.sin(this.t * 4));
    this.hand.setPosition(target.x + 10, target.y + 14 + press * 10);
    this.label.setText(target.first ? 'Build a tower!' : LABELS[target.kind]).setScale(1 + Math.sin(this.t * 5) * 0.03);
    // label above the target, kept on screen
    const half = this.label.width / 2 + 12;
    const x = Math.min(Math.max(target.x, view.left + half), view.right - half);
    const above = target.y - 62;
    this.label.setPosition(x, above > view.top + 120 ? above : target.y + 92);
  }

  /** The player built or upgraded: count it if we were pointing at that, and start over. */
  acted(kind: NudgeKind): void {
    if (this.showingKind === kind) poki.measure('nudge', kind, 'followed');
    this.reset();
  }

  private hide(): void {
    this.root.setVisible(false);
  }

  private reset(): void {
    this.hide();
    this.waiting = 0;
    this.shown = 0;
    this.showingKind = null;
  }

  destroy(): void {
    this.root.destroy();
  }
}
