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
  /** Gap between hit flashes under a continuous beam (else a lasered machine stays white). */
  beamFlashCooldown = 0;
  /** Current frost slow (fraction of speed removed) and its remaining time. */
  slowAmount = 0;
  slowTimer = 0;
  spawnTimer = 0;
  trailTimer = 0;
  exhaustTimer = 0;
  damageSmokeTimer = 0;
  impactTimer = 0;
  /** Hacked machines walk back down the road and detonate on contact. */
  hacked = false;
  hackTimer = 0;
  hackPerfect = false;
  /** Short glitch flicker right after being hacked. */
  glitchTimer = 0;
  /** Cyan signal icon floating above a hacked machine. */
  hackMark: Phaser.GameObjects.Image | null = null;
  /** Cyan halo that makes hacked machines read as ours at a glance. */
  hackGlow: Phaser.GameObjects.Image | null = null;
  readonly phase = Math.random() * Math.PI * 2;
  damagedLook = false;
  /** Kill reward multiplier (machines in densified wave groups pay less each). */
  rewardMult = 1;
  /** Set by HackSystem while a lock-on targets this machine (a Burrower won't dig in mid-lock). */
  hackLock = false;

  /** Repair Drone: seconds until the next repair pulse, and its charge-up glow. */
  healTimer = 0;
  aura: Phaser.GameObjects.Image | null = null;

  /**
   * Burrower: true while underground. Burrowed machines are skipped by every
   * targeting query, take no damage, can't be slowed and can't be hacked.
   */
  burrowed = false;
  /** Seconds left above ground before digging in. */
  surfaceTimer = 0;
  /** Road distance left to travel underground. */
  burrowLeft = 0;
  /** 0..1 dig-in / dig-out animation (1 = fully underground). */
  sink = 0;
  /** Alternates the dust wake left / right of the mound. */
  wakeSide = 1;
  /** Dirt mound that travels along the road while burrowed. */
  mound: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly def: EnemyDef,
    hpScale: number,
    startDist: number,
    offset: number,
    /** Index of the road this enemy follows. */
    readonly lane = 0,
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
    if (def.heal) {
      this.healTimer = def.heal.interval * (0.5 + Math.random() * 0.3);
      this.aura = scene.add
        .image(0, 0, 'fx_glow')
        .setDepth(DEPTH.ENEMY - 0.5)
        .setTint(def.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
    }
    if (def.burrow) {
      this.surfaceTimer = def.burrow.surface * (0.6 + Math.random() * 0.4);
      this.mound = scene.add.image(0, 0, 'burrow_mound').setDepth(DEPTH.ENEMY_SHADOW + 0.2).setVisible(false);
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
    this.hackMark?.destroy();
    this.hackGlow?.destroy();
    this.aura?.destroy();
    this.mound?.destroy();
    this.aura = null;
    this.mound = null;
    this.shieldSprite = null;
    this.hatch = null;
    this.hackMark = null;
    this.hackGlow = null;
  }
}
