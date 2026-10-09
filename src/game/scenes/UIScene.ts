import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES, css } from '../config';
import { ENEMIES } from '../data/enemies';
import { newEnemiesInWave } from '../data/waves';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { enemyKey } from '../rendering/EnemyRenderer';
import { storage } from '../utils/Storage';
import { HUD } from '../ui/HUD';
import { TowerMenu } from '../ui/TowerMenu';
import { Tutorial } from '../ui/Tutorial';
import { UpgradePanel } from '../ui/UpgradePanel';
import { NeonButton, drawPanel, text } from '../ui/widgets';
import { GameEvents, type GameScene, type Selection } from './GameScene';

/** Overlay scene for HUD, menus, banners, tutorial and the pause screen. */
export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private hud!: HUD;
  private menu!: TowerMenu;
  private panel!: UpgradePanel;
  private tutorial: Tutorial | null = null;
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseSound!: NeonButton;
  private banner!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private bannerIcon!: Phaser.GameObjects.Image;
  private bannerBg!: Phaser.GameObjects.Graphics;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super(SCENES.ui);
  }

  create(): void {
    this.gs = this.scene.get(SCENES.game) as GameScene;
    this.tutorial = null;
    this.unsubscribe = [];

    this.hud = new HUD(this, this.gs, {
      onPause: () => this.gs.pauseGame(),
      onSpeed: () => this.gs.toggleSpeed(),
      onMute: () => this.toggleMute(),
      onCallWave: () => this.callWave(),
    });

    this.menu = new TowerMenu(
      this,
      (type) => this.gs.buildTower(type),
      () => this.gs.deselect(),
    );
    this.panel = new UpgradePanel(
      this,
      () => this.gs.upgradeSelected(),
      () => this.gs.sellSelected(),
      () => this.gs.deselect(),
    );

    this.createBanner();
    this.createPauseLayer();

    this.listen(GameEvents.selection, (sel: Selection) => this.onSelection(sel));
    this.listen(GameEvents.towerBuilt, () => this.tutorial?.advance('road'));
    this.listen(GameEvents.waveStart, (index: number) => this.onWaveStart(index));
    this.listen(GameEvents.waveBonus, (amount: number) => this.toast(`WAVE BONUS +${amount}`));
    this.listen(GameEvents.paused, () => this.showPause(true));
    this.listen(GameEvents.resumed, () => this.showPause(false));
    this.listen(GameEvents.gameOver, () => {
      this.menu.close();
      this.panel.close();
      this.tutorial?.finish();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.unsubscribe) off();
      this.unsubscribe = [];
    });

    const kb = this.input.keyboard;
    kb?.on('keydown', (ev: KeyboardEvent) => {
      if (this.gs.isPaused && (ev.code === 'Escape' || ev.code === 'KeyP')) this.gs.resumeGame();
    });

    if (!storage.data.tutorialDone) this.startTutorial();
  }

  private listen<T extends unknown[]>(event: string, fn: (...args: T) => void): void {
    const handler = fn as (...args: unknown[]) => void;
    this.gs.events.on(event, handler);
    this.unsubscribe.push(() => this.gs.events.off(event, handler));
  }

  private startTutorial(): void {
    const g = this.gs;
    const platform = g.map.platforms[1];
    this.tutorial = new Tutorial(this, {
      platform,
      entrance: { x: 0, y: g.map.path[0].y },
      reactor: g.map.reactor,
      waveButton: this.hud.waveBtnPos,
      pulseCard: () => this.menu.cardCenter('pulse'),
      menuDockTop: () => this.menu.dockTop,
      setHold: (hold) => {
        g.waves.hold = hold;
      },
      finish: () => {
        storage.update({ tutorialDone: true });
        this.tutorial = null;
      },
    });
  }

  private callWave(): void {
    if (this.tutorial?.active) {
      if (this.tutorial.step !== 'start') return;
      this.tutorial.advance('done');
    }
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
    this.banner = this.add.container(GAME_WIDTH / 2, 150).setVisible(false).setDepth(30);
    this.bannerBg = this.add.graphics();
    this.bannerTitle = text(this, 0, -22, '', 34, COLORS.text, {
      stroke: '#05080f',
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.bannerSub = text(this, 20, 18, '', 16, COLORS.text, { fontStyle: 'normal' }).setOrigin(0.5);
    this.bannerIcon = this.add.image(0, 18, enemyKey('drone')).setVisible(false);
    this.banner.add([this.bannerBg, this.bannerTitle, this.bannerIcon, this.bannerSub]);
  }

  private onWaveStart(index: number): void {
    const total = this.gs.waves.total;
    const isFinal = index === total - 1;
    const fresh = newEnemiesInWave(index).filter((t) => t !== 'mini');
    this.bannerTitle.setText(isFinal ? 'FINAL WAVE' : `WAVE ${index + 1}`);
    this.bannerTitle.setColor(isFinal ? css(COLORS.red) : css(COLORS.text));
    let w = 300;
    let h = 64;
    if (fresh.length > 0) {
      const def = ENEMIES[fresh[0]];
      this.bannerSub.setText(`NEW: ${def.name}. ${def.tip}`).setColor(css(def.color));
      this.bannerIcon.setTexture(enemyKey(def.type)).setVisible(true).setScale(def.radius > 15 ? 0.9 : 1.2);
      w = Math.max(360, this.bannerSub.width + 110);
      h = 100;
      this.bannerSub.setX(26).setVisible(true);
      this.bannerIcon.setX(-this.bannerSub.width / 2 - 4);
      this.bannerTitle.setY(-20);
    } else {
      this.bannerSub.setVisible(false);
      this.bannerIcon.setVisible(false);
      this.bannerTitle.setY(0);
    }
    this.bannerBg.clear();
    drawPanel(this.bannerBg, -w / 2, -h / 2, w, h, { color: isFinal ? COLORS.red : COLORS.pink });
    this.tweens.killTweensOf(this.banner);
    this.banner.setVisible(true).setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: fresh.length ? 3600 : 1700,
      duration: 400,
      onComplete: () => this.banner.setVisible(false),
    });
  }

  private toast(message: string): void {
    const t = text(this, 170, 112, message, 16, COLORS.gold, { stroke: '#05080f', strokeThickness: 4 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 106, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
    sfx.play('coin');
  }

  private createPauseLayer(): void {
    const c = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03050a, 0.72)
      .setOrigin(0)
      .setInteractive();
    const g = this.add.graphics();
    const pw = 400;
    const ph = 360;
    const px = (GAME_WIDTH - pw) / 2;
    const py = (GAME_HEIGHT - ph) / 2;
    drawPanel(g, px, py, pw, ph, { color: COLORS.cyan });
    const title = text(this, GAME_WIDTH / 2, py + 44, 'PAUSED', 34, COLORS.cyan).setOrigin(0.5);
    const cx = GAME_WIDTH / 2;
    const resume = new NeonButton(this, cx, py + 116, 280, 56, {
      label: 'RESUME',
      fontSize: 22,
      color: COLORS.green,
      onClick: () => this.gs.resumeGame(),
    });
    const restart = new NeonButton(this, cx, py + 184, 280, 50, {
      label: 'RESTART',
      fontSize: 19,
      color: COLORS.orange,
      onClick: () => void this.restart(),
    });
    const menu = new NeonButton(this, cx, py + 246, 280, 50, {
      label: 'MAIN MENU',
      fontSize: 19,
      color: COLORS.purple,
      onClick: () => this.quitToMenu(),
    });
    this.pauseSound = new NeonButton(this, cx, py + 308, 280, 44, {
      label: '',
      fontSize: 16,
      color: COLORS.textDim,
      onClick: () => {
        this.toggleMute();
        this.updatePauseSound();
      },
    });
    c.add([dim, g, title, resume, restart, menu, this.pauseSound]);
    this.pauseLayer = c;
  }

  private updatePauseSound(): void {
    this.pauseSound.setLabel(sfx.isMuted() ? 'SOUND: OFF' : 'SOUND: ON');
  }

  private showPause(show: boolean): void {
    this.updatePauseSound();
    this.pauseLayer.setVisible(show);
    if (show) {
      this.menu.close();
      this.panel.close();
    }
  }

  private async restart(): Promise<void> {
    this.pauseLayer.setVisible(false);
    await poki.commercialBreak();
    this.scene.stop(SCENES.result);
    this.gs.scene.restart();
  }

  private quitToMenu(): void {
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
  }
}
