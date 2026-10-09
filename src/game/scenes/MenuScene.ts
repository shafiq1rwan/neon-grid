import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, SCENES, VIEW_PAD, css } from '../config';
import { SECTOR_7 } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { enemyKey } from '../rendering/EnemyRenderer';
import { iconKey } from '../rendering/TowerRenderer';
import { PathData, type PathSample } from '../utils/MathUtils';
import { storage } from '../utils/Storage';
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
    this.path = new PathData(SECTOR_7.path, SECTOR_7.cornerRadius);
    centerCamera(this);
    this.add.image(-VIEW_PAD.x, -VIEW_PAD.y, 'bg').setOrigin(0);

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
    stage.lineBetween(cx - 440, 397, cx + 440, 397);
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const x = cx - 340 + i * 170;
      const hero = i === 2;
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
    text(this, cx, 555, 'Defend the reactor. Survive 10 waves.', 22, COLORS.text,
      { fontStyle: 'normal' }).setOrigin(0.5);

    const d = storage.data;
    const best = d.wins > 0
      ? `BEST  ${'\u2605'.repeat(d.bestStars)}${'\u2606'.repeat(3 - d.bestStars)}  \u00b7  ${d.wins} ${d.wins === 1 ? 'VICTORY' : 'VICTORIES'}`
      : d.bestWave > 0 ? `BEST RUN  \u00b7  WAVE ${d.bestWave} / 10` : 'BUILD  \u00b7  UPGRADE  \u00b7  SURVIVE';
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
    drawPanel(frame, cx - 360, 122, 720, 490, { color: COLORS.cyan, fillAlpha: 1 });
    c.add([dim, frame]);
    c.add(text(this, cx, 164, 'HOW TO PLAY', 30, COLORS.cyan).setOrigin(0.5));
    const tips = [
      ['01  BUILD', 'Tap a glowing platform, then choose a tower.'],
      ['02  UPGRADE', 'Tap a tower to upgrade it or sell it for credits.'],
      ['03  DEFEND', 'Stop machines before they reach the reactor.'],
      ['04  CALL WAVES', 'Tap the entrance beacon. Call early for bonus credits.'],
    ];
    tips.forEach(([label, detail], i) => {
      c.add(text(this, cx - 310, 211 + i * 60, label, 17, COLORS.green));
      c.add(text(this, cx - 310, 234 + i * 60, detail, 18, COLORS.text, { fontStyle: 'normal' }));
    });
    c.add(text(this, cx, 471, 'KEYBOARD', 14, COLORS.textDim).setOrigin(0.5));
    c.add(text(this, cx, 500, 'Space: wave   \u00b7   1-5: build   \u00b7   U: upgrade   \u00b7   S: sell', 17, COLORS.text)
      .setOrigin(0.5));
    c.add(text(this, cx, 526, 'F: speed   \u00b7   P / Esc: pause', 17, COLORS.text).setOrigin(0.5));
    c.add(new NeonButton(this, cx - 145, 574, 260, 48, {
      label: 'REPLAY TUTORIAL', fontSize: 16, color: COLORS.textDim,
      onClick: () => { storage.update({ tutorialDone: false }); void this.play(); },
    }));
    c.add(new NeonButton(this, cx + 145, 574, 260, 48, {
      label: 'GOT IT', fontSize: 18, color: COLORS.green,
      onClick: () => c.setVisible(false),
    }));
    c.add(new NeonButton(this, cx + 325, 153, 44, 44, {
      icon: Icons.close, color: COLORS.textDim, onClick: () => c.setVisible(false),
    }));
    this.helpLayer = c;
  }

  private async play(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    await poki.commercialBreak();
    this.scene.start(SCENES.game);
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
