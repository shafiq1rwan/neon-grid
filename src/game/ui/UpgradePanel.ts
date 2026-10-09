import Phaser from 'phaser';
import { COLORS, ECONOMY, GAME_WIDTH, css } from '../config';
import type { TowerDef, TowerLevel } from '../data/towers';
import type { Tower } from '../entities/Tower';
import { iconKey } from '../rendering/TowerRenderer';
import { drawerY, statValues } from './TowerMenu';
import { Icons, NeonButton, drawPanel, statBar, text } from './widgets';

const W = 780;
const H = 160;

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
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
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

    this.icon = s.add.image(78, 80, iconKey('pulse', 1)).setScale(1.3);
    this.title = text(s, 150, 14, '', 22, COLORS.cyan);
    this.pips = s.add.graphics();
    this.perk = text(s, 150, 46, '', 13, COLORS.textDim, { fontStyle: 'normal' });
    this.bars = s.add.graphics();
    this.root.add([this.icon, this.title, this.pips, this.perk, this.bars]);

    const labels = ['Damage', 'Fire rate', 'Range'];
    labels.forEach((label, i) => {
      const y = 78 + i * 24;
      this.root.add(text(s, 150, y - 2, label, 13, COLORS.textDim, { fontStyle: 'normal' }));
      const v = text(s, 390, y - 3, '', 15, COLORS.text);
      const n = text(s, 450, y - 3, '', 15, COLORS.green);
      this.values.push(v);
      this.nexts.push(n);
      this.root.add([v, n]);
    });

    this.upgradeBtn = new NeonButton(s, 650, 56, 210, 64, {
      label: 'UPGRADE',
      fontSize: 20,
      color: COLORS.green,
      onClick: onUpgrade,
    });
    this.upgradeBtn.label?.setY(-11);
    this.upgradeCoin = s.add.image(-18, 14, 'ui_coin').setScale(0.6);
    this.upgradeCost = text(s, -6, 14, '', 17, COLORS.gold).setOrigin(0, 0.5);
    this.upgradeBtn.add([this.upgradeCoin, this.upgradeCost]);

    this.sellBtn = new NeonButton(s, 650, 124, 210, 42, {
      label: 'SELL',
      fontSize: 17,
      color: COLORS.orange,
      onClick: onSell,
    });
    const close = new NeonButton(s, W - 24, 20, 36, 28, {
      icon: Icons.close,
      color: COLORS.textDim,
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
    const y = drawerY(dockTop, H);
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
    drawPanel(this.frame, 0, 0, W, H, { color: def.color, fillAlpha: 0.95 });
    this.frame.fillStyle(def.color, 0.08);
    this.frame.fillCircle(78, 80, 60);

    this.icon.setTexture(iconKey(def.type, t.level));
    this.title.setText(def.name).setColor(css(def.color));
    this.perk.setText(perkLine(def, next ?? cur));

    const pg = this.pips;
    pg.clear();
    const px = this.title.x + this.title.width + 18;
    for (let i = 0; i < 3; i++) {
      const filled = i < t.level;
      const cx = px + i * 18;
      pg.fillStyle(filled ? def.color : 0x1a2338, 1);
      pg.fillPoints(
        [
          new Phaser.Geom.Point(cx, 18),
          new Phaser.Geom.Point(cx + 7, 27),
          new Phaser.Geom.Point(cx, 36),
          new Phaser.Geom.Point(cx - 7, 27),
        ],
        true,
      );
      pg.lineStyle(1, def.color, 0.8);
      pg.strokePoints(
        [
          new Phaser.Geom.Point(cx, 18),
          new Phaser.Geom.Point(cx + 7, 27),
          new Phaser.Geom.Point(cx, 36),
          new Phaser.Geom.Point(cx - 7, 27),
        ],
        true,
      );
    }

    const vc = statValues(def, t.level - 1);
    const vn = next ? statValues(def, t.level) : null;
    const bg = this.bars;
    bg.clear();
    const curVals = [vc.damage, vc.rate, vc.range];
    const nextVals = vn ? [vn.damage, vn.rate, vn.range] : [];
    for (let i = 0; i < 3; i++) {
      statBar(bg, 228, 78 + i * 24 + 4, 150, curVals[i], def.color, vn ? nextVals[i] : undefined);
    }
    const dmgLabel = (l: TowerLevel) => (def.attack === 'beam' ? `${l.damage}/s` : `${l.damage}`);
    const curText = [dmgLabel(cur), rateLabel(def, cur), `${cur.range}`];
    const nextText = next ? [dmgLabel(next), rateLabel(def, next), `${next.range}`] : ['', '', ''];
    for (let i = 0; i < 3; i++) {
      this.values[i].setText(curText[i]);
      this.nexts[i].setText(next && nextText[i] !== curText[i] ? `→ ${nextText[i]}` : '');
    }

    if (next) {
      this.upgradeBtn.setLabel('UPGRADE');
      this.upgradeBtn.label?.setY(-11);
      this.upgradeCost.setText(`${next.cost}`).setVisible(true);
      this.upgradeCoin.setVisible(true);
      this.upgradeCost.setX(-6 - this.upgradeCost.width / 2 + 12);
      this.upgradeCoin.setX(this.upgradeCost.x - 13);
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
