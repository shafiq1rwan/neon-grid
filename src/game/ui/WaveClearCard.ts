import Phaser from 'phaser';
import { COLORS } from '../config';
import { sfx } from '../audio/SoundSystem';
import type { WaveSummary } from '../scenes/GameScene';
import { viewBounds, type ViewBounds } from '../utils/View';
import { bakeShape, drawPanel, text } from './widgets';

/** Same footprint as the wave banner, so the two read as one family and never cover the HUD. */
const W = 400;
const H_PLAIN = 104;
const H_HIGHLIGHTS = 128;
const PAD = 8;

/** A quick victory beat that leaves the battlefield and controls usable. */
export class WaveClearCard extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly badge: Phaser.GameObjects.Image;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly headline: Phaser.GameObjects.Text;
  private readonly kills: Phaser.GameObjects.Text;
  private readonly killLabel: Phaser.GameObjects.Text;
  private readonly credits: Phaser.GameObjects.Text;
  private readonly creditLabel: Phaser.GameObjects.Text;
  private readonly highlights: Phaser.GameObjects.Text;
  private readonly sparks: Phaser.GameObjects.Rectangle[] = [];
  private readonly tally = { progress: 0 };
  private cardHeight = H_PLAIN;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(30).setVisible(false);
    // static art is baked once (see bakeShape)
    for (const h of [H_PLAIN, H_HIGHLIGHTS]) {
      bakeShape(scene, `wave_clear_bg|${h}`, W + PAD * 2, h + PAD * 2, (g) => {
        drawPanel(g, PAD, PAD, W, h, {
          color: COLORS.green, fill: 0x101f2a, fillAlpha: 0.98, radius: 14, corners: false, glow: false, sheen: false,
        });
        g.fillStyle(COLORS.green, 0.9).fillRoundedRect(PAD + W / 2 - 56, PAD, 112, 3, 1);
        g.lineStyle(1, COLORS.green, 0.16).lineBetween(PAD + 18, PAD + 58, PAD + W - 18, PAD + 58);
        g.lineStyle(1, COLORS.textDim, 0.22).lineBetween(PAD + W / 2, PAD + 66, PAD + W / 2, PAD + 96);
      });
    }
    const medal = bakeShape(scene, 'wave_clear_medal', 48, 52, (g) => {
      g.fillStyle(COLORS.gold, 0.12).fillCircle(24, 22, 21);
      g.lineStyle(2, COLORS.gold, 0.8).strokeCircle(24, 22, 18);
      // a drawn medal avoids relying on emoji or platform-specific symbol fonts
      g.fillStyle(COLORS.gold, 1);
      g.fillTriangle(15, 32, 11, 50, 22, 43);
      g.fillTriangle(33, 32, 37, 50, 26, 43);
      const star: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 12 : 5.2;
        star.push(new Phaser.Geom.Point(24 + Math.cos(a) * r, 22 + Math.sin(a) * r));
      }
      g.fillPoints(star, true);
    });
    this.bg = scene.add.image(0, 0, `wave_clear_bg|${H_PLAIN}`);
    this.badge = scene.add.image(0, 0, medal);
    this.wave = text(scene, 0, 0, '', 12, COLORS.green, { letterSpacing: 2 }).setOrigin(0, 0.5);
    this.headline = text(scene, 0, 0, '', 22, COLORS.white).setOrigin(0, 0.5);
    this.kills = text(scene, 0, 0, '', 20, COLORS.text).setOrigin(1, 0.5);
    this.killLabel = text(scene, 0, 0, 'DESTROYED', 11, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0, 0.5);
    this.credits = text(scene, 0, 0, '', 20, COLORS.gold).setOrigin(1, 0.5);
    this.creditLabel = text(scene, 0, 0, 'CREDITS', 11, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0, 0.5);
    this.highlights = text(scene, 0, 0, '', 12, COLORS.gold, { letterSpacing: 1 }).setOrigin(0.5);
    this.add([this.bg, this.badge, this.wave, this.headline, this.kills, this.killLabel,
      this.credits, this.creditLabel, this.highlights]);
    for (let i = 0; i < 10; i++) {
      const spark = scene.add.rectangle(0, 0, i % 3 === 0 ? 6 : 4, 3, i % 2 ? COLORS.green : COLORS.gold);
      this.sparks.push(spark);
      this.add(spark);
    }
  }

  layout(view: ViewBounds): void {
    this.setPosition(view.left + view.width / 2, view.top + 16 + this.cardHeight / 2);
  }

  show(summary: WaveSummary): void {
    this.hide();
    const highlights: string[] = [];
    if (summary.perfectHacks > 0) highlights.push(`${summary.perfectHacks} PERFECT HACK${summary.perfectHacks === 1 ? '' : 'S'}`);
    if (summary.bestCombo > 0) highlights.push(`BEST COMBO x${summary.bestCombo}`);
    this.cardHeight = highlights.length ? H_HIGHLIGHTS : H_PLAIN;
    const top = -this.cardHeight / 2;
    this.bg.setTexture(`wave_clear_bg|${this.cardHeight}`);
    // header row: medal + "WAVE N CLEARED" + headline, all inside the top 58 px
    this.badge.setPosition(-W / 2 + 40, top + 30);
    this.wave.setPosition(-W / 2 + 72, top + 19).setText(`WAVE ${summary.wave} CLEARED`);
    const praise = summary.perfectHacks > 0 ? 'BRILLIANT WORK!' : summary.bestCombo >= 5 ? 'WHAT A TAKEDOWN!' : 'NICE WORK, DEFENDER!';
    this.headline.setPosition(-W / 2 + 72, top + 40).setText(praise).setFontSize(22);
    if (this.headline.width > W - 92) this.headline.setFontSize(19);
    // stats row: two halves around the divider, value then label, centred in each half
    const statY = top + 81;
    this.placeStat(this.kills, this.killLabel, -W / 4, statY);
    this.placeStat(this.credits, this.creditLabel, W / 4, statY);
    this.kills.setText('0');
    this.credits.setText('+0');
    this.highlights.setText(highlights.join('   ·   ')).setPosition(0, top + 112).setVisible(highlights.length > 0);
    this.layout(viewBounds(this.scene));
    this.setVisible(true).setAlpha(0).setScale(0.9);
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.badge.setScale(0.5);
    this.scene.tweens.add({ targets: this.badge, scale: 1, delay: 80, duration: 380, ease: 'Back.easeOut' });
    this.tally.progress = 0;
    this.scene.tweens.add({
      targets: this.tally, progress: 1, delay: 120, duration: 550, ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.kills.setText(`${Math.round(summary.kills * this.tally.progress)}`);
        this.credits.setText(`+${Math.round(summary.earned * this.tally.progress)}`);
        this.placeStat(this.kills, this.killLabel, -W / 4, statY);
        this.placeStat(this.credits, this.creditLabel, W / 4, statY);
      },
    });
    // sparks fan out from the medal and stay close to the card
    this.sparks.forEach((spark, i) => {
      spark.setPosition(this.badge.x, this.badge.y).setAlpha(1).setAngle(i * 36);
      const a = (i / this.sparks.length) * Math.PI * 2;
      this.scene.tweens.add({
        targets: spark, x: this.badge.x + Math.cos(a) * 34, y: this.badge.y + Math.sin(a) * 26,
        alpha: 0, angle: spark.angle + 120, duration: 520 + (i % 3) * 80, ease: 'Cubic.easeOut',
      });
    });
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 2400, duration: 220, onComplete: () => this.hide() });
    sfx.play('waveClear');
  }

  /** Value and label side by side, the pair centred on `cx`. */
  private placeStat(value: Phaser.GameObjects.Text, label: Phaser.GameObjects.Text, cx: number, y: number): void {
    const gap = 8;
    const total = value.width + gap + label.width;
    const left = cx - total / 2;
    value.setPosition(left + value.width, y);
    label.setPosition(left + value.width + gap, y + 1);
  }

  hide(): void {
    this.scene.tweens.killTweensOf([this, this.badge, this.tally, ...this.sparks]);
    this.setVisible(false);
  }
}
