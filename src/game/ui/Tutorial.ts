import Phaser from 'phaser';
import { COLORS } from '../config';
import { POINTER_KEY, POINTER_ORIGIN, POINTER_RES } from '../rendering/EffectsRenderer';
import { text } from './widgets';

export type TutorialStep = 'platform' | 'pick' | 'start' | 'done';

export interface TutorialHost {
  /** Platform the first hint points at. */
  platform: { x: number; y: number };
  waveButton: { x: number; y: number };
  pulseCard(): { x: number; y: number };
  finish(): void;
}

const LABELS: Record<Exclude<TutorialStep, 'done'>, string> = {
  platform: 'Tap to build',
  pick: 'Pick a tower',
  start: 'Start the wave!',
};

/**
 * First-run coaching that never blocks play: a bouncing hand and a few big
 * words pointing at the next useful action. Players can ignore it entirely;
 * it ends as soon as the first wave starts.
 */
export class Tutorial {
  step: TutorialStep = 'platform';
  private readonly root: Phaser.GameObjects.Container;
  private readonly ripple: Phaser.GameObjects.Graphics;
  private readonly hand: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly host: TutorialHost,
  ) {
    this.ripple = scene.add.graphics();
    this.hand = createPointer(scene);
    this.label = text(scene, 0, 0, '', 30, COLORS.text, {
      stroke: '#05080f',
      strokeThickness: 7,
    }).setOrigin(0.5);
    // Hints must never swallow taps meant for the game.
    this.root = scene.add.container(0, 0, [this.ripple, this.hand, this.label]).setDepth(40);
    this.label.setText(LABELS.platform);
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  /** Move to a later step (earlier steps are ignored). */
  advance(to: TutorialStep): void {
    if (this.step === 'done') return;
    const order: TutorialStep[] = ['platform', 'pick', 'start', 'done'];
    if (order.indexOf(to) <= order.indexOf(this.step)) return;
    if (to === 'done') {
      this.finish();
      return;
    }
    this.step = to;
    this.t = 0;
    this.label.setText(LABELS[to]);
  }

  /** The build menu was closed without building: point at the platform again. */
  menuClosed(): void {
    if (this.step !== 'pick') return;
    this.step = 'platform';
    this.label.setText(LABELS.platform);
  }

  finish(): void {
    if (this.root.active) this.root.destroy();
    if (this.step === 'done') return;
    this.step = 'done';
    this.host.finish();
  }

  update(dt: number): void {
    if (this.step === 'done') return;
    this.t += dt;
    let target: { x: number; y: number };
    let lx = 0;
    let ly = 0;
    switch (this.step) {
      case 'platform':
        target = this.host.platform;
        ly = -64;
        break;
      case 'pick':
        target = this.host.pulseCard();
        // label clear of the drawer, on the side away from its edge
        ly = target.y > 400 ? -150 : 132;
        break;
      default:
        // beacon sits near the left edge: label to its right
        target = this.host.waveButton;
        lx = 170;
        break;
    }
    // tap ripple on the target
    const k = (this.t * 1.2) % 1;
    this.ripple.clear();
    this.ripple.lineStyle(4, COLORS.green, 1 - k);
    this.ripple.strokeCircle(target.x, target.y, 18 + k * 34);
    this.ripple.lineStyle(10, COLORS.green, 0.15 * (1 - k));
    this.ripple.strokeCircle(target.x, target.y, 22 + k * 34);
    const press = Math.abs(Math.sin(this.t * 4));
    if (this.step === 'pick') {
      // point at the card's tower icon from the right, so its role and price stay readable
      // (mirrored, with the origin mirrored too, so the thumb stays on top)
      this.hand.setFlipX(true).setOrigin(1 - POINTER_ORIGIN.x, POINTER_ORIGIN.y).setRotation(-Math.PI / 2)
        .setPosition(target.x + 34 + press * 10, target.y - 12);
    } else {
      // the hand taps down onto the target
      this.hand.setFlipX(false).setOrigin(POINTER_ORIGIN.x, POINTER_ORIGIN.y).setRotation(0)
        .setPosition(target.x + 10, target.y + 14 + press * 10);
    }
    this.label.setPosition(target.x + lx, target.y + ly);
    this.label.setScale(1 + Math.sin(this.t * 5) * 0.04);
  }
}

/** A simple pointing hand (fingertip at 0,0). */
/** The coaching pointer: a baked glove texture whose origin is the fingertip. */
export function createPointer(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, POINTER_KEY)
    .setOrigin(POINTER_ORIGIN.x, POINTER_ORIGIN.y)
    .setScale(1 / POINTER_RES);
}
