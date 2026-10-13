import Phaser from 'phaser';
import { COLORS } from '../config';
import { sfx } from '../audio/SoundSystem';
import type { WaveSummary } from '../scenes/GameScene';
import { viewBounds, type ViewBounds } from '../utils/View';
import { drawPanel, text } from './widgets';

/** A quick victory beat that leaves the battlefield and controls usable. */
export class WaveClearCard extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Graphics;
  private readonly wave: Phaser.GameObjects.Text;
  private readonly headline: Phaser.GameObjects.Text;
  private readonly kills: Phaser.GameObjects.Text;
  private readonly credits: Phaser.GameObjects.Text;
  private readonly highlights: Phaser.GameObjects.Text;
  private readonly sparks: Phaser.GameObjects.Rectangle[] = [];
  private readonly tally = { progress: 0 };
  private cardHeight = 176;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(30).setVisible(false);
    this.bg = scene.add.graphics();
    this.badge = scene.add.graphics();
    this.badge.fillStyle(COLORS.gold, 0.12).fillCircle(0, 0, 28);
    this.badge.lineStyle(2, COLORS.gold, 0.8).strokeCircle(0, 0, 24);
    // A drawn medal avoids relying on emoji or platform-specific symbol fonts.
    this.badge.fillStyle(COLORS.gold, 1);
    this.badge.fillTriangle(-12, 13, -17, 33, -2, 25);
    this.badge.fillTriangle(12, 13, 17, 33, 2, 25);
    const star: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 16 : 7;
      star.push(new Phaser.Geom.Point(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    this.badge.fillPoints(star, true);
    this.wave = text(scene, 0, 0, '', 13, COLORS.green, { letterSpacing: 2 });
    this.headline = text(scene, 0, 0, '', 30, COLORS.white);
    this.kills = text(scene, 0, 0, '', 27, COLORS.text).setOrigin(0.5);
    this.credits = text(scene, 0, 0, '', 27, COLORS.gold).setOrigin(0.5);
    const killLabel = text(scene, -118, 54, 'MACHINES DESTROYED', 11, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0.5);
    const creditLabel = text(scene, 118, 54, 'CREDITS EARNED', 11, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0.5);
    this.highlights = text(scene, 0, 83, '', 13, COLORS.gold).setOrigin(0.5);
    this.add([this.bg, this.badge, this.wave, this.headline, this.kills, this.credits, killLabel, creditLabel, this.highlights]);
    for (let i = 0; i < 12; i++) {
      const spark = scene.add.rectangle(0, 0, i % 3 === 0 ? 7 : 4, 4, i % 2 ? COLORS.green : COLORS.gold);
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
    this.cardHeight = highlights.length ? 208 : 176;
    const w = 500;
    const top = -this.cardHeight / 2;
    this.bg.clear();
    drawPanel(this.bg, -w / 2, top, w, this.cardHeight, {
      color: COLORS.green, fill: 0x101f2a, fillAlpha: 0.98, radius: 18, corners: false,
    });
    this.bg.fillStyle(COLORS.green, 0.9).fillRoundedRect(-72, top, 144, 3, 1);
    this.bg.lineStyle(1, COLORS.green, 0.16).lineBetween(-218, 4, 218, 4);
    this.bg.lineStyle(1, COLORS.textDim, 0.2).lineBetween(0, 19, 0, 61);
    this.badge.setPosition(-196, top + 50);
    this.wave.setPosition(-150, top + 23).setText(`WAVE ${summary.wave} CLEARED`);
    const praise = summary.perfectHacks > 0 ? 'BRILLIANT WORK!' : summary.bestCombo >= 5 ? 'WHAT A TAKEDOWN!' : 'NICE WORK, DEFENDER!';
    this.headline.setPosition(-150, top + 45).setText(praise).setFontSize(30);
    if (this.headline.width > 375) this.headline.setFontSize(26);
    this.kills.setPosition(-118, 30).setText('0');
    this.credits.setPosition(118, 30).setText('+0');
    this.highlights.setText(highlights.join('   \u00b7   ')).setVisible(highlights.length > 0);
    this.layout(viewBounds(this.scene));
    this.setVisible(true).setAlpha(0).setScale(0.88);
    this.scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.badge.setScale(0.5);
    this.scene.tweens.add({ targets: this.badge, scale: 1, delay: 80, duration: 400, ease: 'Back.easeOut' });
    this.tally.progress = 0;
    this.scene.tweens.add({
      targets: this.tally, progress: 1, delay: 120, duration: 550, ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.kills.setText(`${Math.round(summary.kills * this.tally.progress)}`);
        this.credits.setText(`+${Math.round(summary.earned * this.tally.progress)}`);
      },
    });
    this.sparks.forEach((spark, i) => {
      const side = i % 2 ? 1 : -1;
      spark.setPosition(side * 210, top + 48).setAlpha(1).setAngle(i * 37);
      this.scene.tweens.add({
        targets: spark, x: side * (238 + (i % 3) * 15), y: top - 12 + (i % 6) * 24,
        alpha: 0, angle: spark.angle + side * 100, duration: 650 + (i % 3) * 100, ease: 'Cubic.easeOut',
      });
    });
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 2400, duration: 220, onComplete: () => this.hide() });
    sfx.play('waveClear');
  }

  hide(): void {
    this.scene.tweens.killTweensOf([this, this.badge, this.tally, ...this.sparks]);
    this.setVisible(false);
  }
}
