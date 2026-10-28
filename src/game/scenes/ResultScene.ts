import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES, css } from '../config';
import { MAPS } from '../data/maps';
import { availableStars } from '../data/perks';
import { poki } from '../platform/PokiAdapter';
import { storage } from '../utils/Storage';
import { sfx } from '../audio/SoundSystem';
import { NeonButton, bakeShape, drawPanel, text } from '../ui/widgets';
import { bakeTexture, glow, noGlow, type Ctx } from '../rendering/CanvasKit';
import { centerCamera, viewBounds } from '../utils/View';
import type { GameScene, ResultData } from './GameScene';

/** Textures are baked at this resolution and shown at 1/RES for crisp edges. */
const RES = 2;

function starPath(ctx: Ctx, cx: number, cy: number, r: number, inner = 0.46): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Glitch state for the REACTOR LOST title. */
interface LostFx {
  t: number;
  title: Phaser.GameObjects.Text;
  red: Phaser.GameObjects.Text;
  cyan: Phaser.GameObjects.Text;
  /** Real seconds until the next small glitch, and how long the current one lasts. */
  next: number;
  burst: number;
}

/** Victory / defeat overlay, shown above the paused battlefield. */
export class ResultScene extends Phaser.Scene {
  private busy = false;
  private lost: LostFx | null = null;

  constructor() {
    super(SCENES.result);
  }

  create(data: ResultData): void {
    this.busy = false;
    this.lost = null;
    centerCamera(this);
    const { victory, endless } = data;
    const accent = victory || endless?.newBest ? COLORS.cyan : COLORS.red;
    const cx = GAME_WIDTH / 2;
    // Vertical rhythm: about 24 px between groups and 10-13 px inside a group.
    const panelH = data.canRevive ? 500 : 484;
    const py = (GAME_HEIGHT - panelH) / 2;
    const celebrate = victory || !!endless?.newBest;
    const hasNext = victory && data.mapIndex < MAPS.length - 1;
    const campaignDone = victory && !hasNext;
    const offerEndless = victory && storage.endlessUnlocked;
    const showWorkshop = storage.earnedStars > 0;
    const spare = availableStars();
    const map = MAPS[data.mapIndex];

    const dim = this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, GAME_HEIGHT + 4000, 0x03050a, 0)
      .setOrigin(0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.82, duration: 400 });
    if (celebrate) this.confetti();

    const root = this.resultPanel(py, panelH, accent);
    const context = text(this, cx, py + 30,
      `SECTOR ${String(data.mapIndex + 1).padStart(2, '0')}  /  ${map.name.toUpperCase()}${endless ? '  /  ENDLESS' : ''}`,
      14, COLORS.textDim, { letterSpacing: 2 }).setOrigin(0.5);
    if (context.width > 464) context.setFontSize(12);
    root.add(context);
    const title = text(this, cx, py + 72,
      endless ? (endless.newBest ? 'NEW BEST!' : 'RUN OVER')
        : campaignDone ? 'CAMPAIGN COMPLETE' : victory ? 'SECTOR SECURED' : 'REACTOR LOST',
      campaignDone ? 32 : 38, accent).setOrigin(0.5);
    root.add(title);
    if (celebrate) {
      title.setScale(1.15).setAlpha(0);
      this.tweens.add({ targets: title, scale: 1, alpha: 1, delay: 120, duration: 420, ease: 'Back.easeOut' });
    }

    if (victory) {
      this.ratingStars(root, cx, py + 148, data.stars);
      if (data.stars === 3) root.add(this.perfectStamp(cx, py + 196, 1100));
      else root.add(text(this, cx, py + 196, `${data.stars} / 3 STARS`, 16, COLORS.gold,
        { letterSpacing: 2 }).setOrigin(0.5));
    } else {
      root.add(text(this, cx, py + 112, 'WAVE REACHED', 14, COLORS.textDim,
        { letterSpacing: 2 }).setOrigin(0.5));
      root.add(text(this, cx, py + 154, String(endless?.reached ?? data.wave).padStart(2, '0'),
        64, COLORS.text).setOrigin(0.5));
      root.add(text(this, cx, py + 198,
        endless ? `PERSONAL BEST  /  ${endless.best}` : `OF ${data.totalWaves} WAVES`,
        14, COLORS.textDim, { letterSpacing: 2 }).setOrigin(0.5));
    }

    const newChallenges = data.challenges.filter((c) => c.isNew).length;
    const reward = endless ? endless.newStars : newChallenges;
    const caption = reward > 0
      ? `+${reward} \u2605 ${endless ? 'milestone' : 'challenge'} reward${reward === 1 ? '' : 's'}`
      : endless ? 'Push further on your next run.'
        : campaignDone ? 'All sectors secured. Keep the streak going.'
          : victory ? `Sector ${data.mapIndex + 2} unlocked` : 'Rebuild. Come back stronger.';
    root.add(text(this, cx, py + 226, caption, 17, reward > 0 ? COLORS.gold : COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0.5));

    // Only the two most useful numbers stay in the summary.
    const statsKey = bakeShape(this, 'result_summary_stats', 464, 72, (g) => {
      g.fillStyle(COLORS.raised, 0.28);
      g.fillRoundedRect(0, 0, 464, 72, 10);
      g.lineStyle(1, COLORS.textDim, 0.18);
      g.lineBetween(232, 16, 232, 56);
    });
    root.add(this.add.image(cx, py + 294, statsKey));
    const kills = text(this, cx - 116, py + 283, `${data.kills}`, 25, COLORS.text).setOrigin(0.5);
    root.add(kills);
    root.add(text(this, cx + 116, py + 283,
      victory ? `${data.hp} / ${data.maxHp}` : this.runTime(data.time), 25, COLORS.text).setOrigin(0.5));
    root.add(text(this, cx - 116, py + 310, 'MACHINES DESTROYED', 12, COLORS.textDim,
      { letterSpacing: 1 }).setOrigin(0.5));
    root.add(text(this, cx + 116, py + 310, victory ? 'REACTOR HP' : 'TIME SURVIVED',
      12, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0.5));
    if (celebrate && data.kills > 0) {
      kills.setText('0');
      this.tweens.addCounter({
        from: 0, to: data.kills, delay: 380, duration: 900, ease: 'Cubic.easeOut',
        onUpdate: (tw) => kills.setText(`${Math.round(tw.getValue() ?? 0)}`),
      });
    }

    const actionY = py + 385;
    if (data.canRevive) {
      // Keep the opt-in ad explicit, non-green, and the same size as Retry.
      root.add(this.primaryAction(cx - 122, actionY, 220, 'RETRY', () => void this.playAgain()));
      const revive = new NeonButton(this, cx + 122, actionY, 220, 62, {
        label: 'REVIVE +10 HP', fontSize: 18, color: COLORS.gold,
        panelStyle: { corners: false, glow: false, radius: 12 },
        onClick: () => void this.revive(revive),
      });
      // Poki rule: the rewarded button shows a video icon (drawn to match the neon style)
      revive.label?.setX(16);
      revive.add(this.add.image(-76, 0, this.adIcon()).setScale(1 / RES));
      root.add(revive);
      root.add(text(this, cx + 122, actionY + 49, 'Watch an ad', 14, COLORS.textDim,
        { fontStyle: 'normal' }).setOrigin(0.5));
    } else if (hasNext && offerEndless) {
      // v1.2.3 fit test: this button started most Endless runs (the longest sessions), so it stays on the main screen
      root.add(this.primaryAction(cx - 122, actionY, 220, 'NEXT SECTOR  →', () => void this.nextSector(data.mapIndex + 1)));
      root.add(new NeonButton(this, cx + 122, actionY, 220, 62, {
        label: 'TRY ENDLESS  ∞', fontSize: 19, color: COLORS.purple,
        panelStyle: { corners: false, glow: false, radius: 12 },
        onClick: () => void this.tryEndless(data.mapIndex),
      }));
    } else {
      root.add(this.primaryAction(cx, actionY, 464,
        hasNext ? 'NEXT SECTOR  \u2192' : campaignDone && offerEndless ? 'PLAY ENDLESS  \u221e' : victory ? 'PLAY AGAIN' : 'RETRY',
        () => hasNext ? void this.nextSector(data.mapIndex + 1)
          : campaignDone && offerEndless ? void this.tryEndless(data.mapIndex) : void this.playAgain()));
    }

    const details = this.createDetails(data, offerEndless, () => {
      if (this.busy) return;
      details.setVisible(false);
      root.setVisible(true);
    });
    const footerY = py + panelH - 34;
    root.add(this.quietAction(cx - (showWorkshop ? 172 : 100), footerY, 96, 'Menu', () => this.toMenu()));
    root.add(this.quietAction(cx + (showWorkshop ? -12 : 100), footerY, 150, 'Run details', () => {
      if (this.busy) return;
      root.setVisible(false);
      details.setVisible(true);
    }));
    if (showWorkshop) {
      root.add(this.quietAction(cx + 158, footerY, 164, spare > 0 ? `Workshop \u00b7 \u2605 ${spare}` : 'Workshop',
        () => this.toWorkshop(data.mapIndex, !!endless), spare > 0 ? COLORS.gold : COLORS.textDim));
    }

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape' && details.visible && !this.busy) {
        details.setVisible(false);
        root.setVisible(true);
      }
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));
    root.setAlpha(0).setY(20);
    this.tweens.add({ targets: root, alpha: 1, y: 0, duration: 380, ease: 'Cubic.easeOut' });
    if (!victory && !endless) this.glitchTitle(root, title);
  }

  /* REACTOR LOST: a glitching title -------------------------------------- */

  /** The REACTOR LOST title splits into red / cyan and jitters like a lost signal. */
  private glitchTitle(root: Phaser.GameObjects.Container, title: Phaser.GameObjects.Text): void {
    const size = 38; // the REACTOR LOST title size
    const red = text(this, title.x, title.y, title.text, size, 0xff3355)
      .setOrigin(0.5).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const cyan = text(this, title.x, title.y, title.text, size, COLORS.cyan)
      .setOrigin(0.5).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    root.addAt([red, cyan], root.getIndex(title));
    sfx.play('glitch');
    // a strong burst as the panel appears, then small silent glitches now and then
    this.lost = { t: 0, title, red, cyan, next: 2.6, burst: 0.9 };
  }

  update(_time: number, delta: number): void {
    const fx = this.lost;
    if (!fx) return;
    const dt = Math.min(delta, 50) / 1000;
    fx.t += dt;
    fx.next -= dt;
    if (fx.next <= 0) {
      fx.burst = 0.14 + Math.random() * 0.12;
      fx.next = 2.4 + Math.random() * 2; // visual only: a repeating sound would nag on this screen
    }
    const glitching = fx.burst > 0;
    if (glitching) fx.burst -= dt;
    const amp = glitching ? (fx.t < 1 ? 7 : 4) : 0;
    const { x, y } = fx.title;
    fx.red.setPosition(x - 2 - Math.random() * amp, y + (Math.random() - 0.5) * amp * 0.6);
    fx.cyan.setPosition(x + 2 + Math.random() * amp, y + (Math.random() - 0.5) * amp * 0.6);
    fx.red.setAlpha(glitching ? 0.85 : 0.35);
    fx.cyan.setAlpha(glitching ? 0.7 : 0.28);
    fx.title.setX(GAME_WIDTH / 2 + (glitching ? (Math.random() - 0.5) * amp : 0));
    // the letters briefly flicker during a glitch
    fx.title.setAlpha(glitching && Math.random() < 0.25 ? 0.4 : 1);
  }

  /** Neon "watch a video" clapperboard (baked once). */
  private adIcon(): string {
    const key = 'ui_ad_video';
    if (!this.textures.exists(key)) {
      bakeTexture(this, key, 40 * RES, 36 * RES, (ctx) => {
        ctx.scale(RES, RES);
        ctx.lineJoin = 'round';
        const gold = css(COLORS.gold);
        glow(ctx, COLORS.gold, 6);
        // board
        ctx.fillStyle = '#1a2338';
        ctx.strokeStyle = gold;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(5, 13, 30, 19, 3);
        ctx.fill();
        ctx.stroke();
        // clapper with stripes
        ctx.beginPath();
        ctx.moveTo(5, 11);
        ctx.lineTo(33, 4);
        ctx.lineTo(34.5, 9.5);
        ctx.lineTo(6.5, 16);
        ctx.closePath();
        ctx.fillStyle = gold;
        ctx.fill();
        noGlow(ctx);
        ctx.fillStyle = '#1a2338';
        for (let i = 0; i < 3; i++) {
          const sx = 11 + i * 7.5;
          ctx.beginPath();
          ctx.moveTo(sx, 10.2 - i * 1.85);
          ctx.lineTo(sx + 3.5, 9.3 - i * 1.85);
          ctx.lineTo(sx + 1.5, 13.6 - i * 1.85);
          ctx.lineTo(sx - 2, 14.5 - i * 1.85);
          ctx.closePath();
          ctx.fill();
        }
        // play triangle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(17, 17.5);
        ctx.lineTo(25.5, 22.5);
        ctx.lineTo(17, 27.5);
        ctx.closePath();
        ctx.fill();
      });
    }
    return key;
  }

  private resultPanel(y: number, height: number, accent: number): Phaser.GameObjects.Container {
    const key = bakeShape(this, `result_panel|${height}|${accent}`, 552, height + 16, (g) => {
      drawPanel(g, 8, 8, 536, height, {
        color: COLORS.raised, fill: COLORS.panel, fillAlpha: 1, radius: 20, corners: false, glow: false, sheen: false,
      });
      g.fillStyle(accent, 0.9);
      g.fillRoundedRect(240, 8, 72, 3, 1.5);
    });
    const root = this.add.container(0, 0);
    root.add(this.add.image(GAME_WIDTH / 2, y + height / 2, key));
    return root;
  }

  /** Neon rating stars: glowing gold with a bevelled face, or a dim neon slot. */
  private starTextures(): { on: string; off: string } {
    const size = 92;
    const c = size / 2;
    const r = 33;
    if (!this.textures.exists('result_star_neon_on')) {
      bakeTexture(this, 'result_star_neon_on', size * RES, size * RES, (ctx) => {
        ctx.scale(RES, RES);
        ctx.lineJoin = 'round';
        glow(ctx, COLORS.gold, 14);
        const fill = ctx.createLinearGradient(c - r, c - r, c + r * 0.6, c + r);
        fill.addColorStop(0, '#fff3b0');
        fill.addColorStop(0.45, css(COLORS.gold));
        fill.addColorStop(1, '#e08a1e');
        starPath(ctx, c, c + 2, r);
        ctx.fillStyle = fill;
        ctx.fill();
        noGlow(ctx);
        ctx.strokeStyle = '#7a4a10';
        ctx.lineWidth = 2;
        ctx.stroke();
        // bevelled inner face
        starPath(ctx, c, c + 2, r * 0.55);
        ctx.fillStyle = 'rgba(255, 250, 220, 0.42)';
        ctx.fill();
        // sparkle on the top point
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(c - 5, c - r * 0.42, 3.2, 6, -0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (!this.textures.exists('result_star_neon_off')) {
      bakeTexture(this, 'result_star_neon_off', size * RES, size * RES, (ctx) => {
        ctx.scale(RES, RES);
        ctx.lineJoin = 'round';
        starPath(ctx, c, c + 2, r);
        ctx.fillStyle = '#0d1424';
        ctx.fill();
        glow(ctx, COLORS.cyan, 5);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        noGlow(ctx);
        starPath(ctx, c, c + 2, r * 0.55);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    return { on: 'result_star_neon_on', off: 'result_star_neon_off' };
  }

  private ratingStars(root: Phaser.GameObjects.Container, cx: number, y: number, earned: number): void {
    const { off: starOff, on: starOn } = this.starTextures();
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 82;
      const sy = y + (i === 1 ? -8 : 0);
      root.add(this.add.image(sx, sy, starOff).setScale(1 / RES));
      if (i >= earned) continue;
      const star = this.add.image(sx, sy, starOn).setScale(0);
      root.add(star);
      this.tweens.add({
        targets: star, scale: 1 / RES, delay: 300 + i * 260, duration: 380, ease: 'Back.easeOut',
        onStart: () => {
          sfx.play(i === 0 ? 'star1' : i === 1 ? 'star2' : 'star3');
          if (root.visible) this.sparkle(sx, sy);
        },
      });
    }
  }

  private primaryAction(x: number, y: number, width: number, label: string, onClick: () => void): NeonButton {
    const btn = new NeonButton(this, x, y, width, 62, {
      label, fontSize: 21, color: COLORS.cyan, fill: COLORS.cyan,
      panelStyle: { corners: false, glow: false, radius: 12 }, onClick,
    });
    btn.label?.setColor(css(COLORS.bg));
    return btn;
  }

  /** Full touch targets without another glowing button frame. */
  private quietAction(x: number, y: number, width: number, label: string, onClick: () => void,
    color: number = COLORS.textDim): Phaser.GameObjects.Container {
    const link = this.add.container(x, y);
    const labelText = text(this, 0, 0, label, 16, color, { fontStyle: 'normal' }).setOrigin(0.5);
    const hit = this.add.zone(0, 0, width, 48).setInteractive({ useHandCursor: true });
    let pressed = false;
    hit.on('pointerdown', () => { pressed = true; });
    hit.on('pointerover', () => labelText.setColor(css(COLORS.text)));
    hit.on('pointerout', () => { pressed = false; labelText.setColor(css(color)); });
    hit.on('pointerup', () => {
      if (!pressed || this.busy) return;
      pressed = false;
      sfx.play('click');
      onClick();
    });
    link.add([labelText, hit]);
    return link;
  }

  private runTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  }

  private createDetails(data: ResultData, offerEndless: boolean, onBack: () => void): Phaser.GameObjects.Container {
    const cx = GAME_WIDTH / 2;
    const py = (GAME_HEIGHT - 560) / 2;
    const root = this.resultPanel(py, 560, COLORS.textDim).setVisible(false);
    root.add(text(this, cx - 232, py + 43, 'RUN DETAILS', 28, COLORS.text).setOrigin(0, 0.5));
    root.add(this.quietAction(cx + 190, py + 43, 84, 'Back', onBack));
    root.add(text(this, cx - 232, py + 78,
      `${MAPS[data.mapIndex].name}${data.endless ? ' / Endless' : ''}`, 16, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0, 0.5));
    const rows: [string, string][] = [
      ['Waves survived', data.endless ? `${Math.max(0, data.endless.reached - 1)}`
        : `${data.victory ? data.totalWaves : Math.max(0, data.wave - 1)} / ${data.totalWaves}`],
      ['Machines destroyed', `${data.kills}`],
      ['Reactor HP', `${data.hp} / ${data.maxHp}`],
      ['Credits earned', `${data.earned}`],
      ['Time', this.runTime(data.time)],
    ];
    rows.forEach(([label, value], i) => {
      const y = py + 125 + i * 32;
      root.add(text(this, cx - 232, y, label, 17, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0, 0.5));
      root.add(text(this, cx + 232, y, value, 18, COLORS.text).setOrigin(1, 0.5));
    });
    root.add(this.add.rectangle(cx, py + 282, 464, 1, COLORS.raised));
    root.add(text(this, cx - 232, py + 313, data.endless ? 'MILESTONES' : 'SECTOR CHALLENGES',
      13, COLORS.textDim, { letterSpacing: 2 }).setOrigin(0, 0.5));
    if (data.challenges.length === 0) {
      root.add(text(this, cx - 232, py + 352, data.endless ? 'Reach wave 10 to earn your first milestone.' : 'No challenges this run.',
        16, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0, 0.5));
    }
    data.challenges.forEach((c, i) => {
      const y = py + 352 + i * 32;
      root.add(text(this, cx - 232, y, c.met ? '\u2713' : '\u2013', 18, c.met ? COLORS.green : COLORS.textDim).setOrigin(0, 0.5));
      root.add(text(this, cx - 206, y, c.text, 16, c.met ? COLORS.text : COLORS.textDim,
        { fontStyle: 'normal' }).setOrigin(0, 0.5));
      root.add(text(this, cx + 232, y, c.isNew ? '+1 \u2605' : c.met ? 'Done' : '',
        15, c.isNew ? COLORS.gold : COLORS.textDim).setOrigin(1, 0.5));
    });
    if (data.victory) {
      const replay = new NeonButton(this, offerEndless ? cx - 122 : cx, py + 489, offerEndless ? 220 : 464, 56, {
        label: 'REPLAY SECTOR', fontSize: 18, color: COLORS.textDim,
        panelStyle: { corners: false, glow: false, radius: 12 }, onClick: () => void this.playAgain(),
      });
      root.add(replay);
      if (offerEndless) root.add(new NeonButton(this, cx + 122, py + 489, 220, 56, {
        label: 'TRY ENDLESS \u221e', fontSize: 18, color: COLORS.purple,
        panelStyle: { corners: false, glow: false, radius: 12 }, onClick: () => void this.tryEndless(data.mapIndex),
      }));
    } else {
      root.add(this.primaryAction(cx, py + 489, 464, 'BACK TO RESULT', onBack));
    }
    return root;
  }

  /** Neon confetti falling across the whole view, behind the panel. */
  private confetti(): void {
    const view = viewBounds(this);
    const emitter = this.add.particles(0, 0, 'fx_dot', {
      x: { min: view.left, max: view.right },
      y: view.top - 12,
      lifespan: 2600,
      speedY: { min: 140, max: 300 },
      speedX: { min: -70, max: 70 },
      gravityY: 90,
      rotate: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0.35 },
      alpha: { start: 1, end: 0.2 },
      tint: [COLORS.cyan, COLORS.pink, COLORS.gold, COLORS.green, COLORS.purple],
      quantity: 3,
      frequency: 25,
    });
    this.time.delayedCall(1100, () => emitter.stop());
    this.time.delayedCall(4000, () => emitter.destroy());
  }

  /** Small gold burst where a star lands. */
  private sparkle(x: number, y: number): void {
    const burst = this.add.particles(x, y, 'fx_dot', {
      lifespan: 500,
      speed: { min: 80, max: 190 },
      scale: { start: 0.6, end: 0 },
      tint: [COLORS.gold, 0xffffff],
      emitting: false,
    }).setDepth(10);
    burst.explode(14);
    this.time.delayedCall(700, () => burst.destroy());
  }

  /** Keep the perfect-rating flourish inside the star group. */
  private perfectStamp(x: number, y: number, delay: number): Phaser.GameObjects.Text {
    const stamp = text(this, x, y, 'PERFECT DEFENSE', 16, COLORS.gold, { letterSpacing: 2 })
      .setOrigin(0.5).setScale(1.15).setAlpha(0);
    this.tweens.add({
      targets: stamp, scale: 1, alpha: 1, delay, duration: 240, ease: 'Back.easeOut',
      onStart: () => sfx.play('stamp'),
    });
    return stamp;
  }

  private get gameScene(): GameScene {
    return this.scene.get(SCENES.game) as GameScene;
  }

  private async revive(btn: NeonButton): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const ok = await poki.rewardedBreak();
    this.busy = false;
    if (ok) {
      this.scene.stop();
      this.gameScene.revive();
    } else {
      btn.setLabel('Ad unavailable').setEnabled(false);
    }
  }

  private async playAgain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await poki.commercialBreak();
    this.scene.stop();
    this.gameScene.scene.restart();
  }

  /** Start Endless on the map that was just cleared. */
  private async tryEndless(mapIndex: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    poki.measure('endless-entry', 'result', 'clicked');
    await poki.commercialBreak();
    this.scene.stop();
    this.gameScene.scene.restart({ mapIndex, endless: true });
  }

  private async nextSector(index: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await poki.commercialBreak();
    this.scene.stop();
    this.gameScene.scene.restart({ mapIndex: index });
  }

  /** Lose → upgrade → retry: the Workshop offers to restart this sector. */
  private toWorkshop(mapIndex: number, endless: boolean): void {
    if (this.busy) return;
    this.scene.stop(SCENES.ui);
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.workshop, { retryMap: mapIndex, retryEndless: endless });
  }

  private toMenu(): void {
    if (this.busy) return;
    this.scene.stop(SCENES.ui);
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.menu);
  }
}
