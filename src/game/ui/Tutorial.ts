import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { NeonButton, drawPanel, text } from './widgets';

export type TutorialStep = 'platform' | 'pick' | 'road' | 'start' | 'done';

export interface TutorialHost {
  /** Platform the tutorial points at. */
  platform: { x: number; y: number };
  entrance: { x: number; y: number };
  reactor: { x: number; y: number };
  waveButton: { x: number; y: number };
  pulseCard(): { x: number; y: number };
  menuDockTop(): boolean;
  setHold(hold: boolean): void;
  finish(): void;
}

const MESSAGES: Record<Exclude<TutorialStep, 'done'>, string> = {
  platform: 'Machines are coming for your reactor!\nTap the glowing platform to build a tower.',
  pick: 'Pick the PULSE TOWER: cheap and fast.\nUnaffordable towers are greyed out.',
  road: 'Enemies follow the ROAD to your REACTOR.\nEach one that escapes drains reactor HP.',
  start: 'Earn credits by destroying machines, then build & upgrade.\nTap the beacon to START the first wave!',
};

/** Short, skippable first-run tutorial driven by game events. */
export class Tutorial {
  step: TutorialStep = 'platform';
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly msg: Phaser.GameObjects.Text;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly nextBtn: NeonButton;
  private readonly skipBtn: NeonButton;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly host: TutorialHost,
  ) {
    this.root = scene.add.container(0, 0).setDepth(40);
    this.ring = scene.add.graphics();
    this.pointer = scene.add.graphics();
    this.panel = scene.add.graphics();
    this.msg = text(scene, 0, 0, '', 18, COLORS.text, { align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    this.nextBtn = new NeonButton(scene, 0, 0, 140, 44, {
      label: 'GOT IT',
      fontSize: 17,
      color: COLORS.green,
      onClick: () => this.advance('start'),
    });
    this.skipBtn = new NeonButton(scene, 0, 0, 150, 38, {
      label: 'SKIP TUTORIAL',
      fontSize: 13,
      color: COLORS.textDim,
      onClick: () => this.finish(),
    });
    this.root.add([this.ring, this.pointer, this.panel, this.msg, this.nextBtn, this.skipBtn]);
    host.setHold(true);
    this.layout();
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  /** Progress the tutorial from a game event. */
  advance(to: TutorialStep): void {
    if (this.step === 'done') return;
    const order: TutorialStep[] = ['platform', 'pick', 'road', 'start', 'done'];
    if (order.indexOf(to) <= order.indexOf(this.step) && to !== 'platform') return;
    this.step = to;
    if (to === 'done') {
      this.finish();
      return;
    }
    this.layout();
  }

  /** The player closed the build menu without building. */
  menuClosed(): void {
    if (this.step === 'pick') {
      this.step = 'platform';
      this.layout();
    }
  }

  finish(): void {
    this.step = 'done';
    this.host.setHold(false);
    this.host.finish();
    this.root.destroy();
  }

  private layout(): void {
    if (this.step === 'done') return;
    const step = this.step;
    this.msg.setText(MESSAGES[step]);
    const w = Math.max(520, this.msg.width + 60);
    const h = this.msg.height + (step === 'road' ? 84 : 40);
    // keep the bubble clear of the build drawer
    let y: number;
    if (step === 'pick') y = this.host.menuDockTop() ? 560 : 150;
    else if (step === 'platform') y = this.host.platform.y > 360 ? 170 : 560;
    else y = 150;
    const x = GAME_WIDTH / 2;
    this.panel.clear();
    drawPanel(this.panel, x - w / 2, y - h / 2, w, h, { color: COLORS.green });
    this.msg.setPosition(x, y - (step === 'road' ? 22 : 0));
    this.nextBtn.setVisible(step === 'road').setPosition(x, y + h / 2 - 30);
    this.skipBtn.setPosition(x + w / 2 - 80, y + h / 2 + 26);
  }

  update(dt: number): void {
    if (this.step === 'done') return;
    this.t += dt;
    const ring = this.ring;
    const ptr = this.pointer;
    ring.clear();
    ptr.clear();
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    const bounce = Math.sin(this.t * 6) * 6;

    const highlight = (x: number, y: number, r: number) => {
      ring.lineStyle(3, COLORS.green, 0.5 + pulse * 0.5);
      ring.strokeCircle(x, y, r + pulse * 6);
      ring.lineStyle(10, COLORS.green, 0.12);
      ring.strokeCircle(x, y, r + 4 + pulse * 6);
    };
    const arrow = (x: number, y: number, fromAbove: boolean) => {
      const dir = fromAbove ? -1 : 1;
      const tipY = y + dir * (bounce + 4);
      ptr.fillStyle(COLORS.green, 1);
      ptr.fillTriangle(x, tipY, x - 13, tipY + dir * 20, x + 13, tipY + dir * 20);
      ptr.fillRect(x - 5, tipY + dir * 20 + (dir < 0 ? -20 : 0), 10, 20);
    };

    switch (this.step) {
      case 'platform': {
        const p = this.host.platform;
        highlight(p.x, p.y, 42);
        arrow(p.x, p.y - 50, true);
        break;
      }
      case 'pick': {
        const c = this.host.pulseCard();
        ring.lineStyle(3, COLORS.green, 0.5 + pulse * 0.5);
        ring.strokeRoundedRect(c.x - 120, c.y - 74, 240, 148, 10);
        const top = this.host.menuDockTop();
        arrow(c.x, top ? c.y + 82 : c.y - 82, !top);
        break;
      }
      case 'road': {
        const e = this.host.entrance;
        const r = this.host.reactor;
        highlight(e.x + 40, e.y, 34);
        highlight(r.x, r.y, 60);
        arrow(r.x, r.y - 70, true);
        break;
      }
      case 'start': {
        const b = this.host.waveButton;
        highlight(b.x, b.y, 40);
        arrow(b.x + 70, b.y, false);
        // sideways arrow pointing left at the beacon
        ptr.clear();
        const tipX = b.x + 46 + bounce;
        ptr.fillStyle(COLORS.green, 1);
        ptr.fillTriangle(tipX, b.y, tipX + 20, b.y - 13, tipX + 20, b.y + 13);
        ptr.fillRect(tipX + 20, b.y - 5, 22, 10);
        break;
      }
      default:
        break;
    }
  }
}
