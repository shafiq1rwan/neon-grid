import { COLORS } from '../config';

export type TowerType = 'pulse' | 'cannon' | 'missile' | 'tesla' | 'laser';

/** How a tower delivers damage. */
export type AttackKind = 'bolt' | 'shell' | 'missile' | 'chain' | 'beam';

export interface TowerLevel {
  /** Cost to build (level 1) or to upgrade into this level. */
  cost: number;
  /** Damage per hit, or damage per second for beams. */
  damage: number;
  /** Seconds between attacks. Unused by beams. */
  fireInterval: number;
  range: number;
  projectileSpeed?: number;
  splashRadius?: number;
  chainCount?: number;
  chainRange?: number;
  /** Seconds a beam needs to charge before it deals damage. */
  warmup?: number;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  description: string;
  color: number;
  attack: AttackKind;
  /** Multiplier applied to damage dealt to energy shields. */
  shieldMultiplier: number;
  /** Ignores enemy armor (flat per-hit reduction). */
  piercing: boolean;
  /** Turn rate of the weapon in radians per second. */
  turnRate: number;
  levels: [TowerLevel, TowerLevel, TowerLevel];
}

export const TOWER_ORDER: TowerType[] = ['pulse', 'cannon', 'missile', 'tesla', 'laser'];

export const TOWERS: Record<TowerType, TowerDef> = {
  pulse: {
    type: 'pulse',
    name: 'Pulse Tower',
    description: 'Fast single-target shots. Cheap starter.',
    color: COLORS.cyan,
    attack: 'bolt',
    shieldMultiplier: 1,
    piercing: false,
    turnRate: 12,
    levels: [
      { cost: 70, damage: 9, fireInterval: 0.34, range: 135, projectileSpeed: 640 },
      { cost: 75, damage: 15, fireInterval: 0.3, range: 145, projectileSpeed: 680 },
      { cost: 125, damage: 23, fireInterval: 0.24, range: 160, projectileSpeed: 720 },
    ],
  },
  cannon: {
    type: 'cannon',
    name: 'Cannon Tower',
    description: 'Heavy shells. Smashes armor.',
    color: COLORS.pink,
    attack: 'shell',
    shieldMultiplier: 1,
    piercing: true,
    turnRate: 5,
    levels: [
      { cost: 110, damage: 46, fireInterval: 1.3, range: 140, projectileSpeed: 560 },
      { cost: 105, damage: 78, fireInterval: 1.2, range: 150, projectileSpeed: 600 },
      { cost: 175, damage: 128, fireInterval: 1.05, range: 162, projectileSpeed: 640 },
    ],
  },
  missile: {
    type: 'missile',
    name: 'Missile Tower',
    description: 'Splash damage for groups.',
    color: COLORS.orange,
    attack: 'missile',
    shieldMultiplier: 1,
    piercing: false,
    turnRate: 4,
    levels: [
      { cost: 130, damage: 30, fireInterval: 1.8, range: 170, projectileSpeed: 300, splashRadius: 62 },
      { cost: 125, damage: 50, fireInterval: 1.6, range: 182, projectileSpeed: 330, splashRadius: 72 },
      { cost: 195, damage: 76, fireInterval: 1.4, range: 198, projectileSpeed: 360, splashRadius: 84 },
    ],
  },
  tesla: {
    type: 'tesla',
    name: 'Tesla Tower',
    description: 'Chains arcs. Melts shields.',
    color: COLORS.purple,
    attack: 'chain',
    shieldMultiplier: 2,
    piercing: false,
    turnRate: 0,
    levels: [
      { cost: 120, damage: 20, fireInterval: 0.95, range: 125, chainCount: 3, chainRange: 90 },
      { cost: 115, damage: 30, fireInterval: 0.85, range: 135, chainCount: 4, chainRange: 98 },
      { cost: 185, damage: 44, fireInterval: 0.72, range: 148, chainCount: 6, chainRange: 108 },
    ],
  },
  laser: {
    type: 'laser',
    name: 'Laser Tower',
    description: 'Sustained beam. Needs warm-up.',
    color: COLORS.green,
    attack: 'beam',
    shieldMultiplier: 1.5,
    piercing: true,
    turnRate: 7,
    levels: [
      { cost: 150, damage: 52, fireInterval: 0, range: 150, warmup: 0.8 },
      { cost: 140, damage: 88, fireInterval: 0, range: 162, warmup: 0.65 },
      { cost: 220, damage: 140, fireInterval: 0, range: 178, warmup: 0.5 },
    ],
  },
};

/** Damage per second at a given level, used for UI comparison bars. */
export function towerDps(def: TowerDef, levelIndex: number): number {
  const l = def.levels[levelIndex];
  if (def.attack === 'beam') return l.damage;
  let dps = l.damage / l.fireInterval;
  if (def.attack === 'chain') dps *= 1 + ((l.chainCount ?? 1) - 1) * 0.5;
  if (def.attack === 'missile') dps *= 1.8;
  return dps;
}

export function totalInvestment(def: TowerDef, levelIndex: number): number {
  let total = 0;
  for (let i = 0; i <= levelIndex; i++) total += def.levels[i].cost;
  return total;
}
