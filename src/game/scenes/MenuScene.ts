import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES, css } from '../config';
import { SECTOR_7 } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { enemyKey } from '../rendering/EnemyRenderer';
import { iconKey } from '../rendering/TowerRenderer';
import { PathData, type PathSample } from '../utils/MathUtils';
import { storage } from '../utils/Storage';
import { NeonButton, drawPanel, text } from '../ui/widgets';

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

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    this.starting = false;
    this.walkers = [];
    this.path = new PathData(SECTOR_7.path, SECTOR_7.cornerRadius);
    this.add.image(0, 0, 'bg').setOrigin(0);

    // ambient machines drifting along the road behind the menu
    const types = ['drone', 'runner', 'drone', 'juggernaut', 'specter', 'drone', 'spawner'] as const;
    types.forEach((type, i) => {
      const img = this.add.image(0, 0, enemyKey(type)).setAlpha(0.8);
      this.walkers.push({ img, dist: i * (this.path.length / types.length), speed: 40 + (type === 'runner' ? 60 : 0), seg: 0 });
    });

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080f, 0.62).setOrigin(0);

    const cx = GAME_WIDTH / 2;
    const glow = this.add
      .image(cx, 132, 'fx_glow')
      .setTint(COLORS.cyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(900, 220)
      .setAlpha(0.25);
    this.tweens.add({ targets: glow, alpha: 0.4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    text(this, cx, 104, 'NEON WASTELAND', 76, COLORS.cyan, {
      stroke: '#04121a',
      strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: css(COLORS.cyan), blur: 18, fill: true, stroke: true },
    }).setOrigin(0.5);
    text(this, cx, 172, 'D E F E N S E', 34, COLORS.pink, {
      stroke: '#1a0410',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: css(COLORS.pink), blur: 14, fill: true, stroke: true },
    }).setOrigin(0.5);
    text(this, cx, 214, 'Build turrets. Upgrade them. Keep the machines away from the reactor.', 17, COLORS.textDim, {
      fontStyle: 'normal',
    }).setOrigin(0.5);

    // tower lineup
    const panel = this.add.graphics();
    drawPanel(panel, cx - 470, 248, 940, 200, { color: 0x2a3d63, fillAlpha: 0.75 });
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const x = cx - 376 + i * 188;
      const img = this.add.image(x, 336, iconKey(type, 3)).setScale(1.35);
      this.tweens.add({
        targets: img,
        y: 330,
        duration: 1100 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      text(this, x, 408, def.name.replace(' Tower', ''), 18, def.color).setOrigin(0.5);
      text(this, x, 430, def.description.split('.')[0], 12, COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0.5);
    });

    new NeonButton(this, cx, 512, 300, 72, {
      label: 'PLAY',
      fontSize: 32,
      color: COLORS.green,
      onClick: () => void this.play(),
    });

    const tutBtn = new NeonButton(this, cx - 160, 594, 230, 46, {
      label: '',
      fontSize: 15,
      color: COLORS.textDim,
      onClick: () => {
        storage.update({ tutorialDone: !storage.data.tutorialDone });
        tutLabel();
      },
    });
    const tutLabel = () => tutBtn.setLabel(storage.data.tutorialDone ? 'TUTORIAL: OFF' : 'TUTORIAL: ON');
    tutLabel();

    const soundBtn = new NeonButton(this, cx + 160, 594, 230, 46, {
      label: '',
      fontSize: 15,
      color: COLORS.textDim,
      onClick: () => {
        sfx.setMuted(!sfx.isMuted());
        storage.update({ muted: sfx.isMuted() });
        soundLabel();
      },
    });
    const soundLabel = () => soundBtn.setLabel(sfx.isMuted() ? 'SOUND: OFF' : 'SOUND: ON');
    soundLabel();

    const d = storage.data;
    const stars = '★'.repeat(d.bestStars) + '☆'.repeat(3 - d.bestStars);
    const best =
      d.wins > 0
        ? `Best rating ${stars}   ·   Victories ${d.wins}`
        : d.bestWave > 0
          ? `Best: survived ${d.bestWave} wave${d.bestWave === 1 ? '' : 's'}`
          : 'Survive 10 waves to secure the reactor';
    text(this, cx, 648, best, 16, COLORS.gold, { fontStyle: 'normal' }).setOrigin(0.5);
    text(
      this,
      cx,
      690,
      'Tap platforms to build  ·  Space: next wave  ·  F: speed  ·  P: pause  ·  1–5: quick build',
      13,
      COLORS.textDim,
      { fontStyle: 'normal' },
    ).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => void this.play());
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
