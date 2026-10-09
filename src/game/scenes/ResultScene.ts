import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { poki } from '../platform/PokiAdapter';
import { NeonButton, drawPanel, text } from '../ui/widgets';
import type { GameScene, ResultData } from './GameScene';

function starPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  return pts;
}

/** Victory / defeat overlay, shown above the paused battlefield. */
export class ResultScene extends Phaser.Scene {
  private busy = false;

  constructor() {
    super(SCENES.result);
  }

  create(data: ResultData): void {
    this.busy = false;
    const victory = data.victory;
    const accent = victory ? COLORS.cyan : COLORS.red;
    const cx = GAME_WIDTH / 2;

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03050a, 0).setOrigin(0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 400 });

    const pw = 560;
    const ph = data.canRevive ? 520 : 470;
    const px = cx - pw / 2;
    const py = (GAME_HEIGHT - ph) / 2;
    const root = this.add.container(0, 0);
    const g = this.add.graphics();
    drawPanel(g, px, py, pw, ph, { color: accent });
    root.add(g);

    root.add(
      text(this, cx, py + 46, victory ? 'REACTOR SECURED' : 'REACTOR LOST', 38, accent, {
        stroke: '#05080f',
        strokeThickness: 6,
      }).setOrigin(0.5),
    );
    root.add(
      text(
        this,
        cx,
        py + 86,
        victory ? 'The wasteland machines have been repelled.' : `The machines broke through on wave ${data.wave}.`,
        16,
        COLORS.textDim,
        { fontStyle: 'normal' },
      ).setOrigin(0.5),
    );

    // stars
    const sg = this.add.graphics();
    root.add(sg);
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 74;
      const sy = py + 150 + (i === 1 ? -8 : 0);
      sg.fillStyle(0x1a2338, 1);
      sg.fillPoints(starPoints(sx, sy, 30), true);
      sg.lineStyle(2, 0x2a3550, 1);
      sg.strokePoints(starPoints(sx, sy, 30), true);
      if (i < data.stars) {
        const star = this.add.graphics();
        star.fillStyle(COLORS.gold, 1);
        star.fillPoints(starPoints(0, 0, 30), true);
        star.lineStyle(2, 0xfff0b0, 1);
        star.strokePoints(starPoints(0, 0, 30), true);
        star.setPosition(sx, sy).setScale(0);
        root.add(star);
        this.tweens.add({ targets: star, scale: 1, delay: 300 + i * 220, duration: 380, ease: 'Back.easeOut' });
      }
    }

    const mins = Math.floor(data.time / 60);
    const secs = Math.floor(data.time % 60)
      .toString()
      .padStart(2, '0');
    const rows: [string, string][] = [
      ['Waves survived', `${victory ? data.totalWaves : Math.max(0, data.wave - 1)} / ${data.totalWaves}`],
      ['Machines destroyed', `${data.kills}`],
      ['Reactor HP', `${data.hp} / 20`],
      ['Credits earned', `${data.earned}`],
      ['Time', `${mins}:${secs}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = py + 210 + i * 30;
      root.add(text(this, px + 90, y, label, 17, COLORS.textDim, { fontStyle: 'normal' }));
      root.add(text(this, px + pw - 90, y, value, 18, COLORS.text).setOrigin(1, 0));
    });

    let by = py + 390;
    if (data.canRevive) {
      const revive = new NeonButton(this, cx, by, 380, 56, {
        label: 'REVIVE  ·  watch an ad for +10 HP',
        fontSize: 17,
        color: COLORS.gold,
        onClick: () => void this.revive(revive),
      });
      root.add(revive);
      by += 70;
    }
    const again = new NeonButton(this, cx - 98, by, 180, 52, {
      label: victory ? 'PLAY AGAIN' : 'RETRY',
      fontSize: 19,
      color: COLORS.green,
      onClick: () => void this.playAgain(),
    });
    const menu = new NeonButton(this, cx + 98, by, 180, 52, {
      label: 'MENU',
      fontSize: 19,
      color: COLORS.purple,
      onClick: () => this.toMenu(),
    });
    root.add([again, menu]);

    root.setAlpha(0).setY(30);
    this.tweens.add({ targets: root, alpha: 1, y: 0, duration: 380, ease: 'Cubic.easeOut' });
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

  private toMenu(): void {
    if (this.busy) return;
    this.scene.stop(SCENES.ui);
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.menu);
  }
}
