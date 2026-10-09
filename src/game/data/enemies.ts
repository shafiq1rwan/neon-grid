import { COLORS } from '../config';

export type EnemyType = 'drone' | 'runner' | 'juggernaut' | 'specter' | 'spawner' | 'mini' | 'titan';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  /** One-line hint shown when the enemy is first introduced. */
  tip: string;
  hp: number;
  /** Energy shield absorbed before health. */
  shield: number;
  /** Flat damage reduction per hit (non-piercing attacks). */
  armor: number;
  /** Pixels per second along the road. */
  speed: number;
  reward: number;
  /** Reactor damage when the enemy escapes. */
  leakDamage: number;
  /** Collision / visual radius. */
  radius: number;
  color: number;
  /** Fraction of frost slow ignored (bosses shrug off some of it). */
  slowResist?: number;
  spawn?: { type: EnemyType; count: number; interval: number };
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  drone: {
    type: 'drone',
    name: 'Corrupted Drone',
    tip: 'Basic machine. Any tower works.',
    hp: 60,
    shield: 0,
    armor: 0,
    speed: 64,
    reward: 5,
    leakDamage: 1,
    radius: 11,
    color: COLORS.red,
  },
  runner: {
    type: 'runner',
    name: 'Rift Runner',
    tip: 'Very fast but fragile. Pulse towers shine.',
    hp: 44,
    shield: 0,
    armor: 0,
    speed: 128,
    reward: 7,
    leakDamage: 1,
    radius: 9,
    color: COLORS.teal,
  },
  juggernaut: {
    type: 'juggernaut',
    name: 'Wasteland Juggernaut',
    tip: 'Heavy armor shrugs off small hits. Use Cannons or Lasers.',
    hp: 560,
    shield: 0,
    armor: 5,
    speed: 34,
    reward: 30,
    leakDamage: 3,
    radius: 20,
    color: COLORS.orange,
    slowResist: 0.25,
  },
  specter: {
    type: 'specter',
    name: 'Shielded Specter',
    tip: 'Energy shield absorbs damage. Tesla arcs deal double to shields.',
    hp: 120,
    shield: 130,
    armor: 0,
    speed: 58,
    reward: 18,
    leakDamage: 2,
    radius: 14,
    color: COLORS.purple,
  },
  spawner: {
    type: 'spawner',
    name: 'Swarm Spawner',
    tip: 'Releases drones as it advances. Kill it fast!',
    hp: 540,
    shield: 0,
    armor: 2,
    speed: 38,
    reward: 36,
    leakDamage: 3,
    radius: 19,
    color: COLORS.red,
    spawn: { type: 'mini', count: 2, interval: 4.5 },
  },
  mini: {
    type: 'mini',
    name: 'Swarmling',
    tip: '',
    hp: 22,
    shield: 0,
    armor: 0,
    speed: 82,
    reward: 2,
    leakDamage: 1,
    radius: 7,
    color: COLORS.red,
  },
  titan: {
    type: 'titan',
    name: 'Titan War Machine',
    tip: 'Boss! Massive armor. Focus Cannons and Lasers on it.',
    hp: 2600,
    shield: 0,
    armor: 8,
    speed: 22,
    reward: 220,
    leakDamage: 10,
    radius: 32,
    color: COLORS.red,
    slowResist: 0.5,
  },
};
