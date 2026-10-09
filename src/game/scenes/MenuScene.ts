import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, SCENES, VIEW_PAD, css } from '../config';
import { MAPS } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { enemyKey } from '../rendering/EnemyRenderer';
import { iconKey } from '../rendering/TowerRenderer';
import { bgKey } from '../rendering/EnvironmentRenderer';
import { PathData, type PathSample } from '../utils/MathUtils';
import { storage } from '../utils/Storage';
import { fullscreen } from '../utils/Fullscreen';
import { centerCamera } from '../utils/View';
import { Icons, NeonButton, drawPanel, text } from '../ui/widgets';

interface Walker {
  img: Phaser.GameObjects.Image;
  dist: number;
  speed: number;
  seg: number;
}

export class MenuScene extends Phaser.Scene {
  private walkers: Walker[] = [];
  private path!: PathData;
  private readonly sample: PathSample = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
  private starting = false;
  private helpLayer!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    this.starting = false;
    this.walkers = [];
    this.path = new PathData(MAPS[0].paths[0], MAPS[0].cornerRadius);
    centerCamera(this);
    this.add.image(-VIEW_PAD.x, -VIEW_PAD.y, bgKey(MAPS[0])).setOrigin(0);

    // ambient machines drifting along the road behind the menu
    const types = ['drone', 'runner', 'drone', 'juggernaut', 'specter', 'drone', 'spawner'] as const;
    types.forEach((type, i) => {
      const img = this.add.image(0, 0, enemyKey(type)).setAlpha(0.8);
      this.walkers.push({ img, dist: i * (this.path.length / types.length), speed: 40 + (type === 'runner' ? 60 : 0), seg: 0 });
    });

    // oversized so it covers any expanded view
    this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, 4720, 0x05080f, 0.62).setOrigin(0);

    const cx = GAME_WIDTH / 2;
    const glow = this.add.image(cx, 170, 'fx_glow')
      .setTint(COLORS.cyan).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(860, 260).setAlpha(0.22);
    this.tweens.add({ targets: glow, alpha: 0.34, duration: 1800, yoyo: true, repeat: -1 });

    text(this, cx, 86, 'THE LAST REACTOR. YOUR DEFENSE.', 17, COLORS.textDim, {
      letterSpacing: 3,
    }).setOrigin(0.5);
    text(this, cx, 152, 'NEON WASTELAND', 76, COLORS.cyan, {
      stroke: '#04121a', strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: css(COLORS.cyan), blur: 14, fill: true },
    }).setOrigin(0.5);
    text(this, cx, 218, 'D E F E N S E', 34, COLORS.pink, {
      stroke: '#1a0410', strokeThickness: 5,
    }).setOrigin(0.5);

    // A visual preview of the arsenal; details belong in the build drawer.
    const stage = this.add.graphics();
    stage.lineStyle(1, COLORS.cyan, 0.18);
    stage.lineBetween(cx - 480, 397, cx + 480, 397);
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const x = cx + (i - (TOWER_ORDER.length - 1) / 2) * 160;
      const hero = type === 'missile';
      const halo = this.add.image(x, 346, 'fx_glow').setTint(def.color)
        .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(150, 94).setAlpha(0.18);
      const img = this.add.image(x, 334, iconKey(type, 3)).setScale(hero ? 1.65 : 1.35);
      this.tweens.add({ targets: img, y: 328, duration: 1300 + i * 100,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: halo, alpha: 0.28, duration: 1800 + i * 100,
        yoyo: true, repeat: -1 });
      text(this, x, 393, def.name.replace(' Tower', '').toUpperCase(), 16, def.color)
        .setOrigin(0.5);
    });

    const playBtn = new NeonButton(this, cx, 482, 360, 88, {
      label: 'PLAY', fontSize: 36, color: COLORS.green,
      onClick: () => void this.play(),
    });
    playBtn.label?.setX(16);
    const playIcon = this.add.graphics();
    Icons.play(playIcon, COLORS.green);
    playIcon.setPosition(-86, 0);
    playBtn.add(playIcon);
    text(this, cx, 555, 'Defend the reactor across 3 sectors.', 22, COLORS.text,
      { fontStyle: 'normal' }).setOrigin(0.5);

    const d = storage.data;
    const cleared = MAPS.filter((_, i) => storage.starsFor(i) > 0).length;
    const best = cleared > 0
      ? `CAMPAIGN  \u2605 ${storage.totalStars} / ${MAPS.length * 3}  \u00b7  ${cleared} / ${MAPS.length} SECTORS CLEARED`
      : d.bestWave > 0 ? `BEST RUN  \u00b7  WAVE ${d.bestWave} / ${MAPS[0].waves.length}` : 'BUILD  \u00b7  UPGRADE  \u00b7  SURVIVE';
    text(this, cx, 607, best, 17, d.bestWave > 0 || d.wins > 0 ? COLORS.gold : COLORS.textDim)
      .setOrigin(0.5);

    const soundBtn = new NeonButton(this, 1070, 52, 172, 52, {
      label: '', fontSize: 16, color: COLORS.textDim,
      onClick: () => {
        sfx.setMuted(!sfx.isMuted());
        storage.update({ muted: sfx.isMuted() });
        soundLabel();
      },
    });
    const soundLabel = () => soundBtn.setLabel(sfx.isMuted() ? 'SOUND: OFF' : 'SOUND: ON');
    soundLabel();
    new NeonButton(this, 1204, 52, 76, 52, {
      label: 'HELP', fontSize: 16, color: COLORS.textDim,
      onClick: () => this.helpLayer.setVisible(true),
    });
    this.createHelp();

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') this.helpLayer.setVisible(false);
      if (ev.code === 'Enter' && !this.helpLayer.visible) void this.play();
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));
  }

  private createHelp(): void {
    const cx = GAME_WIDTH / 2;
    const c = this.add.container(0, 0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, 4720, 0x03050a, 0.85)
      .setOrigin(0).setInteractive();
    const frame = this.add.graphics();
    drawPanel(frame, cx - 500, 60, 1000, 600, {
      color: 0x344963, fillAlpha: 1, radius: 18, corners: false, glow: false,
    });
    c.add([dim, frame]);
    c.add(text(this, cx - 460, 104, 'HOW TO PLAY', 32, COLORS.text).setOrigin(0, 0.5));
    c.add(text(this, cx - 460, 146, 'Defend the reactor. Clear 3 sectors.', 22, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0, 0.5));

    const tips = [
      ['BUILD', 'Tap a platform.\nChoose a tower.'],
      ['UPGRADE', 'Tap a tower.\nUpgrade or sell it.'],
      ['DEFEND', 'Stop the machines.\nProtect the reactor.'],
      ['CALL WAVES', 'Tap the entrance beacon.\nCall early for bonus credits.'],
    ];
    const details: Phaser.GameObjects.Text[] = [];
    tips.forEach(([label, detail], i) => {
      const x = cx - 460 + (i % 2) * 480;
      const y = 188 + Math.floor(i / 2) * 164;
      const card = this.add.graphics();
      drawPanel(card, x, y, 440, 148, {
        color: 0x28364f, fill: 0x111a2e, corners: false, glow: false, radius: 12,
      });
      c.add(card);
      c.add(text(this, x + 24, y + 22, `${i + 1}`.padStart(2, '0'), 22, COLORS.cyan));
      c.add(text(this, x + 70, y + 22, label, 24, COLORS.green));
      const body = text(this, x + 24, y + 62, detail, 24, COLORS.text, {
        fontStyle: 'normal', lineSpacing: 6, wordWrap: { width: 392 },
      });
      details.push(body);
      c.add(body);
    });

    const keyboard = this.add.container(0, 0);
    keyboard.add(text(this, cx, 524, 'KEYBOARD SHORTCUTS', 14, COLORS.textDim).setOrigin(0.5));
    keyboard.add(text(this, cx, 550,
      'Space: wave   \u00b7   1-5: build   \u00b7   U: upgrade   \u00b7   S: sell   \u00b7   F: speed   \u00b7   P / Esc: pause',
      17, COLORS.text).setOrigin(0.5));
    c.add(keyboard);
    const replay = new NeonButton(this, cx - 235, 610, 450, 60, {
      label: 'REPLAY TUTORIAL', fontSize: 22, color: COLORS.textDim,
      panelStyle: { corners: false, glow: false, radius: 12 },
      onClick: () => { storage.update({ tutorialDone: false }); void this.play(); },
    });
    const done = new NeonButton(this, cx + 235, 610, 450, 60, {
      label: 'GOT IT', fontSize: 24, color: COLORS.green,
      panelStyle: { corners: false, radius: 12 },
      onClick: () => c.setVisible(false),
    });
    c.add([replay, done]);
    c.add(new NeonButton(this, cx + 438, 108, 60, 56, {
      icon: Icons.close, color: COLORS.textDim,
      panelStyle: { corners: false, glow: false },
      onClick: () => c.setVisible(false),
    }));

    const layout = () => {
      const compact = this.scale.canvas.getBoundingClientRect().width < 1000
        || window.matchMedia('(pointer: coarse)').matches;
      keyboard.setVisible(!compact);
      details.forEach((body) => body.setFontSize(compact ? 26 : 24));
      replay.setY(compact ? 580 : 610);
      done.setY(compact ? 580 : 610);
    };
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,
      () => this.scale.off(Phaser.Scale.Events.RESIZE, layout));
    this.helpLayer = c;
  }

  private async play(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    // First-time players go straight into Sector 1; afterwards PLAY opens sector select.
    if (storage.starsFor(0) > 0) {
      this.scene.start(SCENES.sectors);
      return;
    }
    // still inside the tap gesture, so the browser allows fullscreen
    fullscreen.enterOnTouchDevices();
    await poki.commercialBreak();
    this.scene.start(SCENES.game, { mapIndex: 0 });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const s = this.sample;
    for (const w of this.walkers) {
      w.dist += w.speed * dt;
      if (w.dist >= this.path.length) {
        w.dist = 0;
        w.seg = 0;
      }
      w.seg = this.path.sample(w.dist, s, w.seg);
      w.img.setPosition(s.x, s.y).setRotation(s.angle);
    }
  }
}
