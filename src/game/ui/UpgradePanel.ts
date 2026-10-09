import Phaser from 'phaser';
import { COLORS, ECONOMY, GAME_WIDTH, css } from '../config';
import type { TowerDef, TowerLevel } from '../data/towers';
import type { Tower } from '../entities/Tower';
import { iconKey } from '../rendering/TowerRenderer';
import { drawerY } from './TowerMenu';
import { Icons, NeonButton, drawPanel, text } from './widgets';

const W = 900;
const H = 200;

function perkLine(def: TowerDef, l: TowerLevel): string {
  switch (def.attack) {
    case 'bolt':
      return 'Rapid single-target fire';
    case 'shell':
      return 'Pierces armor';
    case 'missile':
      return `Splash radius ${l.splashRadius ?? 0}`;
    case 'chain':
      return `Chains ${l.chainCount ?? 1} targets · 2x vs shields`;
    case 'beam':
      return `Warm-up ${(l.warmup ?? 0).toFixed(2)}s · pierces armor`;
    case 'frost':
      return `Slows ${Math.round((l.slow ?? 0) * 100)}% for ${(l.slowDuration ?? 0).toFixed(1)}s · frozen take +15% damage`;
  }
}

function rateLabel(def: TowerDef, l: TowerLevel): string {
  return def.attack === 'beam' ? 'beam' : `${(1 / l.fireInterval).toFixed(1)}/s`;
}

/** Tower details with upgrade and sell actions. */
export class UpgradePanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly perk: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly nexts: Phaser.GameObjects.Text[] = [];
  private readonly upgradeBtn: NeonButton;
  private readonly upgradeCost: Phaser.GameObjects.Text;
  private readonly upgradeCoin: Phaser.GameObjects.Image;
  private readonly sellBtn: NeonButton;
  private readonly frame: Phaser.GameObjects.Graphics;
  private tower: Tower | null = null;
  private lastCredits = -1;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    onUpgrade: () => void,
    onSell: () => void,
    onClose: () => void,
  ) {
    const s = scene;
    this.root = s.add.container((GAME_WIDTH - W) / 2, 0).setVisible(false).setDepth(20);
    this.frame = s.add.graphics();
    const blocker = s.add.zone(W / 2, H / 2, W, H).setInteractive();
    this.root.add([this.frame, blocker]);

    this.icon = s.add.image(64, 132, iconKey('pulse', 1)).setScale(1.1);
    this.title = text(s, 24, 16, '', 24, COLORS.cyan);
    this.level = text(s, 360, 22, '', 16, COLORS.textDim);
    this.perk = text(s, 24, 52, '', 18, COLORS.text, { fontStyle: 'normal' });
    this.root.add([this.icon, this.title, this.level, this.perk]);

    const labels = ['Damage', 'Fire rate', 'Range'];
    labels.forEach((label, i) => {
      const x = 126 + i * 146;
      const card = s.add.graphics();
      drawPanel(card, x, 90, 132, 92, {
        color: 0x28364f, fill: 0x111a2e, corners: false, glow: false, radius: 10,
      });
      this.root.add(card);
      this.root.add(text(s, x + 12, 100, label, 16, COLORS.textDim, { fontStyle: 'normal' }));
      const v = text(s, x + 12, 126, '', 23, COLORS.text);
      const n = text(s, x + 12, 156, '', 18, COLORS.green);
      this.values.push(v);
      this.nexts.push(n);
      this.root.add([v, n]);
    });

    this.upgradeBtn = new NeonButton(s, 750, 104, 252, 64, {
      label: 'UPGRADE',
      fontSize: 21,
      color: COLORS.green,
      panelStyle: { corners: false, radius: 12 },
      onClick: onUpgrade,
    });
    this.upgradeBtn.label?.setY(-12);
    this.upgradeCoin = s.add.image(-18, 14, 'ui_coin').setScale(0.65);
    this.upgradeCost = text(s, -6, 14, '', 20, COLORS.gold).setOrigin(0, 0.5);
    this.upgradeBtn.add([this.upgradeCoin, this.upgradeCost]);

    this.sellBtn = new NeonButton(s, 750, 162, 252, 44, {
      label: 'SELL',
      fontSize: 18,
      color: COLORS.textDim,
      panelStyle: { corners: false, glow: false, radius: 10 },
      onClick: onSell,
    });
    const close = new NeonButton(s, W - 36, 28, 44, 40, {
      icon: Icons.close,
      color: COLORS.textDim,
      panelStyle: { corners: false, glow: false },
      onClick: onClose,
    });
    this.root.add([this.upgradeBtn, this.sellBtn, close]);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  open(tower: Tower, dockTop: boolean, credits: number): void {
    const wasVisible = this.visible && this.tower === tower;
    this.tower = tower;
    this.lastCredits = -1;
    this.rebuild(credits);
    const y = drawerY(this.scene, dockTop, H);
    if (!wasVisible) {
      this.root.setVisible(true).setAlpha(0);
      this.root.y = y + (dockTop ? -20 : 20);
      this.scene.tweens.killTweensOf(this.root);
      this.scene.tweens.add({ targets: this.root, y, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    } else {
      this.root.y = y;
    }
    this.visible = true;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.tower = null;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(false);
  }

  refresh(credits: number): void {
    if (!this.visible || !this.tower || credits === this.lastCredits) return;
    this.lastCredits = credits;
    const next = this.tower.nextStats;
    this.upgradeBtn.setEnabled(!!next && credits >= next.cost);
    if (next) this.upgradeCost.setColor(credits >= next.cost ? css(COLORS.gold) : css(COLORS.red));
  }

  private rebuild(credits: number): void {
    const t = this.tower!;
    const def = t.def;
    const cur = t.stats;
    const next = t.nextStats;

    this.frame.clear();
    drawPanel(this.frame, 0, 0, W, H, {
      color: 0x344963, fillAlpha: 0.98, corners: false, glow: false, radius: 12,
    });
    this.frame.fillStyle(def.color, 0.08);
    this.frame.fillCircle(64, 132, 44);

    this.icon.setTexture(iconKey(def.type, t.level));
    this.title.setText(def.name).setColor(css(def.color));
    this.perk.setText(perkLine(def, cur));
    this.level.setText(`LEVEL ${t.level} / 3`);

    const dmgLabel = (l: TowerLevel) => (def.attack === 'beam' ? `${l.damage}/s` : `${l.damage}`);
    const curText = [dmgLabel(cur), rateLabel(def, cur), `${cur.range}`];
    const nextText = next ? [dmgLabel(next), rateLabel(def, next), `${next.range}`] : ['', '', ''];
    for (let i = 0; i < 3; i++) {
      this.values[i].setText(curText[i]);
      this.nexts[i].setText(next && nextText[i] !== curText[i] ? `Next: ${nextText[i]}` : '');
    }

    if (next) {
      this.upgradeBtn.setLabel('UPGRADE');
      this.upgradeBtn.label?.setY(-12);
      this.upgradeCost.setText(`${next.cost}`).setVisible(true);
      this.upgradeCoin.setVisible(true);
      this.upgradeCost.setX(-6 - this.upgradeCost.width / 2 + 12);
      this.upgradeCoin.setX(this.upgradeCost.x - 18);
    } else {
      this.upgradeBtn.setLabel('MAX LEVEL');
      this.upgradeBtn.label?.setY(0);
      this.upgradeCost.setVisible(false);
      this.upgradeCoin.setVisible(false);
    }
    const refund = Math.floor(t.invested * ECONOMY.sellRefund);
    this.sellBtn.setLabel(`SELL  +${refund}`);
    this.refresh(credits);
  }
}
