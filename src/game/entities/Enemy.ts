import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { EnemyDef } from '../data/enemies';
import { enemyKey } from '../rendering/EnemyRenderer';

let nextId = 1;

export class Enemy {
  readonly id = nextId++;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  shieldSprite: Phaser.GameObjects.Image | null = null;
  hatch: Phaser.GameObjects.Image | null = null;

  hp: number;
  readonly maxHp: number;
  shield: number;
  readonly maxShield: number;

  /** Distance travelled along the path. */
  dist: number;
  /** Cached path segment index for O(1) sampling. */
  seg = 0;
  /** Lateral offset from the road centre line. */
  readonly offset: number;
  x = 0;
  y = 0;
  angle = 0;

  alive = true;
  flashTimer = 0;
  spawnTimer = 0;
  trailTimer = 0;
  readonly phase = Math.random() * Math.PI * 2;
  damagedLook = false;

  constructor(
    scene: Phaser.Scene,
    readonly def: EnemyDef,
    hpScale: number,
    startDist: number,
    offset: number,
  ) {
    this.maxHp = Math.round(def.hp * hpScale);
    this.hp = this.maxHp;
    this.maxShield = Math.round(def.shield * hpScale);
    this.shield = this.maxShield;
    this.dist = startDist;
    this.offset = offset;

    this.shadow = scene.add
      .image(0, 0, 'enemy_shadow')
      .setDepth(DEPTH.ENEMY_SHADOW)
      .setScale((def.radius * 2.4) / 56);
    this.sprite = scene.add.image(0, 0, enemyKey(def.type)).setDepth(DEPTH.ENEMY);

    if (this.maxShield > 0) {
      this.shieldSprite = scene.add
        .image(0, 0, 'shield_bubble')
        .setDepth(DEPTH.ENEMY + 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale((def.radius + 9) / 24);
    }
    if (def.spawn) {
      this.spawnTimer = def.spawn.interval * 0.6;
      this.hatch = scene.add
        .image(0, 0, 'spawner_hatch')
        .setDepth(DEPTH.ENEMY + 0.4)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
    }
  }

  /** Combined health + shield fraction for bars. */
  get damaged(): boolean {
    return this.hp < this.maxHp || this.shield < this.maxShield;
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
    this.shadow.destroy();
    this.shieldSprite?.destroy();
    this.hatch?.destroy();
    this.shieldSprite = null;
    this.hatch = null;
  }
}
