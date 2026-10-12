import Phaser from 'phaser';
import { COLORS, ECONOMY, css } from '../config';
import type { TowerDef, TowerLevel } from '../data/towers';
import type { Tower } from '../entities/Tower';
import { iconKey } from '../rendering/TowerRenderer';
import { drawerY } from './TowerMenu';
import { drawerLayout } from './DrawerLayout';
import { Icons, NeonButton, drawPanel, text } from './widgets';

type Comparison = { label: string; value: (level: TowerLevel) => number; format: (value: number) => string; lowerBetter?: boolean };
const number = (value: number) => `${Math.round(value * 10) / 10}`;
const seconds = (value: number) => `${number(value)}s`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

function comparisons(def: TowerDef): Comparison[] {
  const damage: Comparison = { label: def.attack === 'beam' ? 'Damage / sec' : 'Damage', value: l => l.damage, format: number };
  const range: Comparison = { label: 'Range', value: l => l.range, format: number };
  switch (def.attack) {
    case 'frost': return [
      { label: 'Slow strength', value: l => l.slow ?? 0, format: percent },
      { label: 'Slow duration', value: l => l.slowDuration ?? 0, format: seconds }, range,
    ];
    case 'chain': return [damage, { label: 'Chain targets', value: l => l.chainCount ?? 1, format: number }, range];
    case 'missile': return [damage, { label: 'Splash radius', value: l => l.splashRadius ?? 0, format: number }, range];
    case 'beam': return [damage, { label: 'Warm-up', value: l => l.warmup ?? 0, format: seconds, lowerBetter: true }, range];
    default: return [damage, { label: 'Shots / sec', value: l => 1 / l.fireInterval, format: number }, range];
  }
}

function perkLine(def: TowerDef): string {
  switch (def.attack) {
    case 'bolt': return 'Rapid single-target fire';
    case 'shell': return 'Pierces heavy armor';
    case 'missile': return 'Damages enemies in a group';
    case 'chain': return 'Chain lightning · 2× shield damage';
    case 'beam': return 'Continuous beam · pierces armor';
    case 'frost': return 'Frozen enemies take +15% damage';
  }
}

/** Readable current-to-next comparisons with separate upgrade and sell controls. */
export class UpgradePanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly perk: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly nexts: Phaser.GameObjects.Text[] = [];
  private readonly cards: Phaser.GameObjects.Graphics[] = [];
  private readonly upgradeBtn: NeonButton;
  private readonly upgradeCost: Phaser.GameObjects.Text;
  private readonly upgradeCoin: Phaser.GameObjects.Image;
  private readonly sellBtn: NeonButton;
  private readonly sellCost: Phaser.GameObjects.Text;
  private readonly sellCoin: Phaser.GameObjects.Image;
  private readonly closeButton: NeonButton;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly blocker: Phaser.GameObjects.Zone;
  private tower: Tower | null = null;
  private lastCredits = -1;
  private visible = false;
  private compact = false;
  private panelH = 260;

  constructor(private readonly scene: Phaser.Scene, onUpgrade: () => void, onSell: () => void, onClose: () => void) {
    const s = scene;
    this.root = s.add.container(0, 0).setVisible(false).setDepth(20);
    this.frame = s.add.graphics();
    this.blocker = s.add.zone(0, 0, 1, 1).setInteractive();
    this.icon = s.add.image(64, 42, iconKey('pulse', 1)).setScale(0.8);
    this.title = text(s, 0, 0, '', 24, COLORS.cyan);
    this.level = text(s, 0, 0, '', 16, COLORS.textDim);
    this.perk = text(s, 0, 0, '', 18, COLORS.text, { fontStyle: 'normal' });
    this.root.add([this.frame, this.blocker, this.icon, this.title, this.level, this.perk]);
    for (let i = 0; i < 3; i++) {
      const card = s.add.graphics();
      const label = text(s, 0, 0, '', 16, COLORS.textDim, { fontStyle: 'normal' });
      const value = text(s, 0, 0, '', 24, COLORS.text);
      const next = text(s, 0, 0, '', 18, COLORS.green);
      this.cards.push(card); this.labels.push(label); this.values.push(value); this.nexts.push(next);
      this.root.add([card, label, value, next]);
    }
    this.upgradeBtn = new NeonButton(s, 0, 0, 300, 48, {
      label: 'UPGRADE', fontSize: 18, color: COLORS.green,
      panelStyle: { corners: false, radius: 10 }, onClick: onUpgrade,
    });
    this.upgradeCoin = s.add.image(0, 12, 'ui_coin').setScale(0.5);
    this.upgradeCost = text(s, 0, 12, '', 14, COLORS.gold).setOrigin(0, 0.5);
    this.upgradeBtn.add([this.upgradeCoin, this.upgradeCost]);
    this.sellBtn = new NeonButton(s, 0, 0, 220, 48, {
      label: 'SELL', fontSize: 16, color: COLORS.textDim,
      panelStyle: { corners: false, glow: false, radius: 10 }, onClick: onSell,
    });
    this.sellCoin = s.add.image(0, 12, 'ui_coin').setScale(0.5);
    this.sellCost = text(s, 0, 12, '', 14, COLORS.gold).setOrigin(0, 0.5);
    this.sellBtn.add([this.sellCoin, this.sellCost]);
    this.closeButton = new NeonButton(s, 0, 30, 44, 44, {
      icon: Icons.close, color: COLORS.textDim,
      panelStyle: { corners: false, glow: false }, onClick: onClose,
    });
    this.root.add([this.upgradeBtn, this.sellBtn, this.closeButton]);
  }

  get isOpen(): boolean { return this.visible; }

  open(tower: Tower, dockTop: boolean, credits: number): void {
    const wasVisible = this.visible && this.tower === tower;
    this.tower = tower;
    this.lastCredits = -1;
    this.layout();
    this.rebuild(credits);
    const y = drawerY(this.scene, dockTop, this.panelH * this.root.scaleY);
    this.scene.tweens.killTweensOf(this.root);
    if (!wasVisible) {
      this.root.setVisible(true).setAlpha(0).setY(y + (dockTop ? -20 : 20));
      this.scene.tweens.add({ targets: this.root, y, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    } else this.root.setY(y);
    this.visible = true;
  }

  private layout(): void {
    const layout = drawerLayout(this.scene, 900);
    const w = layout.width;
    this.compact = layout.compact;
    const padding = this.compact ? 16 : 20;
    this.upgradeBtn.label?.setFontSize(20);
    this.sellBtn.label?.setFontSize(20);
    this.upgradeCost.setFontSize(17);
    this.sellCost.setFontSize(17);
    // Both action buttons reserve exactly 8 logical pixels above/below their contents.
    const buttonH = this.upgradeBtn.label!.height + 6 + Math.max(this.upgradeCoin.displayHeight, this.upgradeCost.height) + 16;
    const cardInset = this.compact ? 10 : 12;
    const rowGap = this.compact ? 4 : 6;
    for (let i = 0; i < 3; i++) {
      this.labels[i].setFontSize(17);
      this.values[i].setFontSize(this.compact ? 24 : 27);
      this.nexts[i].setFontSize(18);
    }
    const cardH = cardInset * 2 + this.labels[0].height + this.values[0].height + this.nexts[0].height + rowGap * 2;
    const headerH = 64;
    const cardY = padding + headerH + 12;
    this.panelH = cardY + cardH + 12 + buttonH + padding;
    this.root.setX(layout.x).setScale(layout.scale);
    this.frame.clear();
    drawPanel(this.frame, 0, 0, w, this.panelH, {
      color: 0x344963, fillAlpha: 0.98, corners: false, glow: false, radius: 12,
    });
    this.blocker.setPosition(w / 2, this.panelH / 2).setSize(w, this.panelH);
    this.closeButton.setPosition(w - padding - 22, padding + headerH / 2);
    this.icon.setVisible(!this.compact);
    this.icon.setPosition(padding + 32, padding + headerH / 2).setScale(0.65);
    this.title.setPosition(this.compact ? padding : padding + 76, padding).setFontSize(24);
    this.level.setOrigin(this.compact ? 0 : 1, this.compact ? 0 : 0.5)
      .setPosition(this.compact ? padding : w - padding - 56, this.compact ? padding + this.title.height + 6 : padding + this.title.height / 2)
      .setFontSize(16);
    this.perk.setPosition(this.compact ? 200 : padding + 76, this.compact ? 16 : padding + this.title.height + 6)
      .setFontSize(18).setWordWrapWidth(this.compact ? w - 266 : w - 160);
    const gap = 12;
    const cardW = (w - padding * 2 - gap * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const x = padding + i * (cardW + gap);
      this.cards[i].clear();
      drawPanel(this.cards[i], x, cardY, cardW, cardH, {
        color: 0x28364f, fill: 0x111a2e, corners: false, glow: false, radius: 10,
      });
      const labelY = cardY + cardInset;
      const valueY = labelY + this.labels[i].height + rowGap;
      const nextY = valueY + this.values[i].height + rowGap;
      this.labels[i].setPosition(x + cardInset, labelY);
      this.values[i].setPosition(x + cardInset, valueY);
      this.nexts[i].setPosition(x + cardInset, nextY);
    }
    const actionY = this.panelH - padding - buttonH / 2;
    // Resize the visible panel and hit area together.
    const actionWidth = w - padding * 2;
    const upgradeW = (actionWidth - 12) / 2;
    const sellW = upgradeW;
    this.upgradeBtn.resize(upgradeW, buttonH).setPosition(padding + upgradeW / 2, actionY);
    this.sellBtn.resize(sellW, buttonH).setPosition(w - padding - sellW / 2, actionY);
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false; this.tower = null;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  refresh(credits: number): void {
    if (!this.tower || credits === this.lastCredits) return;
    this.lastCredits = credits;
    const next = this.tower.nextStats;
    const affordable = !!next && credits >= next.cost;
    this.upgradeBtn.setEnabled(affordable);
    if (next) {
      this.upgradeBtn.setLabel(affordable ? `UPGRADE TO LV ${this.tower.level + 1}` : `NEED ${next.cost - credits} MORE`);
      this.upgradeCost.setColor(css(affordable ? COLORS.gold : COLORS.red));
      this.centerAction(this.upgradeBtn, this.upgradeCoin, this.upgradeCost, true);
    }
  }

  private rebuild(credits: number): void {
    const t = this.tower!;
    const next = t.nextStats;
    this.icon.setTexture(iconKey(t.def.type, t.level));
    this.title.setText(t.def.name).setColor(css(t.def.color));
    this.level.setText(`LEVEL ${t.level} / 3`);
    this.perk.setText(perkLine(t.def));
    comparisons(t.def).forEach((stat, i) => {
      const current = stat.value(t.stats);
      const future = next ? stat.value(next) : current;
      const delta = future - current;
      this.labels[i].setText(stat.label);
      this.values[i].setText(stat.format(current));
      const improved = stat.lowerBetter ? delta < 0 : delta > 0;
      this.nexts[i].setColor(css(improved ? COLORS.green : COLORS.textDim));
      this.nexts[i].setText(!next ? 'Maximum' : delta === 0 ? 'No change' : `→ ${stat.format(future)} (${delta > 0 ? '+' : '−'}${stat.format(Math.abs(delta))})`);
    });
    this.upgradeCoin.setVisible(!!next); this.upgradeCost.setVisible(!!next);
    if (next) {
      this.upgradeCost.setText(`${next.cost}`);
    } else this.upgradeBtn.setLabel('MAX LEVEL');
    this.sellBtn.setLabel('SELL TOWER');
    this.sellCost.setText(`+${Math.floor(t.invested * ECONOMY.sellRefund)}`);
    this.centerAction(this.sellBtn, this.sellCoin, this.sellCost, true);
    this.centerAction(this.upgradeBtn, this.upgradeCoin, this.upgradeCost, !!next);
    this.refresh(credits);
  }

  /** Center the measured two-row group: equal padding above/below and coin gaps. */
  private centerAction(button: NeonButton, coin: Phaser.GameObjects.Image, cost: Phaser.GameObjects.Text, priced: boolean): void {
    const label = button.label!;
    if (!priced) { label.setPosition(0, 0); return; }
    const rowH = Math.max(coin.displayHeight, cost.height);
    const contentH = label.height + 6 + rowH;
    label.setPosition(0, -contentH / 2 + label.height / 2);
    const rowY = contentH / 2 - rowH / 2;
    const rowW = coin.displayWidth + 6 + cost.width;
    coin.setPosition(-rowW / 2 + coin.displayWidth / 2, rowY);
    cost.setPosition(-rowW / 2 + coin.displayWidth + 6, rowY);
  }
}
