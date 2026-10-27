import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES, css } from '../config';
import { centerCamera, viewBounds } from '../utils/View';
import { ENEMIES } from '../data/enemies';
import { newEnemiesInWave, newTowersInMap } from '../data/maps';
import { TOWERS } from '../data/towers';
import { iconKey } from '../rendering/TowerRenderer';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { enemyKey } from '../rendering/EnemyRenderer';
import { storage } from '../utils/Storage';
import { challengeProgress, challengesFor, needsWin } from '../data/challenges';
import { isBossWave, newEndlessEnemies } from '../data/endless';
import { HUD } from '../ui/HUD';
import { WaveClearCard } from '../ui/WaveClearCard';
import { TowerMenu } from '../ui/TowerMenu';
import { Tutorial } from '../ui/Tutorial';
import { HackHint } from '../ui/HackHint';
import { BuildNudge, type NudgeTarget } from '../ui/BuildNudge';
import { UpgradePanel } from '../ui/UpgradePanel';
import { NeonButton, bakeShape, drawPanel, text } from '../ui/widgets';
import { GameEvents, type GameScene, type Selection, type WaveSummary } from './GameScene';

/** Overlay scene for HUD, menus, banners, tutorial and the pause screen. */
export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private hud!: HUD;
  private menu!: TowerMenu;
  private panel!: UpgradePanel;
  private tutorial: Tutorial | null = null;
  private hackHint: HackHint | null = null;
  private buildNudge: BuildNudge | null = null;
  /** Pooled coins that fly from kills to the credits counter. */
  private coinPool: Phaser.GameObjects.Image[] = [];
  /** Platforms ordered by how much road they cover (best spot to suggest first). */
  private platformOrder: number[] = [];
  private cheapestTower = 0;
  private readonly nudgeTarget: NudgeTarget = { kind: 'build', x: 0, y: 0, first: false };
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseContent!: Phaser.GameObjects.Container;
  private pauseDetails!: Phaser.GameObjects.Container;
  private pauseSound!: Phaser.GameObjects.Text;
  private pauseContext!: Phaser.GameObjects.Text;
  private pauseWave!: Phaser.GameObjects.Text;
  private pauseReactor!: Phaser.GameObjects.Text;
  private pauseHint!: Phaser.GameObjects.Text;
  private pauseChallengeLink!: Phaser.GameObjects.Container;
  private pauseChallengeRows!: Phaser.GameObjects.Container;
  private pauseEndlessBest!: Phaser.GameObjects.Text;
  private pauseResume!: NeonButton;
  private pauseLeaving = false;
  private banner!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private bannerEnemy!: Phaser.GameObjects.Text;
  private bannerIcon!: Phaser.GameObjects.Image;
  private bannerBg!: Phaser.GameObjects.Image;
  private bannerHeight = 64;
  private summary!: WaveClearCard;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super(SCENES.ui);
  }

  create(): void {
    this.gs = this.scene.get(SCENES.game) as GameScene;
    this.tutorial = null;
    this.unsubscribe = [];
    this.pauseLeaving = false;

    this.hud = new HUD(this, this.gs, {
      onPause: () => this.gs.pauseGame(),
      onSpeed: () => this.gs.toggleSpeed(),
      onMute: () => this.toggleMute(),
      onCallWave: () => this.callWave(),
      onHackTip: () => this.toast('TAP A MACHINE ON THE ROAD TO HACK IT', false),
    });

    this.menu = new TowerMenu(
      this,
      this.gs.map.towers,
      (type) => this.gs.buildTower(type),
      () => this.gs.deselect(),
    );
    this.panel = new UpgradePanel(
      this,
      () => { if (this.gs.upgradeSelected()) this.buildNudge?.acted('upgrade'); },
      () => this.gs.sellSelected(),
      () => this.gs.deselect(),
    );

    this.createBanner();
    this.summary = new WaveClearCard(this);
    this.showTowerUnlock();
    this.createPauseLayer();
    let lastW = 0;
    let lastH = 0;
    let lastDisplayedW = 0;
    let lastDisplayedH = 0;
    centerCamera(this, (view) => {
      this.hud.layout(view);
      this.summary.layout(view);
      this.pauseHint.setVisible(this.scale.canvas.clientWidth >= 1000
        && !window.matchMedia('(pointer: coarse)').matches);
      this.banner.setPosition(view.left + view.width / 2, view.top + 16 + this.bannerHeight / 2);
      // drawers are positioned when opened; close them if the screen changes shape
      const displayed = this.scale.canvas.getBoundingClientRect();
      if (view.width !== lastW || view.height !== lastH
        || displayed.width !== lastDisplayedW || displayed.height !== lastDisplayedH) {
        if (lastW !== 0) this.gs.deselect();
        lastW = view.width;
        lastH = view.height;
        lastDisplayedW = displayed.width;
        lastDisplayedH = displayed.height;
      }
    });

    this.listen(GameEvents.selection, (sel: Selection) => this.onSelection(sel));
    this.listen(GameEvents.towerBuilt, () => {
      this.tutorial?.advance('start');
      this.buildNudge?.acted('build');
    });
    // hints end as soon as the action starts
    this.listen(GameEvents.waveStart, () => this.tutorial?.finish());
    this.listen(GameEvents.waveStart, (index: number) => this.onWaveStart(index));
    this.listen(GameEvents.waveBonus, (amount: number) => this.toast(`WAVE BONUS +${amount}`));
    this.listen(GameEvents.combo, (count: number, x: number, y: number) => this.showCombo(count, x, y));
    this.coinPool = [];
    for (let i = 0; i < 14; i++) {
      this.coinPool.push(this.add.image(0, 0, 'ui_coin').setDepth(45).setVisible(false));
    }
    this.listen(GameEvents.coins, (x: number, y: number) => this.flyCoin(x, y));
    this.listen(GameEvents.waveCleared, (s: WaveSummary) => this.showWaveSummary(s));
    this.listen(GameEvents.hackCharge, () => {
      this.hud.pulseHack(true);
      const a = this.hud.hackAnchor;
      this.floatText(a.x + 120, a.y, '+1 HACK', '#7ff6ff');
    });
    this.listen(GameEvents.hackDenied, (reason: string) => {
      if (reason === 'charge') this.hud.pulseHack(false);
    });
    this.listen(GameEvents.hacked, () => {
      if (!this.hackHint) return;
      storage.update({ hackTipDone: true });
      this.hackHint.destroy();
      this.hackHint = null;
    });
    this.listen(GameEvents.paused, () => this.showPause(true));
    this.listen(GameEvents.resumed, () => this.showPause(false));
    this.listen(GameEvents.gameOver, () => {
      this.menu.close();
      this.panel.close();
      this.summary.hide();
      this.tutorial?.finish();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.unsubscribe) off();
      this.unsubscribe = [];
    });

    const kb = this.input.keyboard;
    const onPauseKey = (ev: KeyboardEvent) => {
      if (this.gs.isPaused && (ev.code === 'Escape' || ev.code === 'KeyP')) {
        ev.stopPropagation();
        if (!ev.repeat && !this.pauseLeaving && !poki.isAdPlaying) this.gs.resumeGame();
      }
    };
    kb?.on('keydown', onPauseKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb?.off('keydown', onPauseKey));

    if (!storage.data.tutorialDone && !this.gs.endless && this.gs.map.tutorialPlatform !== undefined) this.startTutorial();
    this.hackHint = storage.data.hackTipDone ? null : new HackHint(this);
    // players who haven't cleared Sector 1 yet get "build more" nudges
    this.buildNudge = storage.starsFor(0) > 0 ? null : new BuildNudge(this);
    this.platformOrder = this.rankPlatforms();
    this.cheapestTower = Math.min(...this.gs.map.towers.map((t) => TOWERS[t].levels[0].cost));
  }

  private listen<T extends unknown[]>(event: string, fn: (...args: T) => void): void {
    const handler = fn as (...args: unknown[]) => void;
    this.gs.events.on(event, handler);
    this.unsubscribe.push(() => this.gs.events.off(event, handler));
  }

  private startTutorial(): void {
    const g = this.gs;
    const platform = g.map.platforms[g.map.tutorialPlatform ?? 0];
    poki.measure('level', 'tutorial', 'start');
    this.tutorial = new Tutorial(this, {
      platform,
      waveButton: this.hud.waveBtnPos,
      pulseCard: () => this.menu.cardCenter('pulse'),
      finish: () => {
        storage.update({ tutorialDone: true });
        poki.measure('level', 'tutorial', 'complete');
        this.tutorial = null;
      },
    });
  }

  private callWave(): void {
    // always works, tutorial or not; the tutorial ends on the waveStart event
    this.gs.callNextWave();
  }

  private toggleMute(): void {
    const muted = !sfx.isMuted();
    sfx.setMuted(muted);
    storage.update({ muted });
  }

  private onSelection(sel: Selection): void {
    const g = this.gs;
    if (sel.kind === 'none') {
      const wasOpen = this.menu.isOpen;
      this.menu.close();
      this.panel.close();
      if (wasOpen) this.tutorial?.menuClosed();
      return;
    }
    const p = g.map.platforms[sel.index];
    const dockTop = p.y > 400;
    if (sel.kind === 'platform') {
      this.panel.close();
      this.menu.open(dockTop, g.economy.credits);
      if (this.tutorial?.step === 'platform') this.tutorial.advance('pick');
    } else {
      this.menu.close();
      const tower = g.towers.at(sel.index);
      if (tower) this.panel.open(tower, dockTop, g.economy.credits);
    }
  }

  /* -------------------------------------------------------------- */

  private createBanner(): void {
    this.banner = this.add.container(GAME_WIDTH / 2, 210).setVisible(false).setDepth(30);
    this.bannerBg = this.add.image(0, 0, '__DEFAULT');
    this.bannerTitle = text(this, 0, 0, '', 22, COLORS.text).setOrigin(0.5);
    this.bannerEnemy = text(this, -96, -12, '', 22, COLORS.text).setVisible(false);
    this.bannerSub = text(this, -96, 18, '', 16, COLORS.textDim, {
      fontStyle: 'normal', wordWrap: { width: 272 }, lineSpacing: 3,
    }).setVisible(false);
    this.bannerIcon = this.add.image(-148, 0, enemyKey('drone')).setVisible(false);
    this.banner.add([this.bannerBg, this.bannerTitle, this.bannerEnemy, this.bannerIcon, this.bannerSub]);
  }

  private onWaveStart(index: number): void {
    this.summary.hide();
    const total = this.gs.waves.total;
    const endless = this.gs.waves.endless;
    const isFinal = !endless && index === total - 1;
    const boss = endless && isBossWave(index + 1);
    const fresh = (endless ? newEndlessEnemies(index + 1) : newEnemiesInWave(this.gs.mapIndex, index)).filter((t) => t !== 'mini');
    const introducesEnemy = fresh.length > 0;
    const waveLabel = isFinal ? 'FINAL WAVE' : boss ? `BOSS WAVE ${index + 1}`
      : endless ? `WAVE ${index + 1}` : `WAVE ${index + 1} / ${total}`;
    const accent = isFinal || boss ? COLORS.red : introducesEnemy ? ENEMIES[fresh[0]].color : COLORS.cyan;
    this.bannerTitle.setText(introducesEnemy ? `${waveLabel}  /  NEW ENEMY` : waveLabel);
    this.bannerTitle.setColor(css(isFinal || boss ? COLORS.red : introducesEnemy ? COLORS.textDim : COLORS.text));
    this.bannerTitle.setFontSize(introducesEnemy ? 12 : 22);
    this.bannerTitle.setLetterSpacing(introducesEnemy ? 1 : 0);
    const w = introducesEnemy ? 400 : 248;
    let h = 56;
    this.bannerEnemy.setVisible(introducesEnemy);
    this.bannerSub.setVisible(introducesEnemy);
    this.bannerIcon.setVisible(introducesEnemy);
    if (introducesEnemy) {
      const def = ENEMIES[fresh[0]];
      this.bannerEnemy.setText(def.name).setFontSize(22);
      if (this.bannerEnemy.width > 272) this.bannerEnemy.setFontSize(20);
      this.bannerSub.setText(def.tip);
      this.bannerIcon.setTexture(enemyKey(def.type)).setScale(def.radius > 15 ? 0.65 : 1);
      h = Math.max(104, 78 + this.bannerSub.height);
      this.bannerTitle.setPosition(-96, -h / 2 + 16).setOrigin(0);
      this.bannerEnemy.setPosition(-96, -h / 2 + 36);
      this.bannerSub.setPosition(-96, -h / 2 + 66);
      this.bannerIcon.setPosition(-148, 0);
    } else {
      this.bannerTitle.setPosition(0, 0).setOrigin(0.5);
    }
    const key = bakeShape(this, `wave_banner|${w}|${h}|${accent}`, w + 16, h + 16, (g) => {
      drawPanel(g, 8, 8, w, h, {
        color: COLORS.raised, fill: COLORS.panel, fillAlpha: 0.98, corners: false, glow: false, radius: 14,
      });
      g.fillStyle(accent, 0.85);
      g.fillRoundedRect(8, 28, 3, h - 40, 1.5);
      if (introducesEnemy) {
        g.fillStyle(accent, 0.08);
        g.fillCircle(60, h / 2 + 8, 30);
      }
    });
    this.bannerBg.setTexture(key);
    this.bannerHeight = h;
    const view = viewBounds(this);
    this.banner.setPosition(view.left + view.width / 2, view.top + 16 + h / 2);
    this.tweens.killTweensOf(this.banner);
    this.banner.setVisible(true).setAlpha(0).setScale(1);
    this.tweens.add({ targets: this.banner, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    this.tweens.add({
      targets: this.banner, alpha: 0,
      delay: introducesEnemy ? 3200 : 1200,
      duration: 200, onComplete: () => this.banner.setVisible(false),
    });
  }

  private showWaveSummary(s: WaveSummary): void {
    if (this.gs.over) return;
    this.tweens.killTweensOf(this.banner);
    this.banner.setVisible(false);
    this.summary.show(s);
  }

  /** A coin arcs from the kill to the credits counter (skipped when the pool is busy). */
  private flyCoin(x: number, y: number): void {
    const coin = this.coinPool.find((c) => !c.visible);
    if (!coin) return;
    const to = this.hud.coinAnchor;
    coin.setPosition(x, y).setScale(0.9).setAlpha(1).setVisible(true);
    // rise a little first, then swoop into the counter
    this.tweens.add({
      targets: coin, y: y - 26, duration: 160, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: coin, x: to.x, y: to.y, scale: 0.6, duration: 420, ease: 'Cubic.easeIn',
          onComplete: () => {
            coin.setVisible(false);
            this.hud.popCoin();
          },
        });
      },
    });
  }

  /** "x4 COMBO!" popping up where one blast, missile or chain took out several machines. */
  private showCombo(count: number, x: number, y: number): void {
    const big = count >= 5;
    const t = text(this, x, y - 30, `x${count} COMBO!`, big ? 30 : 24, big ? COLORS.pink : COLORS.gold, {
      stroke: '#05080f', strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setDepth(28)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, y: y - 70, alpha: 0, delay: 650, duration: 450,
      onComplete: () => t.destroy(),
    });
    sfx.play('coin');
  }

  /** First visit to a sector that adds a tower: a short "NEW TOWER UNLOCKED" reveal. */
  private showTowerUnlock(): void {
    const index = this.gs.mapIndex;
    if (index === 0 || storage.starsFor(index) > 0) return;
    const fresh = newTowersInMap(index);
    if (fresh.length === 0) return;
    const def = TOWERS[fresh[0]];
    const view = viewBounds(this);
    const c = this.add.container(GAME_WIDTH / 2, view.top + 200).setDepth(35).setAlpha(0);
    const w = 520;
    const h = 150;
    const g = this.add.graphics();
    drawPanel(g, -w / 2, -h / 2, w, h, { color: def.color, fillAlpha: 0.97, radius: 14 });
    g.fillStyle(def.color, 0.1);
    g.fillCircle(-w / 2 + 80, 0, 58);
    const icon = this.add.image(-w / 2 + 80, 2, iconKey(def.type, 1)).setScale(1.05);
    const head = text(this, -w / 2 + 160, -h / 2 + 24, 'NEW TOWER UNLOCKED', 16, COLORS.gold);
    const name = text(this, -w / 2 + 160, -h / 2 + 48, def.name, 30, def.color);
    const desc = text(this, -w / 2 + 160, -h / 2 + 92, def.description, 17, COLORS.text, {
      fontStyle: 'normal',
      wordWrap: { width: w - 190 },
    });
    c.add([g, icon, head, name, desc]);
    this.tweens.add({ targets: c, alpha: 1, y: c.y + 10, duration: 260, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: icon, scale: 1.2, duration: 500, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 4200, duration: 350, onComplete: () => c.destroy() });
    sfx.play('upgrade');
  }

  private toast(message: string, coinSound = true): void {
    const at = this.hud.creditsAnchor;
    const t = text(this, at.x, at.y, message, 16, COLORS.gold, { stroke: '#05080f', strokeThickness: 4 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: at.y - 6, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
    if (coinSound) sfx.play('coin');
  }

  private createPauseLayer(): void {
    const cx = GAME_WIDTH / 2;
    const py = (GAME_HEIGHT - 448) / 2;
    const c = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, GAME_HEIGHT + 4000, 0x03050a, 0.82)
      .setOrigin(0).setInteractive();
    const frame = bakeShape(this, 'pause_panel_v2', 496, 464, (g) => {
      drawPanel(g, 8, 8, 480, 448, {
        color: COLORS.raised, fill: COLORS.panel, fillAlpha: 1, radius: 20, glow: false, corners: false,
      });
      g.fillStyle(COLORS.cyan, 0.9);
      g.fillRoundedRect(212, 8, 72, 3, 1.5);
    });
    c.add([dim, this.add.image(cx, GAME_HEIGHT / 2, frame)]);
    const main = this.add.container(0, 0);
    this.pauseContext = text(this, cx, py + 32, '', 13, COLORS.textDim, { letterSpacing: 1.5 }).setOrigin(0.5);
    const title = text(this, cx, py + 80, 'PAUSED', 38, COLORS.cyan).setOrigin(0.5);
    const stats = bakeShape(this, 'pause_stats_v2', 408, 72, (g) => {
      g.fillStyle(COLORS.raised, 0.28);
      g.fillRoundedRect(0, 0, 408, 72, 10);
      g.lineStyle(1, COLORS.textDim, 0.18);
      g.lineBetween(204, 16, 204, 56);
    });
    main.add(this.add.image(cx, py + 154, stats));
    this.pauseWave = text(this, cx - 102, py + 143, '', 25, COLORS.text).setOrigin(0.5);
    this.pauseReactor = text(this, cx + 102, py + 143, '', 25, COLORS.text).setOrigin(0.5);
    main.add([this.pauseContext, title, this.pauseWave, this.pauseReactor,
      text(this, cx - 102, py + 170, 'WAVE', 12, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0.5),
      text(this, cx + 102, py + 170, 'REACTOR HP', 12, COLORS.textDim, { letterSpacing: 1 }).setOrigin(0.5),
    ]);
    const sound = this.pauseLink(cx - 106, py + 220, 196, '', () => {
      this.toggleMute();
      this.updatePauseSound();
    });
    this.pauseSound = sound.getAt<Phaser.GameObjects.Text>(0);
    this.pauseChallengeLink = this.pauseLink(cx + 106, py + 220, 196, 'Challenges  \u2192', () => {
      main.setVisible(false);
      this.pauseDetails.setVisible(true);
    });
    this.pauseEndlessBest = text(this, cx + 106, py + 220, '', 16, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0.5).setVisible(false);
    this.pauseResume = new NeonButton(this, cx, py + 296, 408, 62, {
      label: 'RESUME  \u2192', fontSize: 21, color: COLORS.cyan, fill: COLORS.cyan,
      panelStyle: { corners: false, glow: false, radius: 12 },
      onClick: () => { if (!this.pauseLeaving) this.gs.resumeGame(); },
    });
    this.pauseResume.label?.setColor(css(COLORS.bg));
    this.pauseHint = text(this, cx, py + 341, 'P / Esc to resume', 13, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0.5);
    main.add([sound, this.pauseChallengeLink, this.pauseEndlessBest, this.pauseResume, this.pauseHint,
      this.add.rectangle(cx, py + 370, 408, 1, COLORS.raised),
      this.pauseLink(cx - 106, py + 402, 196, 'Restart', () => void this.restart()),
      this.pauseLink(cx + 106, py + 402, 196, 'Main menu', () => this.quitToMenu()),
    ]);

    this.pauseDetails = this.add.container(0, 0).setVisible(false);
    this.pauseChallengeRows = this.add.container(0, 0);
    const back = new NeonButton(this, cx, py + 374, 408, 56, {
      label: 'BACK TO PAUSE', fontSize: 19, color: COLORS.cyan,
      panelStyle: { corners: false, glow: false, radius: 12 },
      onClick: () => {
        this.pauseDetails.setVisible(false);
        main.setVisible(true);
      },
    });
    this.pauseDetails.add([
      text(this, cx, py + 56, 'CHALLENGES', 30, COLORS.text).setOrigin(0.5),
      text(this, cx, py + 98, 'Earn one Workshop star per challenge.', 16, COLORS.textDim,
        { fontStyle: 'normal' }).setOrigin(0.5),
      this.pauseChallengeRows, back,
    ]);
    c.add([main, this.pauseDetails]);
    this.pauseContent = main;
    this.pauseLayer = c;
  }

  /** Quiet links keep a full-sized touch target. */
  private pauseLink(x: number, y: number, width: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const link = this.add.container(x, y);
    const labelText = text(this, 0, 0, label, 16, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0.5);
    const hit = this.add.zone(0, 0, width, 48).setInteractive({ useHandCursor: true });
    let pressed = false;
    hit.on('pointerdown', () => { pressed = true; });
    hit.on('pointerover', () => labelText.setColor(css(COLORS.text)));
    hit.on('pointerout', () => { pressed = false; labelText.setColor(css(COLORS.textDim)); });
    hit.on('pointerup', () => {
      if (!pressed || this.pauseLeaving) return;
      pressed = false;
      sfx.play('click');
      onClick();
    });
    link.add([labelText, hit]);
    return link;
  }

  private updatePauseSound(): void {
    this.pauseSound.setText(sfx.isMuted() ? 'Sound off' : 'Sound on');
  }

  private updatePauseChallenges(): void {
    this.pauseChallengeRows.removeAll(true);
    const list = this.gs.endless ? [] : challengesFor(this.gs.mapIndex);
    const cx = GAME_WIDTH / 2;
    const py = (GAME_HEIGHT - 448) / 2;
    const card = bakeShape(this, 'pause_challenge_v2', 408, 80, (g) => {
      g.fillStyle(COLORS.raised, 0.28);
      g.fillRoundedRect(0, 0, 408, 80, 10);
    });
    list.forEach((challenge, i) => {
      const y = py + 178 + i * 96;
      const done = storage.hasChallenge(challenge.id);
      this.pauseChallengeRows.add([
        this.add.image(cx, y, card),
        text(this, cx - 184, y - 14, challenge.text, 18, COLORS.text).setOrigin(0, 0.5),
        text(this, cx - 184, y + 16, done ? 'Star already earned' : needsWin(challenge) ? 'Requires victory' : 'Progress this run',
          14, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0, 0.5),
        text(this, cx + 184, y + 16, done ? '\u2713 Done' : challengeProgress(challenge, this.gs.runStats),
          16, done ? COLORS.green : COLORS.gold).setOrigin(1, 0.5),
      ]);
    });
  }

  private showPause(show: boolean): void {
    if (show) {
      this.updatePauseSound();
      this.pauseContext.setText(`SECTOR ${String(this.gs.mapIndex + 1).padStart(2, '0')}  /  ${this.gs.map.name.toUpperCase()}${this.gs.endless ? '  /  ENDLESS' : ''}`)
        .setFontSize(13);
      if (this.pauseContext.width > 408) this.pauseContext.setFontSize(11);
      this.pauseWave.setText(this.gs.endless ? `${this.gs.waves.displayNumber}`
        : `${this.gs.waves.displayNumber} / ${this.gs.waves.total}`);
      this.pauseReactor.setText(`${Math.max(0, this.gs.hp)} / ${this.gs.maxHp}`);
      this.pauseChallengeLink.setVisible(!this.gs.endless && challengesFor(this.gs.mapIndex).length > 0);
      this.pauseEndlessBest.setVisible(this.gs.endless).setText(`Best wave ${storage.endlessBestFor(this.gs.mapIndex)}`);
      this.updatePauseChallenges();
      this.pauseContent.setVisible(true);
      this.pauseDetails.setVisible(false);
      this.menu.close();
      this.panel.close();
    }
    this.pauseLayer.setVisible(show);
  }

  private async restart(): Promise<void> {
    if (this.pauseLeaving) return;
    this.pauseLeaving = true;
    this.pauseResume.setLabel('RESTARTING...').setEnabled(false);
    this.pauseHint.setVisible(false);
    await poki.commercialBreak();
    this.scene.stop(SCENES.result);
    this.gs.scene.restart();
  }

  private quitToMenu(): void {
    if (this.pauseLeaving) return;
    this.pauseLeaving = true;
    poki.gameplayStop();
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.menu);
  }

  update(_time: number, delta: number): void {
    const credits = this.gs.economy.credits;
    this.hud.update(this.time.now);
    this.menu.refresh(credits);
    this.panel.refresh(credits);
    if (!this.gs.isPaused) this.tutorial?.update(delta / 1000);
    this.updateHackHint(delta / 1000);
    this.updateBuildNudge(delta / 1000);
  }

  /** Platform indices, most road within reach first. */
  private rankPlatforms(): number[] {
    const gs = this.gs;
    const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
    const reach = 150 * 150;
    return gs.map.platforms
      .map((p, i) => {
        let n = 0;
        for (const path of gs.paths) {
          let seg = 0;
          for (let d = 0; d < path.length; d += 20) {
            seg = path.sample(d, s, seg);
            if ((s.x - p.x) ** 2 + (s.y - p.y) ** 2 < reach) n++;
          }
        }
        return { i, n };
      })
      .sort((a, b) => b.n - a.n)
      .map((c) => c.i);
  }

  private updateBuildNudge(dt: number): void {
    const nudge = this.buildNudge;
    if (!nudge) return;
    const gs = this.gs;
    const blocked = gs.over || gs.isPaused || !!this.tutorial?.active || gs.selection.kind !== 'none'
      || !!gs.hack.target || !!this.hackHint?.visible;
    nudge.update(this.findNudgeTarget(), blocked, dt, viewBounds(this));
  }

  /** An empty platform the player can afford to build on, or else an affordable upgrade. */
  private findNudgeTarget(): NudgeTarget | null {
    const gs = this.gs;
    const credits = gs.economy.credits;
    const out = this.nudgeTarget;
    let hasEmpty = false;
    for (const i of this.platformOrder) {
      if (gs.towers.at(i)) continue;
      hasEmpty = true;
      if (credits < this.cheapestTower) break;
      const p = gs.map.platforms[i];
      out.kind = 'build';
      out.x = p.x;
      out.y = p.y;
      out.first = gs.towers.count === 0;
      return out;
    }
    if (hasEmpty) return null;
    // cheapest affordable upgrade (no allocations: this runs every frame)
    let best: (typeof gs.towers.towers)[number] = null;
    let bestCost = Infinity;
    for (const t of gs.towers.towers) {
      const next = t?.nextStats;
      if (!t || !next || next.cost > credits || next.cost >= bestCost) continue;
      best = t;
      bestCost = next.cost;
    }
    if (!best) return null;
    out.kind = 'upgrade';
    out.first = false;
    out.x = best.x;
    out.y = best.y;
    return out;
  }

  /** Show the one-time hack hint on the leading machine once the action starts. */
  private updateHackHint(dt: number): void {
    const hint = this.hackHint;
    if (!hint) return;
    const gs = this.gs;
    if (gs.over || gs.isPaused || this.tutorial?.active || gs.waves.index < 0) {
      hint.hide();
      return;
    }
    const hack = gs.hack;
    const view = viewBounds(this);
    if (hack.target) {
      hint.show({ x: hack.target.x, y: hack.target.y }, true, dt, view);
      return;
    }
    if (hack.charges < 1) {
      hint.hide();
      return;
    }
    // leading machine that is on screen and hackable
    let best = null as (typeof gs.enemies.list)[number] | null;
    for (const e of gs.enemies.list) {
      // only machines fully on screen, so the hand and label stay readable
      if (!e.alive || e.hacked || e.burrowed || e.def.type === 'titan' || e.x < view.left + 90 || e.x > view.right - 90) continue;
      if (!best || e.dist > best.dist) best = e;
    }
    if (best) hint.show({ x: best.x, y: best.y }, false, dt, view);
    else hint.hide();
    // don't nag: after 10 s on screen without a hack, retire the hint for good
    if (hint.shownTime >= 10) {
      storage.update({ hackTipDone: true });
      hint.retire();
      this.hackHint = null;
    }
  }

  private floatText(x: number, y: number, message: string, color: string): void {
    const t = text(this, x, y, message, 18, COLORS.text, { stroke: '#05080f', strokeThickness: 5 })
      .setColor(color)
      .setOrigin(0, 0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, x: x + 8, duration: 180 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
  }
}
