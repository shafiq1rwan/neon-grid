import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, HACK, css } from '../config';
import type { ViewBounds } from '../utils/View';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../audio/SoundSystem';
import { fullscreen } from '../utils/Fullscreen';
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
  private readonly fullBtn: NeonButton | null = null;
  readonly pauseBtn: NeonButton;
  private readonly waveBtn: Phaser.GameObjects.Container;
  private readonly waveRing: Phaser.GameObjects.Graphics;
  private readonly waveLabel: Phaser.GameObjects.Text;
  private readonly waveSub: Phaser.GameObjects.Text;
  readonly waveBtnPos: { x: number; y: number };
  /** Left panel and right buttons are pinned to the visible screen edges. */
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  /** Hack charges pill under the stats panel. */
  private readonly hackPill: Phaser.GameObjects.Container;
  private readonly hackPips: Phaser.GameObjects.Graphics;
  private readonly hackBar: Phaser.GameObjects.Graphics;
  private shownCharges = -1;
  private shownChargeFrac = -1;

  private shownHp = -1;
  private shownCredits = -1;
  private coinIcon!: Phaser.GameObjects.Image;
  private shownWave = '';
  private shownSpeed = 0;
  private shownMuted: boolean | null = null;
  private shownFull: boolean | null = null;
  private creditTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: GameScene,
    handlers: {
      onPause: () => void;
      onSpeed: () => void;
      onMute: () => void;
      onCallWave: () => void;
      onHackTip: () => void;
    },
  ) {
    const s = scene;
    const g = s.add.graphics();
    drawPanel(g, 20, 16, 412, 80, {
      color: 0x344963, fillAlpha: 0.96, corners: false, glow: false, radius: 12,
    });
    g.lineStyle(1, 0x344963, 0.6);
    g.lineBetween(150, 34, 150, 78);
    g.lineBetween(278, 34, 278, 78);
    this.progress = s.add.graphics();
    const waveLabel = text(s, 40, 30, 'WAVE', 13, COLORS.textDim);
    this.waveText = text(s, 40, 62, '1/10', 25, COLORS.text).setOrigin(0, 0.5);

    const reactorLabel = text(s, 170, 30, 'REACTOR', 13, COLORS.textDim);
    const creditsLabel = text(s, 298, 30, 'CREDITS', 13, COLORS.textDim);
    this.heart = s.add.image(180, 66, 'ui_heart').setScale(0.75);
    this.hpText = text(s, 204, 66, '20', 25, COLORS.text).setOrigin(0, 0.5);
    const coin = s.add.image(308, 66, 'ui_coin').setScale(0.75);
    this.coinIcon = coin;
    this.creditText = text(s, 332, 66, '0', 25, COLORS.gold).setOrigin(0, 0.5);
    this.left = s.add.container(0, 0, [g, this.progress, waveLabel, reactorLabel, creditsLabel,
      this.waveText, this.heart, this.hpText, coin, this.creditText]);

    // HACK charges: pips fill as charges are earned, the bar shows progress to the next
    const pillBg = s.add.graphics();
    drawPanel(pillBg, -98, -22, 196, 44, { color: COLORS.cyan, fillAlpha: 0.94, corners: false, radius: 12 });
    const hackLabel = text(s, -82, -1, 'HACK', 16, COLORS.cyan).setOrigin(0, 0.5);
    this.hackPips = s.add.graphics();
    this.hackBar = s.add.graphics();
    const pillHit = s.add.zone(0, 0, 196, 44).setInteractive({ useHandCursor: true });
    pillHit.on('pointerup', () => handlers.onHackTip());
    this.hackPill = s.add.container(20 + 98, 104 + 22, [pillBg, hackLabel, this.hackPips, this.hackBar, pillHit]);
    this.left.add(this.hackPill);

    const by = 48;
    this.pauseBtn = new NeonButton(s, GAME_WIDTH - 52, by, 64, 64, {
      icon: Icons.pause,
      onClick: handlers.onPause,
    });
    this.speedBtn = new NeonButton(s, GAME_WIDTH - 128, by, 64, 64, {
      label: '1x',
      fontSize: 24,
      onClick: handlers.onSpeed,
    });
    this.muteBtn = new NeonButton(s, GAME_WIDTH - 204, by, 64, 64, {
      icon: Icons.sound,
      onClick: handlers.onMute,
    });
    this.right = s.add.container(0, 0, [this.muteBtn, this.speedBtn, this.pauseBtn]);
    if (fullscreen.supported) {
      this.fullBtn = new NeonButton(s, GAME_WIDTH - 280, by, 64, 64, {
        icon: Icons.expand,
        onClick: () => fullscreen.toggle(),
      });
      this.right.add(this.fullBtn);
    }

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

  /** Pin the HUD to the visible screen edges (the view can be wider/taller than 1280×720). */
  layout(view: ViewBounds): void {
    this.left.setPosition(view.left, view.top);
    this.right.setScale(1).setPosition(view.right - GAME_WIDTH, view.top);
  }

  /** Pop when a charge is gained; shake red when a hack is denied. */
  pulseHack(gained: boolean): void {
    const pill = this.hackPill;
    this.scene.tweens.killTweensOf(pill);
    pill.setScale(1).setX(20 + 98);
    if (gained) {
      this.scene.tweens.add({ targets: pill, scale: { from: 1.22, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    } else {
      this.scene.tweens.add({ targets: pill, x: pill.x + 7, duration: 45, yoyo: true, repeat: 3 });
    }
  }

  /** Screen position of the hack pill (for popups). */
  get hackAnchor(): { x: number; y: number } {
    return { x: this.left.x + this.hackPill.x, y: this.left.y + this.hackPill.y };
  }

  /** Screen position of the credits coin icon (flying coins land here). */
  get coinAnchor(): { x: number; y: number } {
    return { x: this.left.x + this.coinIcon.x, y: this.left.y + this.coinIcon.y };
  }

  /** The coin icon bounces when a flying coin lands. */
  popCoin(): void {
    const c = this.coinIcon;
    this.scene.tweens.killTweensOf(c);
    c.setScale(1.05);
    this.scene.tweens.add({ targets: c, scale: 0.75, duration: 180, ease: 'Quad.easeOut' });
  }

  /** Screen position just below the credits counter (for toasts). */
  get creditsAnchor(): { x: number; y: number } {
    return { x: this.left.x + 350, y: this.left.y + 116 };
  }

  update(time: number): void {
    const game = this.game;
    const waves = game.waves;

    const charges = game.hack.charges;
    const frac = game.hack.chargeFraction;
    if (charges !== this.shownCharges) {
      this.shownCharges = charges;
      const g = this.hackPips;
      g.clear();
      for (let i = 0; i < HACK.maxCharges; i++) {
        const x = 2 + i * 30;
        const on = i < charges;
        const pts = [
          new Phaser.Geom.Point(x, -11),
          new Phaser.Geom.Point(x + 9, -2),
          new Phaser.Geom.Point(x, 7),
          new Phaser.Geom.Point(x - 9, -2),
        ];
        if (on) {
          g.fillStyle(COLORS.cyan, 0.25);
          g.fillCircle(x, -2, 13);
        }
        g.fillStyle(on ? COLORS.cyan : 0x1a2338, 1);
        g.fillPoints(pts, true);
        g.lineStyle(1.5, on ? 0xe8fdff : 0x2f4061, 1);
        g.strokePoints(pts, true);
      }
    }
    if (Math.abs(frac - this.shownChargeFrac) > 0.001) {
      this.shownChargeFrac = frac;
      const b = this.hackBar;
      b.clear();
      b.fillStyle(0x05080f, 1);
      b.fillRoundedRect(-82, 12, 164, 4, 2);
      b.fillStyle(charges >= HACK.maxCharges ? COLORS.cyan : 0x6fbfd0, 1);
      b.fillRoundedRect(-82, 12, Math.max(4, 164 * frac), 4, 2);
    }

    const waveStr = waves.endless ? `${waves.displayNumber}` : `${waves.displayNumber}/${waves.total}`;
    if (waveStr !== this.shownWave) {
      this.shownWave = waveStr;
      this.waveText.setText(waveStr);
    }

    if (game.hp !== this.shownHp) {
      if (this.shownHp > 0 && game.hp < this.shownHp) {
        this.scene.tweens.add({ targets: this.heart, scale: { from: 1.15, to: 0.75 }, duration: 260 });
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
    if (this.fullBtn && fullscreen.active !== this.shownFull) {
      this.shownFull = fullscreen.active;
      this.fullBtn.setIcon(fullscreen.active ? Icons.collapse : Icons.expand);
    }
    const muted = sfx.isMuted();
    if (muted !== this.shownMuted) {
      this.shownMuted = muted;
      this.muteBtn.setIcon(muted ? Icons.mute : Icons.sound);
    }

    // Small wave markers stay inside the wave column, away from resource values.
    const p = this.progress;
    p.clear();
    const cx0 = 40;
    // endless: the dots count towards the next boss wave (every 10th)
    const first = waves.endless ? Math.floor(Math.max(0, waves.index) / 10) * 10 : 0;
    const count = waves.endless ? 10 : waves.total;
    for (let n = 0; n < count; n++) {
      const i = first + n;
      const done = i < waves.index || (i === waves.index && waves.state !== 'spawning');
      const current = i === waves.index && waves.state === 'spawning';
      const color = done ? COLORS.cyan : current ? COLORS.pink : 0x2a3550;
      const x = cx0 + n * 9;
      p.fillStyle(color, current ? 0.6 + 0.4 * Math.sin(time * 0.01) : 1);
      p.fillRoundedRect(x, 84, 6, 3, 1);
    }

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
