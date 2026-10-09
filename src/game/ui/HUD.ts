import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, css } from '../config';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../audio/SoundSystem';
import { Icons, NeonButton, drawPanel, text } from './widgets';

/** Always-visible heads-up display: wave, reactor HP, credits and controls. */
export class HUD {
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly creditText: Phaser.GameObjects.Text;
  private readonly heart: Phaser.GameObjects.Image;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly speedBtn: NeonButton;
  private readonly muteBtn: NeonButton;
  readonly pauseBtn: NeonButton;
  private readonly waveBtn: Phaser.GameObjects.Container;
  private readonly waveRing: Phaser.GameObjects.Graphics;
  private readonly waveLabel: Phaser.GameObjects.Text;
  private readonly waveSub: Phaser.GameObjects.Text;
  readonly waveBtnPos: { x: number; y: number };

  private shownHp = -1;
  private shownCredits = -1;
  private shownWave = '';
  private shownSpeed = 0;
  private shownMuted: boolean | null = null;
  private creditTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: GameScene,
    handlers: { onPause: () => void; onSpeed: () => void; onMute: () => void; onCallWave: () => void },
  ) {
    const s = scene;
    const g = s.add.graphics();
    drawPanel(g, 12, 12, 316, 80, { color: COLORS.cyan });
    this.progress = s.add.graphics();
    text(s, 28, 19, 'WAVE', 14, COLORS.textDim, { letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle);
    this.waveText = text(s, 80, 12, '1/10', 24, COLORS.text);

    this.heart = s.add.image(38, 70, 'ui_heart').setScale(0.85);
    this.hpText = text(s, 56, 70, '20', 24, COLORS.text).setOrigin(0, 0.5);
    s.add.image(150, 70, 'ui_coin').setScale(0.85);
    this.creditText = text(s, 168, 70, '0', 24, COLORS.gold).setOrigin(0, 0.5);

    const by = 44;
    this.pauseBtn = new NeonButton(s, GAME_WIDTH - 46, by, 62, 54, {
      icon: Icons.pause,
      onClick: handlers.onPause,
    });
    this.speedBtn = new NeonButton(s, GAME_WIDTH - 116, by, 62, 54, {
      label: '1x',
      fontSize: 24,
      onClick: handlers.onSpeed,
    });
    this.muteBtn = new NeonButton(s, GAME_WIDTH - 186, by, 62, 54, {
      icon: Icons.sound,
      onClick: handlers.onMute,
    });

    // "call next wave" beacon near the road entrance
    const wp = game.map.waveButton;
    this.waveBtnPos = { x: wp.x, y: wp.y };
    this.waveBtn = s.add.container(wp.x, wp.y);
    this.waveRing = s.add.graphics();
    this.waveLabel = text(s, 0, 46, 'START', 15, COLORS.text, {
      stroke: '#05080f',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.waveSub = text(s, 0, 64, '', 13, COLORS.gold, { stroke: '#05080f', strokeThickness: 4 }).setOrigin(0.5);
    const icon = s.add.graphics();
    Icons.chevrons(icon, COLORS.red);
    this.waveBtn.add([this.waveRing, icon, this.waveLabel, this.waveSub]);
    const hit = s.add.zone(0, 10, 96, 110).setInteractive({ useHandCursor: true });
    this.waveBtn.add(hit);
    hit.on('pointerdown', () => this.waveBtn.setScale(0.92));
    hit.on('pointerout', () => this.waveBtn.setScale(1));
    hit.on('pointerup', () => {
      this.waveBtn.setScale(1);
      sfx.play('click');
      handlers.onCallWave();
    });
    s.tweens.add({
      targets: icon,
      scale: { from: 0.9, to: 1.12 },
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(time: number): void {
    const game = this.game;
    const waves = game.waves;

    const waveStr = `${waves.displayNumber}/${waves.total}`;
    if (waveStr !== this.shownWave) {
      this.shownWave = waveStr;
      this.waveText.setText(waveStr);
    }

    if (game.hp !== this.shownHp) {
      if (this.shownHp > 0 && game.hp < this.shownHp) {
        this.scene.tweens.add({ targets: this.heart, scale: { from: 1.3, to: 0.85 }, duration: 260 });
        this.hpText.setColor('#ff526f');
        this.scene.time.delayedCall(260, () => this.hpText.setColor(css(COLORS.text)));
      }
      this.shownHp = game.hp;
      this.hpText.setText(`${Math.max(0, game.hp)}`);
    }

    const credits = game.economy.credits;
    if (credits !== this.shownCredits) {
      const up = credits > this.shownCredits && this.shownCredits >= 0;
      this.shownCredits = credits;
      this.creditText.setText(`${credits}`);
      if (up) {
        this.creditTween?.stop();
        this.creditText.setScale(1.15);
        this.creditTween = this.scene.tweens.add({ targets: this.creditText, scale: 1, duration: 160 });
      }
    }

    if (game.speed !== this.shownSpeed) {
      this.shownSpeed = game.speed;
      this.speedBtn.setLabel(game.speed === 2 ? '2x' : '1x');
      this.speedBtn.setColor(game.speed === 2 ? COLORS.orange : COLORS.cyan);
    }
    const muted = sfx.isMuted();
    if (muted !== this.shownMuted) {
      this.shownMuted = muted;
      this.muteBtn.setIcon(muted ? Icons.mute : Icons.sound);
    }

    // wave progress bar + chevrons
    const p = this.progress;
    p.clear();
    const cx0 = 168;
    for (let i = 0; i < waves.total; i++) {
      const done = i < waves.index || (i === waves.index && waves.state !== 'spawning');
      const current = i === waves.index && waves.state === 'spawning';
      const color = done ? COLORS.cyan : current ? COLORS.pink : 0x2a3550;
      const x = cx0 + i * 14;
      p.lineStyle(3, color, current ? 0.6 + 0.4 * Math.sin(time * 0.01) : 1);
      p.beginPath();
      p.moveTo(x, 20);
      p.lineTo(x + 6, 27);
      p.lineTo(x, 34);
      p.strokePath();
    }
    let frac = 0;
    if (waves.state === 'spawning') frac = waves.spawned / Math.max(1, waves.totalInWave);
    else if (waves.state === 'complete') frac = 1;
    else frac = 1 - waves.countdown / Math.max(1, waves.countdownMax);
    p.fillStyle(0x05080f, 1);
    p.fillRoundedRect(28, 44, 284, 6, 3);
    p.fillStyle(waves.state === 'spawning' ? COLORS.pink : COLORS.cyan, 1);
    p.fillRoundedRect(28, 44, Math.max(6, 284 * frac), 6, 3);

    // wave call beacon
    const show = waves.canCallNext && !game.over;
    this.waveBtn.setVisible(show);
    if (show) {
      const r = this.waveRing;
      r.clear();
      r.fillStyle(0x0d1424, 0.92);
      r.fillCircle(0, 0, 30);
      r.lineStyle(6, COLORS.red, 0.15);
      r.strokeCircle(0, 0, 33);
      r.lineStyle(2, COLORS.red, 0.9);
      r.strokeCircle(0, 0, 30);
      if (!waves.hold) {
        const k = Phaser.Math.Clamp(waves.countdown / Math.max(1, waves.countdownMax), 0, 1);
        r.lineStyle(4, COLORS.gold, 1);
        r.beginPath();
        r.arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        r.strokePath();
      }
      const first = waves.index < 0;
      const secs = Math.ceil(waves.countdown);
      this.waveLabel.setText(first ? 'START' : `WAVE ${waves.index + 2}`);
      const bonus = waves.earlyBonus;
      this.waveSub.setText(waves.hold ? 'tap to begin' : bonus > 0 ? `${secs}s · +${bonus}` : `${secs}s`);
    }
  }

}
