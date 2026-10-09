import Phaser from 'phaser';
import { COLORS, DEPTH, ECONOMY, SCENES, VIEW_PAD } from '../config';
import { SECTOR_7, type MapDef } from '../data/maps';
import { TOWERS, type TowerType } from '../data/towers';
import type { Tower } from '../entities/Tower';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { Effects } from '../rendering/EffectsRenderer';
import type { SignInfo } from '../rendering/EnvironmentRenderer';
import { PLATFORM_RADIUS } from '../rendering/EnvironmentRenderer';
import { EconomySystem } from '../systems/EconomySystem';
import { EnemySystem } from '../systems/EnemySystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { TowerSystem } from '../systems/TowerSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { PathData } from '../utils/MathUtils';
import { storage } from '../utils/Storage';
import { centerCamera } from '../utils/View';

export type Selection = { kind: 'none' } | { kind: 'platform'; index: number } | { kind: 'tower'; index: number };

export interface ResultData {
  victory: boolean;
  wave: number;
  totalWaves: number;
  hp: number;
  kills: number;
  earned: number;
  time: number;
  stars: number;
  canRevive: boolean;
}

/** Events emitted on `GameScene.events` for the UI layer. */
export const GameEvents = {
  selection: 'nwd-selection',
  towerBuilt: 'nwd-tower-built',
  waveStart: 'nwd-wave-start',
  waveBonus: 'nwd-wave-bonus',
  paused: 'nwd-paused',
  resumed: 'nwd-resumed',
  gameOver: 'nwd-game-over',
} as const;

export class GameScene extends Phaser.Scene {
  readonly map: MapDef = SECTOR_7;
  path!: PathData;
  effects!: Effects;
  enemies!: EnemySystem;
  projectiles!: ProjectileSystem;
  towers!: TowerSystem;
  waves!: WaveSystem;
  economy!: EconomySystem;

  hp = 0;
  speed: 1 | 2 = 1;
  over = false;
  victory = false;
  isPaused = false;
  revived = false;
  playTime = 0;
  selection: Selection = { kind: 'none' };

  private hints: Phaser.GameObjects.Image[] = [];
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private selectRing!: Phaser.GameObjects.Image;
  private reactorRing!: Phaser.GameObjects.Image;
  private reactorCore!: Phaser.GameObjects.Image;
  private reactorGlow!: Phaser.GameObjects.Image;
  private reactorFlash = 0;
  private elapsed = 0;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    // Scene instances are reused on restart, so reset all state here.
    this.hp = ECONOMY.startingHp;
    this.speed = 1;
    this.over = false;
    this.victory = false;
    this.isPaused = false;
    this.revived = false;
    this.playTime = 0;
    this.elapsed = 0;
    this.reactorFlash = 0;
    this.selection = { kind: 'none' };
    this.hints = [];
    this.tweens.timeScale = 1;

    this.path = new PathData(this.map.path, this.map.cornerRadius);
    this.add.image(-VIEW_PAD.x, -VIEW_PAD.y, 'bg').setOrigin(0).setDepth(DEPTH.BG);
    // screen-space vignette over the background only
    const vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG + 1);
    centerCamera(this, (view) => vignette.setDisplaySize(view.width, view.height));
    this.createAmbience();
    this.createReactor();

    this.effects = new Effects(this);
    this.economy = new EconomySystem(ECONOMY.startCredits);
    this.enemies = new EnemySystem(this, this.path, this.map.roadWidth, this.effects, {
      onKilled: (e) => {
        this.economy.earn(e.def.reward);
        this.effects.popup(e.x, e.y - 14, `+${e.def.reward}`);
      },
      onEscaped: (e) => this.reactorHit(e.def.leakDamage),
    });
    this.projectiles = new ProjectileSystem(this, this.enemies, this.effects);
    this.towers = new TowerSystem(this, this.map.platforms, this.enemies, this.projectiles, this.effects);
    this.waves = new WaveSystem({
      spawn: (type, hpScale) => this.enemies.spawn(type, hpScale),
      waveStarted: (index) => {
        sfx.play('waveStart');
        this.events.emit(GameEvents.waveStart, index);
      },
      waveSpawned: (_index, def) => {
        if (def.clearBonus > 0) {
          this.economy.earn(def.clearBonus);
          this.events.emit(GameEvents.waveBonus, def.clearBonus);
        }
      },
    });

    this.rangeGfx = this.add.graphics().setDepth(DEPTH.RANGE);
    this.selectRing = this.add
      .image(0, 0, 'fx_ring')
      .setDepth(DEPTH.PLATFORM_HINT + 1)
      .setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.tweens.add({
      targets: this.selectRing,
      alpha: { from: 0.5, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.createPlatforms();
    this.setupInput();

    const onHidden = () => {
      if (!this.over && !this.isPaused) this.pauseGame();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.enemies.destroy();
      this.projectiles.clear();
      this.towers.clear();
      this.effects.destroy();
      this.input.keyboard?.removeAllListeners();
    });

    storage.update({ plays: storage.data.plays + 1 });
    this.scene.stop(SCENES.result);
    this.scene.launch(SCENES.ui);
    poki.gameplayStart();
  }

  /* ---------------------------------------------------------------- */
  /* Setup                                                             */
  /* ---------------------------------------------------------------- */

  private createAmbience(): void {
    const signs = (this.registry.get('signs') as SignInfo[] | undefined) ?? [];
    for (const s of signs) {
      const glow = this.add
        .image(s.x, s.y, 'fx_glow')
        .setDepth(DEPTH.AMBIENT)
        .setTint(s.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(s.w * 2.2, s.h * 4)
        .setAlpha(0.35);
      // irregular neon flicker
      const flicker = () => {
        if (!glow.active) return;
        const off = Math.random() < 0.25;
        glow.setAlpha(off ? 0.08 : 0.3 + Math.random() * 0.15);
        this.time.delayedCall(off ? 60 + Math.random() * 90 : 400 + Math.random() * 2600, flicker);
      };
      flicker();
    }
  }

  private createReactor(): void {
    const r = this.map.reactor;
    this.reactorGlow = this.add
      .image(r.x, r.y - 6, 'fx_glow')
      .setDepth(DEPTH.REACTOR)
      .setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3.2)
      .setAlpha(0.35);
    this.add.image(r.x, r.y, 'reactor_base').setOrigin(0.5, 84 / 160).setDepth(DEPTH.REACTOR + 0.1);
    this.reactorRing = this.add
      .image(r.x, r.y - 6, 'reactor_ring')
      .setDepth(DEPTH.REACTOR + 0.2)
      .setScale(0.8, 0.64)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.reactorCore = this.add
      .image(r.x, r.y - 8, 'reactor_core')
      .setDepth(DEPTH.REACTOR + 0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private createPlatforms(): void {
    this.map.platforms.forEach((p, i) => {
      const hint = this.add
        .image(p.x, p.y - 2, 'plat_hint')
        .setDepth(DEPTH.PLATFORM_HINT)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.6);
      this.tweens.add({
        targets: hint,
        alpha: { from: 0.25, to: 0.75 },
        scale: { from: 0.92, to: 1.04 },
        duration: 900 + i * 37,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hints.push(hint);
      const zone = this.add
        .zone(p.x, p.y - 4, PLATFORM_RADIUS * 2.4, PLATFORM_RADIUS * 2.2)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.tapPlatform(i));
    });
  }

  private setupInput(): void {
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0) this.deselect();
      },
    );
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (this.over || poki.isAdPlaying) return;
      switch (ev.code) {
        case 'Space':
          this.callNextWave();
          break;
        case 'KeyP':
        case 'Escape':
          if (this.selection.kind !== 'none' && ev.code === 'Escape') this.deselect();
          else this.pauseGame();
          break;
        case 'KeyF':
          this.toggleSpeed();
          break;
        case 'KeyU':
          this.upgradeSelected();
          break;
        case 'KeyS':
          this.sellSelected();
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5': {
          const types: TowerType[] = ['pulse', 'cannon', 'missile', 'tesla', 'laser'];
          this.buildTower(types[Number(ev.code.slice(5)) - 1]);
          break;
        }
        default:
          break;
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Player actions (called by the UI scene)                           */
  /* ---------------------------------------------------------------- */

  tapPlatform(index: number): void {
    if (this.over) return;
    const current = this.selection;
    if (current.kind !== 'none' && current.index === index) {
      this.deselect();
      return;
    }
    sfx.play('click');
    const tower = this.towers.at(index);
    this.selection = tower ? { kind: 'tower', index } : { kind: 'platform', index };
    this.updateSelectionVisuals();
    this.events.emit(GameEvents.selection, this.selection);
  }

  deselect(): void {
    if (this.selection.kind === 'none') return;
    this.selection = { kind: 'none' };
    this.updateSelectionVisuals();
    this.events.emit(GameEvents.selection, this.selection);
  }

  selectedTower(): Tower | null {
    return this.selection.kind === 'tower' ? this.towers.at(this.selection.index) : null;
  }

  buildTower(type: TowerType): boolean {
    if (this.over || this.selection.kind !== 'platform') return false;
    const index = this.selection.index;
    if (this.towers.at(index)) return false;
    const cost = TOWERS[type].levels[0].cost;
    if (!this.economy.spend(cost)) {
      sfx.play('error');
      return false;
    }
    this.towers.build(index, type);
    this.hints[index].setVisible(false);
    this.effects.popup(this.map.platforms[index].x, this.map.platforms[index].y - 30, `-${cost}`, '#ff9b32');
    this.deselect();
    this.events.emit(GameEvents.towerBuilt, type);
    return true;
  }

  upgradeSelected(): boolean {
    const tower = this.selectedTower();
    if (!tower || this.over) return false;
    const next = tower.nextStats;
    if (!next) return false;
    if (!this.economy.spend(next.cost)) {
      sfx.play('error');
      return false;
    }
    this.towers.upgrade(tower);
    this.updateSelectionVisuals();
    this.events.emit(GameEvents.selection, this.selection);
    return true;
  }

  sellSelected(): boolean {
    const tower = this.selectedTower();
    if (!tower || this.over) return false;
    const refund = this.towers.sell(tower);
    this.economy.earn(refund);
    this.effects.popup(tower.x, tower.y - 30, `+${refund}`);
    this.hints[tower.platformIndex].setVisible(true);
    this.deselect();
    return true;
  }

  callNextWave(): void {
    if (this.over || !this.waves.canCallNext) return;
    const bonus = this.waves.callNext();
    if (bonus > 0) {
      this.economy.earn(bonus);
      const b = this.map.waveButton;
      this.effects.popup(b.x, b.y - 40, `+${bonus} early`);
      sfx.play('coin');
    }
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.tweens.timeScale = this.speed;
    this.effects.setTimeScale(this.speed);
  }

  pauseGame(): void {
    if (this.isPaused || this.over) return;
    this.isPaused = true;
    this.scene.pause();
    poki.gameplayStop();
    this.events.emit(GameEvents.paused);
  }

  resumeGame(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.scene.resume();
    poki.gameplayStart();
    this.events.emit(GameEvents.resumed);
  }

  /** Rewarded continue after defeat: restore some HP and clear the field. */
  revive(): void {
    if (!this.over || this.victory || this.revived) return;
    this.revived = true;
    this.over = false;
    this.hp = 10;
    this.enemies.clear(true);
    this.projectiles.clear();
    this.effects.ring(this.map.reactor.x, this.map.reactor.y, 140, COLORS.cyan, 700);
    this.scene.resume();
    this.isPaused = false;
    poki.gameplayStart();
  }

  /* ---------------------------------------------------------------- */
  /* Simulation                                                        */
  /* ---------------------------------------------------------------- */

  update(_time: number, delta: number): void {
    const real = Math.min(delta, 50) / 1000;
    const dt = real * this.speed;
    this.elapsed += dt;
    this.effects.beginFrame(dt);
    this.animateReactor(dt);
    if (this.over) return;

    this.playTime += real;
    this.waves.update(dt);
    this.enemies.update(dt);
    this.towers.update(dt);
    this.projectiles.update(dt);

    if (this.waves.state === 'complete' && this.enemies.count === 0) this.endGame(true);
  }

  private animateReactor(dt: number): void {
    const t = this.elapsed;
    this.reactorRing.rotation += dt * 0.8;
    this.reactorFlash = Math.max(0, this.reactorFlash - dt * 2.5);
    const health = this.hp / ECONOMY.startingHp;
    const pulse = 0.5 + 0.5 * Math.sin(t * (3 + (1 - health) * 6));
    this.reactorCore.setScale(0.9 + pulse * 0.15 + this.reactorFlash * 0.4);
    this.reactorGlow.setAlpha(0.25 + pulse * 0.15 + this.reactorFlash * 0.4);
    const tint = this.reactorFlash > 0.05 || health < 0.3 ? COLORS.red : COLORS.cyan;
    this.reactorGlow.setTint(tint);
    this.reactorCore.setTint(this.reactorFlash > 0.05 ? 0xff9aa8 : 0xffffff);
  }

  private reactorHit(damage: number): void {
    if (this.over) return;
    this.hp = Math.max(0, this.hp - damage);
    this.reactorFlash = 1;
    const r = this.map.reactor;
    this.effects.ring(r.x, r.y, 80, COLORS.red, 400);
    this.effects.burst(r.x, r.y, COLORS.red, 10);
    this.effects.popup(r.x, r.y - 50, `-${damage} HP`, '#ff526f');
    this.cameras.main.shake(140, 0.0035);
    sfx.play('leak');
    if (this.hp <= 0) this.endGame(false);
  }

  private endGame(victory: boolean): void {
    if (this.over) return;
    this.over = true;
    this.victory = victory;
    this.deselect();
    poki.gameplayStop();
    const r = this.map.reactor;
    const stars = victory ? (this.hp >= 18 ? 3 : this.hp >= 10 ? 2 : 1) : 0;
    const wave = victory ? this.waves.total : this.waves.displayNumber;
    if (victory) {
      sfx.play('victory');
      this.effects.ring(r.x, r.y, 200, COLORS.cyan, 900);
      this.effects.burst(r.x, r.y, COLORS.cyan, 30);
      storage.update({
        wins: storage.data.wins + 1,
        bestStars: Math.max(storage.data.bestStars, stars),
        bestWave: Math.max(storage.data.bestWave, wave),
      });
    } else {
      sfx.play('defeat');
      this.effects.explosion(r.x, r.y, 120, COLORS.red);
      this.effects.explosion(r.x - 30, r.y + 10, 80, COLORS.orange);
      this.cameras.main.shake(400, 0.008);
      storage.update({ bestWave: Math.max(storage.data.bestWave, wave - 1) });
    }
    this.events.emit(GameEvents.gameOver, victory);

    const data: ResultData = {
      victory,
      wave,
      totalWaves: this.waves.total,
      hp: this.hp,
      kills: this.enemies.kills,
      earned: this.economy.earned,
      time: this.playTime,
      stars,
      canRevive: !victory && !this.revived,
    };
    this.time.delayedCall(1300, () => {
      this.scene.pause();
      this.scene.launch(SCENES.result, data);
    });
  }

  private updateSelectionVisuals(): void {
    const g = this.rangeGfx;
    g.clear();
    const sel = this.selection;
    if (sel.kind === 'none') {
      this.selectRing.setVisible(false);
      return;
    }
    const p = this.map.platforms[sel.index];
    this.selectRing.setVisible(true).setPosition(p.x, p.y).setScale(0.82, 0.66);
    const tower = this.towers.at(sel.index);
    if (tower) {
      const c = tower.def.color;
      const r = tower.stats.range;
      g.fillStyle(c, 0.07);
      g.fillCircle(p.x, p.y, r);
      g.lineStyle(2, c, 0.6);
      g.strokeCircle(p.x, p.y, r);
      const next = tower.nextStats;
      if (next && next.range > r) {
        g.lineStyle(1, 0xffffff, 0.25);
        g.strokeCircle(p.x, p.y, next.range);
      }
      this.selectRing.setTint(c);
    } else {
      this.selectRing.setTint(COLORS.cyan);
    }
  }
}
