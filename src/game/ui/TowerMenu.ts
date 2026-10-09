import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, css } from '../config';
import { viewBounds } from '../utils/View';
import { TOWERS, TOWER_ORDER, type TowerDef, type TowerType } from '../data/towers';
import { iconKey } from '../rendering/TowerRenderer';
import { NeonButton, Icons, drawPanel, text } from './widgets';
import { sfx } from '../audio/SoundSystem';

export const DRAWER_H = 224;
export const DRAWER_TOP_Y = 112;

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
  icon: Phaser.GameObjects.Image;
  coin: Phaser.GameObjects.Image;
  description: Phaser.GameObjects.Text;
  affordable: boolean | null;
}

const CARD_W = 232;
const CARD_H = 140;
const ROLES: Record<TowerType, string> = {
  pulse: 'Fast single target',
  cannon: 'Breaks heavy armor',
  missile: 'Hits enemy groups',
  tesla: 'Chains through shields',
  laser: 'Continuous armor piercing',
};
const MOBILE_ROLES: Record<TowerType, string> = {
  pulse: 'Rapid fire',
  cannon: 'Anti-armor',
  missile: 'Splash damage',
  tesla: 'Chain lightning',
  laser: 'Piercing beam',
};

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
    drawPanel(bg, 0, 0, W, DRAWER_H, {
      color: 0x344963, fillAlpha: 0.97, corners: false, glow: false, radius: 12,
    });
    // swallow taps on the panel background
    const blocker = scene.add.zone(W / 2, DRAWER_H / 2, W, DRAWER_H).setInteractive();
    this.root.add([bg, blocker]);
    this.root.add(text(scene, 24, 32, 'BUILD TOWER', 20, COLORS.text).setOrigin(0, 0.5));

    const close = new NeonButton(scene, W - 43, 32, 54, 44, {
      icon: Icons.close,
      color: COLORS.textDim,
      panelStyle: { corners: false, glow: false },
      onClick: () => this.onClose(),
    });
    this.root.add(close);

    const gap = (W - 32 - CARD_W * 5) / 4;
    TOWER_ORDER.forEach((type, i) => {
      const cx = 16 + i * (CARD_W + gap);
      this.cards.push(this.makeCard(type, cx, 64));
    });
  }

  private makeCard(type: TowerType, x: number, y: number): Card {
    const s = this.scene;
    const def = TOWERS[type];
    const c = s.add.container(x, y);
    const bg = s.add.graphics();
    c.add(bg);
    const icon = s.add.image(60, 76, iconKey(type, 1)).setScale(1);
    const name = text(s, CARD_W / 2, 22, def.name.replace(' Tower', ''), 24, def.color).setOrigin(0.5);
    const desc = text(s, CARD_W / 2, 118, ROLES[type], 15, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0.5);
    const coin = s.add.image(150, 78, 'ui_coin').setScale(0.75);
    const cost = text(s, 176, 78, `${def.levels[0].cost}`, 26, COLORS.gold).setOrigin(0, 0.5);
    c.add([icon, name, desc, coin, cost]);

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
    return { type, container: c, bg, cost, icon, coin, description: desc, affordable: null };
  }

  private drawCard(card: Card): void {
    const def = TOWERS[card.type];
    const g = card.bg;
    g.clear();
    drawPanel(g, 0, 0, CARD_W, CARD_H, {
      color: card.affordable ? def.color : 0x2a3550,
      fill: 0x0f1729,
      radius: 10,
      corners: false,
      glow: false,
    });
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
    // Use displayed pixels, since EXPAND keeps logical dimensions large on phones.
    const compact = this.scene.scale.canvas.getBoundingClientRect().width < 1000
      || window.matchMedia('(pointer: coarse)').matches;
    for (const card of this.cards) {
      card.description.setVisible(true)
        .setText(compact ? MOBILE_ROLES[card.type] : ROLES[card.type])
        .setFontSize(compact ? 22 : 15)
        .setColor(css(compact ? COLORS.text : COLORS.textDim));
      // Icon and price share a row, leaving the bottom row for a readable role.
      card.icon.setPosition(60, 76)
        .setScale(compact ? 0.9 : 1);
      const costY = 78;
      // Center the coin + price together, including two- and three-digit costs.
      const groupWidth = 26 + card.cost.width;
      const groupLeft = 177 - groupWidth / 2;
      card.coin.setPosition(groupLeft + 9, costY);
      card.cost.setPosition(groupLeft + 26, costY);
    }
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
