import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { MAPS } from '../data/maps';
import { poki } from '../platform/PokiAdapter';
import { generateEffectTextures } from '../rendering/EffectsRenderer';
import { generateEnemyTextures } from '../rendering/EnemyRenderer';
import { ensureMapBackground, generateSharedEnvironment } from '../rendering/EnvironmentRenderer';
import { generateTowerTextures } from '../rendering/TowerRenderer';
import { PathData } from '../utils/MathUtils';
import { centerCamera } from '../utils/View';
import { text } from '../ui/widgets';

/**
 * There are no image assets to download: all art is generated procedurally
 * into cached textures here, which keeps the build tiny and loading fast.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    centerCamera(this);
    const label = text(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'INITIALISING DEFENSE GRID…', 20, COLORS.cyan).setOrigin(0.5);
    this.tweens.add({ targets: label, alpha: 0.4, duration: 400, yoyo: true, repeat: -1 });

    // Let the loading label render before the (synchronous) texture bake.
    this.time.delayedCall(30, () => {
      const first = MAPS[0];
      generateEffectTextures(this);
      generateTowerTextures(this);
      generateEnemyTextures(this);
      generateSharedEnvironment(this);
      // Only sector 1 is baked up front (menu + first game); later sectors bake on demand.
      ensureMapBackground(this, first, first.paths.map((lane) => new PathData(lane, first.cornerRadius)));
      poki.gameLoadingFinished();
      this.scene.start(SCENES.menu);
    });
  }
}
