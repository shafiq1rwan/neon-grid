export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/**
 * Extra scenery baked around the battlefield for wider/taller screens
 * (covers up to ~2.8:1, e.g. a phone with the browser bar showing, and 4:3 tablets).
 */
export const VIEW_PAD = { x: 380, y: 140 } as const;

export const COLORS = {
  bg: 0x0b1020,
  metal: 0x19243a,
  raised: 0x28364f,
  cyan: 0x00e5ff,
  pink: 0xff3dae,
  orange: 0xff9b32,
  purple: 0xa78bfa,
  green: 0x4dff88,
  red: 0xff526f,
  teal: 0x2ef2d0,
  ice: 0xa9e8ff,
  gold: 0xffd34d,
  white: 0xffffff,
  text: 0xdce7ff,
  textDim: 0x8a9bbd,
  panel: 0x0d1424,
} as const;

/** Convert a 0xRRGGBB number to a CSS colour string. */
export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Render layers inside the GameScene. */
export const DEPTH = {
  BG: 0,
  AMBIENT: 2,
  PLATFORM_HINT: 5,
  RANGE: 8,
  REACTOR: 10,
  ENEMY_SHADOW: 14,
  ENEMY: 20,
  TOWER: 30,
  PROJECTILE: 40,
  EFFECT: 50,
  BARS: 60,
  FLOAT: 70,
} as const;

export const ECONOMY = {
  startCredits: 220,
  sellRefund: 0.7,
  /** Credits awarded per remaining countdown second when a wave is called early. */
  earlyCallBonusPerSecond: 2,
  startingHp: 20,
} as const;

export const WAVE_TIMING = {
  /** Seconds before the first wave starts automatically. */
  firstWaveCountdown: 25,
  /** Once the first tower is built, wave 1 starts within this many seconds. */
  afterFirstTower: 6,
  /** Seconds between the end of one wave's spawning and the next wave. */
  betweenWaves: 14,
} as const;

/** Signature mechanic: hacking corrupted machines (see docs/GAME_DESIGN.md → Hacking). */
export const HACK = {
  startCharges: 1,
  maxCharges: 3,
  /** Kills needed to earn a charge (every third wave start also gives one). */
  killsPerCharge: 28,
  /** Charges a Juggernaut hack costs (a deliberate big play). */
  heavyCost: 2,
  /** Real seconds for the lock-on ring to close. */
  lockTime: 0.85,
  /** Lock progress (0..1) from which a second tap is a PERFECT hack. */
  perfectFrom: 0.72,
  /** Real seconds after the ring closes that still count as PERFECT. */
  perfectGrace: 0.12,
  /** World speed while locking on (bullet time). */
  timeWarp: 0.3,
  /** Seconds a hacked machine stays hacked before it short-circuits. */
  duration: 8,
  perfectBonusDuration: 2,
  blastRadius: 72,
  /** Blast damage = hacked machine's max HP × this … */
  blastHpMult: 1.25,
  /** … capped at this × the enemy's HP scale. */
  blastCap: 380,
  perfectDamage: 1.45,
  perfectRadius: 1.25,
  /** Extra contact distance before a hacked machine detonates. */
  contactPad: 14,
} as const;

export const SCENES = {
  boot: 'BootScene',
  menu: 'MenuScene',
  sectors: 'SectorScene',
  game: 'GameScene',
  ui: 'UIScene',
  result: 'ResultScene',
} as const;
