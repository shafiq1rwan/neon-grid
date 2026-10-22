import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, SCENES, VIEW_PAD, css } from '../config';
import { MAPS } from '../data/maps';
import { CHALLENGES } from '../data/challenges';
import { PERKS, availableStars, perkLevelOf, type PerkDef } from '../data/perks';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { bgKey } from '../rendering/EnvironmentRenderer';
import { fullscreen } from '../utils/Fullscreen';
import { storage } from '../utils/Storage';
import { centerCamera } from '../utils/View';
import { NeonButton, drawPanel, text } from '../ui/widgets';

export interface WorkshopData {
  /** Opened from a result screen: offer to retry that sector. */
  retryMap?: number;
  /** ...in Endless mode. */
  retryEndless?: boolean;
}

interface PerkRow {
  def: PerkDef;
  pips: Phaser.GameObjects.Graphics;
  effect: Phaser.GameObjects.Text;
  next: Phaser.GameObjects.Text;
  buy: NeonButton;
}

const ROW_W = 900;
const ROW_H = 78;

/**
 * Permanent upgrades bought with stars (sector ratings + challenges). The
 * loop it supports: lose → upgrade → retry. No ads here; the ad break happens
 * when a run starts, as everywhere else.
 */
export class WorkshopScene extends Phaser.Scene {
  private rows: PerkRow[] = [];
  private starsLabel!: Phaser.GameObjects.Text;
  private resetBtn!: NeonButton;
  private resetArmed = false;
  private starting = false;
  private retryMap: number | undefined;
  private retryEndless = false;

  constructor() {
    super(SCENES.workshop);
  }

  create(data?: WorkshopData): void {
    this.rows = [];
    this.resetArmed = false;
    this.starting = false;
    this.retryMap = data?.retryMap;
    this.retryEndless = data?.retryEndless ?? false;
    centerCamera(this);
    this.add.image(-VIEW_PAD.x, -VIEW_PAD.y, bgKey(MAPS[0])).setOrigin(0);
    this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, 4720, 0x05080f, 0.82).setOrigin(0);

    const cx = GAME_WIDTH / 2;
    text(this, cx, 52, 'WORKSHOP', 44, COLORS.cyan, { stroke: '#04121a', strokeThickness: 6 }).setOrigin(0.5);
    this.starsLabel = text(this, cx, 100, '', 22, COLORS.gold).setOrigin(0.5);
    const challengeCount = CHALLENGES.slice(0, MAPS.length).reduce((n, list) => n + list.length, 0);
    text(this, cx, 132,
      `Earn stars by clearing sectors (up to ${MAPS.length * 3}) and completing challenges (${challengeCount}).`,
      16, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0.5);

    PERKS.forEach((def, i) => this.rows.push(this.createRow(def, cx - ROW_W / 2, 166 + i * (ROW_H + 10))));

    const by = 640;
    new NeonButton(this, cx - 330, by, 200, 58, {
      label: 'BACK', fontSize: 20, color: COLORS.textDim,
      onClick: () => this.scene.start(SCENES.menu),
    });
    this.resetBtn = new NeonButton(this, cx - 70, by, 220, 58, {
      label: 'RESET', fontSize: 18, color: COLORS.red,
      panelStyle: { corners: false, glow: false },
      onClick: () => this.reset(),
    });
    const retry = this.retryMap;
    const playLabel = retry === undefined ? 'PLAY' : this.retryEndless ? 'RETRY ENDLESS' : `RETRY SECTOR ${retry + 1}`;
    new NeonButton(this, cx + 260, by, 340, 66, {
      label: playLabel, fontSize: 24, color: COLORS.green,
      onClick: () => void this.play(),
    });

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') this.scene.start(SCENES.menu);
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));
    this.refresh();
  }

  private createRow(def: PerkDef, x: number, y: number): PerkRow {
    const g = this.add.graphics();
    drawPanel(g, x, y, ROW_W, ROW_H, { color: 0x344963, fill: 0x111a2e, fillAlpha: 0.96, corners: false, glow: false, radius: 12 });
    g.fillStyle(def.color, 1);
    g.fillRoundedRect(x + 10, y + 12, 6, ROW_H - 24, 3);
    text(this, x + 34, y + 14, def.name, 22, def.color);
    const effect = text(this, x + 34, y + 46, '', 16, COLORS.text, { fontStyle: 'normal' });
    const next = text(this, x + 300, y + 46, '', 16, COLORS.textDim, { fontStyle: 'normal' });
    const pips = this.add.graphics();
    const buy = new NeonButton(this, x + ROW_W - 116, y + ROW_H / 2, 200, 54, {
      label: '', fontSize: 18, color: COLORS.gold,
      onClick: () => this.buy(def),
    });
    return { def, pips, effect, next, buy };
  }

  private refresh(): void {
    const available = availableStars();
    this.starsLabel.setText(`★ ${available} to spend   ·   ${storage.earnedStars} earned`);
    for (const row of this.rows) {
      const { def } = row;
      const level = perkLevelOf(def.id);
      const max = def.costs.length;
      row.effect.setText(level > 0 ? `Now: ${def.describe(level)}` : 'Not upgraded yet');
      row.effect.setColor(css(level > 0 ? COLORS.text : COLORS.textDim));
      row.next.setText(level < max ? `Next: ${def.describe(level + 1)}` : '');
      // level pips under the buy button's left edge
      const g = row.pips;
      g.clear();
      const px = row.buy.x - 150 - max * 22;
      for (let i = 0; i < max; i++) {
        g.fillStyle(i < level ? def.color : 0x2a3550, 1);
        g.fillRoundedRect(px + i * 22, row.buy.y - 6, 16, 12, 4);
      }
      if (level >= max) {
        row.buy.setLabel('MAXED').setEnabled(false);
      } else {
        const cost = def.costs[level];
        row.buy.setLabel(`UPGRADE  ★${cost}`).setEnabled(available >= cost);
      }
    }
  }

  private buy(def: PerkDef): void {
    const level = perkLevelOf(def.id);
    if (level >= def.costs.length) return;
    const cost = def.costs[level];
    if (availableStars() < cost) {
      sfx.play('error');
      return;
    }
    storage.setPerkLevel(def.id, level + 1);
    poki.measure('workshop', `${def.id}-${level + 1}`, 'purchased');
    sfx.play('upgrade');
    this.disarmReset();
    this.refresh();
  }

  /** Two taps: refund every star so the player can rebuild their upgrades. */
  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetBtn.setLabel('TAP TO CONFIRM');
      return;
    }
    storage.update({ perks: {} });
    sfx.play('sell');
    this.disarmReset();
    this.refresh();
  }

  private disarmReset(): void {
    this.resetArmed = false;
    this.resetBtn.setLabel('RESET');
  }

  private async play(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    const retry = this.retryMap;
    if (retry === undefined && storage.starsFor(0) > 0) {
      this.scene.start(SCENES.sectors);
      return;
    }
    fullscreen.enterOnTouchDevices();
    await poki.commercialBreak();
    this.scene.start(SCENES.game, { mapIndex: retry ?? 0, endless: this.retryEndless });
  }
}

