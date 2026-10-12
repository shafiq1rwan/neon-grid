import Phaser from 'phaser';
import { COLORS, css } from '../config';
import { viewBounds } from '../utils/View';
import { TOWERS, type TowerDef, type TowerType } from '../data/towers';
import { iconKey } from '../rendering/TowerRenderer';
import { NeonButton, Icons, drawPanel, text } from './widgets';
import { drawerLayout } from './DrawerLayout';
import { sfx } from '../audio/SoundSystem';

export const DRAWER_H = 224;
export const DRAWER_TOP_Y = 160;

/** Normalised 0..1 stat values for bars. */
export function statValues(def: TowerDef, levelIndex: number): { damage: number; rate: number; range: number } {
  const l = def.levels[levelIndex];
  const rate = def.attack === 'beam' ? 4.5 : 1 / l.fireInterval;
  if (def.attack === 'frost') {
    return { damage: Math.min(1, (l.slow ?? 0) * 1.6), rate: Math.sqrt(Math.min(1, rate / 4.5)), range: Math.min(1, l.range / 200) };
  }
  return { damage: Math.sqrt(Math.min(1, l.damage / 150)), rate: Math.sqrt(Math.min(1, rate / 4.5)), range: Math.min(1, l.range / 200) };
}

export function drawerY(scene: Phaser.Scene, dockTop: boolean, h = DRAWER_H): number {
  const view = viewBounds(scene);
  const bottom = view.bottom - h - 10;
  return Math.max(view.top + 8, dockTop ? Math.min(view.top + DRAWER_TOP_Y, bottom) : bottom);
}

interface Card {
  type: TowerType;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image;
  coin: Phaser.GameObjects.Image;
  description: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
  affordable: boolean | null;
}

const CARD_GAP = 12;
const ROLES: Record<TowerType, string> = {
  pulse: 'Rapid fire', cannon: 'Breaks armor', missile: 'Splash damage',
  tesla: 'Chains through shields', laser: 'Piercing beam', cryo: 'Slows enemy groups',
};
const COMPACT_ROLES: Record<TowerType, string> = {
  pulse: 'Rapid fire', cannon: 'Anti-armor', missile: 'Splash damage',
  tesla: 'Chain lightning', laser: 'Piercing beam', cryo: 'Freeze & slow',
};

/** Docked build drawer; mobile pages leave room for readable roles and prices. */
export class TowerMenu {
  readonly root: Phaser.GameObjects.Container;
  private readonly cards: Card[] = [];
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly pageLabel: Phaser.GameObjects.Text;
  private readonly previous: NeonButton;
  private readonly next: NeonButton;
  private readonly closeButton: NeonButton;
  private visible = false;
  dockTop = false;
  private cardW = 200;
  private cardH = 140;
  private page = 0;
  private perPage = 6;
  private panelW = 1240;
  private panelH = DRAWER_H;
  private cardTop = 72;

  constructor(
    private readonly scene: Phaser.Scene,
    towers: readonly TowerType[],
    private readonly onPick: (type: TowerType) => void,
    private readonly onClose: () => void,
  ) {
    this.root = scene.add.container(0, 0).setVisible(false).setDepth(20);
    this.frame = scene.add.graphics();
    this.blocker = scene.add.zone(0, 0, 1, 1).setInteractive();
    this.heading = text(scene, 20, 30, 'BUILD TOWER', 20, COLORS.text).setOrigin(0, 0.5);
    this.pageLabel = text(scene, 0, 30, '', 14, COLORS.textDim).setOrigin(0.5);
    this.root.add([this.frame, this.blocker, this.heading, this.pageLabel]);
    const buttonStyle = { corners: false, glow: false };
    this.previous = new NeonButton(scene, 0, 30, 44, 44, {
      label: '<', fontSize: 24, panelStyle: buttonStyle,
      onClick: () => this.changePage(-1),
    });
    this.next = new NeonButton(scene, 0, 30, 44, 44, {
      label: '>', fontSize: 24, panelStyle: buttonStyle,
      onClick: () => this.changePage(1),
    });
    this.closeButton = new NeonButton(scene, 0, 30, 44, 44, {
      icon: Icons.close, color: COLORS.textDim, panelStyle: buttonStyle,
      onClick: () => this.onClose(),
    });
    this.root.add([this.previous, this.next, this.closeButton]);
    towers.forEach((type) => this.cards.push(this.makeCard(type)));
  }

  private makeCard(type: TowerType): Card {
    const s = this.scene;
    const def = TOWERS[type];
    const container = s.add.container(0, 64);
    const bg = s.add.graphics();
    const name = text(s, 0, 0, def.name.replace(' Tower', ''), 24, def.color).setOrigin(0.5);
    const icon = s.add.image(0, 0, iconKey(type, 1));
    const description = text(s, 0, 0, ROLES[type], 16, COLORS.text, { fontStyle: 'normal' }).setOrigin(0.5);
    const coin = s.add.image(0, 0, 'ui_coin');
    const cost = text(s, 0, 0, `${def.levels[0].cost}`, 26, COLORS.gold).setOrigin(0, 0.5);
    const hit = s.add.zone(0, 0, 1, 1).setInteractive({ useHandCursor: true });
    container.add([bg, icon, name, description, coin, cost, hit]);
    let pressed = false;
    hit.on('pointerdown', () => { pressed = true; container.setAlpha(0.8); });
    hit.on('pointerout', () => { pressed = false; container.setAlpha(1); });
    hit.on('pointerup', () => {
      container.setAlpha(1);
      if (!pressed) return;
      pressed = false;
      const card = this.cards.find((k) => k.type === type);
      if (card && !card.affordable) {
        sfx.play('error');
        s.tweens.killTweensOf(container);
        s.tweens.add({ targets: container, x: container.x + 4, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      this.onPick(type);
    });
    this.root.add(container);
    return { type, container, bg, name, cost, icon, coin, description, hit, affordable: null };
  }

  private drawCard(card: Card): void {
    card.bg.clear();
    drawPanel(card.bg, 0, 0, this.cardW, this.cardH, {
      color: card.affordable ? TOWERS[card.type].color : 0x2a3550,
      fill: 0x0f1729, radius: 10, corners: false, glow: false,
    });
    card.icon.setAlpha(card.affordable ? 1 : 0.4);
    card.coin.setAlpha(card.affordable ? 1 : 0.4);
    card.cost.setColor(css(card.affordable ? COLORS.gold : COLORS.red));
  }

  private layoutCards(): void {
    const count = Math.min(this.perPage, this.cards.length - this.page * this.perPage);
    const rowW = count * this.cardW + (count - 1) * CARD_GAP;
    this.cards.forEach((card, index) => {
      const local = index - this.page * this.perPage;
      const shown = local >= 0 && local < this.perPage;
      this.scene.tweens.killTweensOf(card.container);
      card.container.setVisible(shown).setAlpha(1)
        .setPosition((this.panelW - rowW) / 2 + local * (this.cardW + CARD_GAP), this.cardTop);
      // Hidden pages never retain active hit areas.
      if (card.hit.input) card.hit.input.enabled = shown;
    });
    const pages = Math.ceil(this.cards.length / this.perPage);
    this.previous.setVisible(pages > 1).setEnabled(this.page > 0);
    this.next.setVisible(pages > 1).setEnabled(this.page < pages - 1);
    this.pageLabel.setVisible(pages > 1).setText(`${this.page + 1} / ${pages}`);
  }

  private changePage(direction: number): void {
    this.page = Phaser.Math.Clamp(this.page + direction, 0, Math.ceil(this.cards.length / this.perPage) - 1);
    this.layoutCards();
  }

  refresh(credits: number): void {
    for (const card of this.cards) {
      const ok = credits >= TOWERS[card.type].levels[0].cost;
      if (ok !== card.affordable) { card.affordable = ok; this.drawCard(card); }
    }
  }

  open(dockTop: boolean, credits: number): void {
    let layout = drawerLayout(this.scene, 1100);
    if (layout.compact) layout = drawerLayout(this.scene, 1240);
    this.dockTop = dockTop;
    this.panelW = layout.width;
    const padding = 16;
    const headerY = padding + 22;
    this.cardTop = padding + 44 + CARD_GAP;
    this.cardH = layout.compact ? 156 : 140;
    this.panelH = this.cardTop + this.cardH + padding;
    const minimumCardW = layout.compact ? 180 : 160;
    const capacity = Math.max(1, Math.floor((this.panelW - padding * 2 + CARD_GAP) / (minimumCardW + CARD_GAP)));
    this.perPage = Math.min(this.cards.length, capacity);
    this.page = 0;
    this.cardW = Math.min(232, (this.panelW - padding * 2 - CARD_GAP * (this.perPage - 1)) / this.perPage);
    this.root.setX(layout.x).setScale(layout.scale);
    this.frame.clear();
    drawPanel(this.frame, 0, 0, this.panelW, this.panelH, {
      color: 0x344963, fillAlpha: 0.98, corners: false, glow: false, radius: 12,
    });
    this.blocker.setPosition(this.panelW / 2, this.panelH / 2).setSize(this.panelW, this.panelH);
    this.heading.setPosition(padding, headerY).setFontSize(layout.compact ? 24 : 20);
    const closeX = this.panelW - padding - 22;
    this.closeButton.setPosition(closeX, headerY);
    this.previous.setPosition(closeX - 168, headerY);
    this.pageLabel.setPosition(closeX - 112, headerY);
    this.next.setPosition(closeX - 56, headerY);
    for (const card of this.cards) {
      const inset = layout.compact ? 8 : 10;
      card.name.setFontSize(layout.compact ? 24 : 20).setPosition(this.cardW / 2, inset + card.name.height / 2);
      card.description.setText(layout.compact ? COMPACT_ROLES[card.type] : ROLES[card.type])
        .setFontSize(layout.compact ? 18 : 14)
        .setPosition(this.cardW / 2, layout.compact ? 98 : 90);
      card.icon.setPosition(this.cardW / 2, layout.compact ? 60 : 56)
        .setScale((layout.compact ? 0.72 : 0.78) * Math.min(1, this.cardW / 210));
      card.cost.setFontSize(layout.compact ? 26 : 22);
      const coinScale = layout.compact ? 0.75 : 0.6;
      const coinWidth = 32 * coinScale;
      const groupWidth = coinWidth + 6 + card.cost.width;
      const groupLeft = this.cardW / 2 - groupWidth / 2;
      const costY = this.cardH - inset - Math.max(card.cost.height, 32 * coinScale) / 2;
      card.coin.setPosition(groupLeft + coinWidth / 2, costY).setScale(coinScale);
      card.cost.setPosition(groupLeft + coinWidth + 6, costY);
      card.hit.setPosition(this.cardW / 2, this.cardH / 2).setSize(this.cardW, this.cardH);
      card.affordable = credits >= TOWERS[card.type].levels[0].cost;
      this.drawCard(card);
    }
    this.layoutCards();
    const y = drawerY(this.scene, dockTop, this.panelH * layout.scale);
    this.scene.tweens.killTweensOf(this.root);
    if (!this.visible) {
      this.root.setVisible(true).setAlpha(0).setY(y + (dockTop ? -20 : 20));
      this.scene.tweens.add({ targets: this.root, y, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    } else this.root.setY(y);
    this.visible = true;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  get isOpen(): boolean { return this.visible; }

  cardCenter(type: TowerType): { x: number; y: number } {
    const card = this.cards.find((c) => c.type === type)!;
    return {
      x: this.root.x + (card.container.x + this.cardW / 2) * this.root.scaleX,
      y: drawerY(this.scene, this.dockTop, this.panelH * this.root.scaleY) + (card.container.y + this.cardH / 2) * this.root.scaleY,
    };
  }
}
