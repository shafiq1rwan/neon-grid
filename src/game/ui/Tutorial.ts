import Phaser from 'phaser';
import { COLORS } from '../config';
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
  private readonly hand: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly host: TutorialHost,
  ) {
    this.ripple = scene.add.graphics();
    this.hand = scene.add.graphics();
    drawHand(this.hand);
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
        // label on the side of the card away from the drawer edge
        ly = target.y > 400 ? -110 : 96;
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
    // the hand taps down onto the target
    const press = Math.abs(Math.sin(this.t * 4));
    this.hand.setPosition(target.x + 10, target.y + 14 + press * 10);
    this.label.setPosition(target.x + lx, target.y + ly);
    this.label.setScale(1 + Math.sin(this.t * 5) * 0.04);
  }
}

/** A simple pointing hand (fingertip at 0,0). */
function drawHand(g: Phaser.GameObjects.Graphics): void {
  const skin = 0xffffff;
  const edge = 0x05080f;
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-4, 4, 18, 40, 8);
  g.fillRoundedRect(-4, 30, 44, 34, 12);
  // index finger
  g.fillStyle(skin, 1);
  g.lineStyle(3, edge, 1);
  g.fillRoundedRect(-8, 0, 16, 40, 8);
  g.strokeRoundedRect(-8, 0, 16, 40, 8);
  // palm and folded fingers
  g.fillRoundedRect(-8, 26, 42, 34, 12);
  g.strokeRoundedRect(-8, 26, 42, 34, 12);
  g.lineStyle(2, edge, 0.6);
  g.lineBetween(10, 30, 10, 44);
  g.lineBetween(22, 30, 22, 44);
  // thumb
  g.fillStyle(skin, 1);
  g.lineStyle(3, edge, 1);
  g.fillRoundedRect(-18, 34, 14, 22, 7);
  g.strokeRoundedRect(-18, 34, 14, 22, 7);
  g.setScale(0.9);
}
