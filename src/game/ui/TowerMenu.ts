import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, css } from '../config';
import { viewBounds } from '../utils/View';
import { TOWERS, TOWER_ORDER, type TowerDef, type TowerType } from '../data/towers';
import { iconKey } from '../rendering/TowerRenderer';
import { NeonButton, Icons, drawPanel, statBar, text } from './widgets';
import { sfx } from '../audio/SoundSystem';

export const DRAWER_H = 168;
export const DRAWER_TOP_Y = 98;

/** Normalised 0..1 stat values for bars. */
export function statValues(def: TowerDef, levelIndex: number): { damage: number; rate: number; range: number } {
  const l = def.levels[levelIndex];
  const rate = def.attack === 'beam' ? 4.5 : 1 / l.fireInterval;
  return {
    damage: Math.sqrt(Math.min(1, l.damage / 150)),
    rate: Math.sqrt(Math.min(1, rate / 4.5)),
    range: Math.min(1, l.range / 200),
  };
}

/** Drawer top edge: just under the HUD, or flush with the visible bottom edge. */
export function drawerY(scene: Phaser.Scene, dockTop: boolean, h = DRAWER_H): number {
  const view = viewBounds(scene);
  return dockTop ? view.top + DRAWER_TOP_Y : view.bottom - h - 10;
}

interface Card {
  type: TowerType;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  cost: Phaser.GameObjects.Text;
  affordable: boolean | null;
}

const CARD_W = 232;
const CARD_H = 140;

/** Bottom/top docked drawer listing all five towers for an empty platform. */
export class TowerMenu {
  readonly root: Phaser.GameObjects.Container;
  private readonly cards: Card[] = [];
  private visible = false;
  dockTop = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPick: (type: TowerType) => void,
    private readonly onClose: () => void,
  ) {
    const W = GAME_WIDTH - 40;
    this.root = scene.add.container(20, 0).setVisible(false).setDepth(20);

    const bg = scene.add.graphics();
    drawPanel(bg, 0, 0, W, DRAWER_H, { color: COLORS.cyan, fillAlpha: 0.94 });
    // swallow taps on the panel background
    const blocker = scene.add.zone(W / 2, DRAWER_H / 2, W, DRAWER_H).setInteractive();
    this.root.add([bg, blocker]);
    this.root.add(text(scene, 26, 5, 'BUILD TOWER', 13, COLORS.cyan, { letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle));

    const close = new NeonButton(scene, W - 26, 18, 40, 30, {
      icon: Icons.close,
      color: COLORS.textDim,
      onClick: () => this.onClose(),
    });
    this.root.add(close);

    const gap = (W - 20 - CARD_W * 5) / 4;
    TOWER_ORDER.forEach((type, i) => {
      const cx = 10 + i * (CARD_W + gap);
      this.cards.push(this.makeCard(type, cx, 22));
    });
  }

  private makeCard(type: TowerType, x: number, y: number): Card {
    const s = this.scene;
    const def = TOWERS[type];
    const c = s.add.container(x, y);
    const bg = s.add.graphics();
    c.add(bg);
    const icon = s.add.image(54, 60, iconKey(type, 1)).setScale(1.12);
    const name = text(s, 104, 10, def.name, 17, def.color);
    const desc = text(s, 104, 33, def.description, 12, COLORS.textDim, {
      fontStyle: 'normal',
      wordWrap: { width: CARD_W - 112 },
      lineSpacing: -2,
    });
    const coin = s.add.image(24, 122, 'ui_coin').setScale(0.7);
    const cost = text(s, 38, 122, `${def.levels[0].cost}`, 18, COLORS.gold).setOrigin(0, 0.5);

    const bars = s.add.graphics();
    const v = statValues(def, 0);
    const labels = ['DMG', 'RATE', 'RNG'];
    const vals = [v.damage, v.rate, v.range];
    labels.forEach((label, k) => {
      const by = 80 + k * 17;
      c.add(text(s, 104, by - 5, label, 10, COLORS.textDim, { fontStyle: 'normal' }));
      statBar(bars, 140, by, CARD_W - 152, vals[k], def.color);
    });
    c.add([icon, name, desc, coin, cost, bars]);

    // Children are laid out from the card's top-left, so a centred zone is the hit area.
    const hit = s.add.zone(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.add(hit);
    let pressed = false;
    hit.on('pointerdown', () => {
      pressed = true;
      c.setAlpha(0.8);
    });
    hit.on('pointerout', () => {
      pressed = false;
      c.setAlpha(1);
    });
    hit.on('pointerup', () => {
      c.setAlpha(1);
      if (!pressed) return;
      pressed = false;
      const card = this.cards.find((k) => k.type === type);
      if (card && !card.affordable) {
        sfx.play('error');
        this.scene.tweens.add({ targets: c, x: c.x + 6, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      this.onPick(type);
    });
    this.root.add(c);
    return { type, container: c, bg, cost, affordable: null };
  }

  private drawCard(card: Card): void {
    const def = TOWERS[card.type];
    const g = card.bg;
    g.clear();
    drawPanel(g, 0, 0, CARD_W, CARD_H, {
      color: card.affordable ? def.color : 0x2a3550,
      fill: 0x0f1729,
      radius: 8,
      corners: !!card.affordable,
    });
    if (card.affordable) {
      g.fillStyle(def.color, 0.07);
      g.fillCircle(54, 60, 44);
    }
    card.container.setAlpha(1);
    for (const child of card.container.list) {
      if (child instanceof Phaser.GameObjects.Image) child.setAlpha(card.affordable ? 1 : 0.4);
    }
    card.cost.setColor(card.affordable ? css(COLORS.gold) : css(COLORS.red));
  }

  /** Refresh affordability; cheap when nothing changed. */
  refresh(credits: number): void {
    for (const card of this.cards) {
      const ok = credits >= TOWERS[card.type].levels[0].cost;
      if (ok !== card.affordable) {
        card.affordable = ok;
        this.drawCard(card);
      }
    }
  }

  open(dockTop: boolean, credits: number): void {
    this.dockTop = dockTop;
    const y = drawerY(this.scene, dockTop);
    this.refresh(credits);
    if (!this.visible) {
      this.root.setVisible(true).setAlpha(0);
      this.root.y = y + (dockTop ? -20 : 20);
      this.scene.tweens.add({ targets: this.root, y, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    } else {
      this.root.y = y;
    }
    this.visible = true;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  /** World-space centre of a tower card (for tutorial pointers). */
  cardCenter(type: TowerType): { x: number; y: number } {
    const card = this.cards.find((c) => c.type === type)!;
    return { x: this.root.x + card.container.x + CARD_W / 2, y: drawerY(this.scene, this.dockTop) + card.container.y + CARD_H / 2 };
  }
}
