import type { EnemyType } from './enemies';

export interface WaveGroup {
  type: EnemyType;
  count: number;
  /** Seconds between spawns within the group. */
  interval: number;
  /** Seconds after the wave starts before the group begins. */
  delay: number;
  /**
   * Which road (lane) the group uses on multi-lane maps. Omit to alternate
   * spawns between all lanes.
   */
  lane?: number;
}

export interface WaveDef {
  groups: WaveGroup[];
  /** Health multiplier applied to every enemy in the wave. */
  hpScale: number;
  /** Credits awarded once the wave has finished spawning. */
  clearBonus: number;
  /** Seconds from the end of spawning to the next wave (default WAVE_TIMING.betweenWaves). */
  gap?: number;
}

const g = (type: EnemyType, count: number, interval: number, delay = 0, lane?: number): WaveGroup => ({
  type,
  count,
  interval,
  delay,
  lane,
});

/** Sector 1 — Reactor Row: the introductory campaign (10 waves). */
export const WAVES_SECTOR_1: WaveDef[] = [
  // 1–2: basic drones (short gaps: fit-test players left during these easy waves)
  { hpScale: 1, clearBonus: 20, gap: 8, groups: [g('drone', 8, 1.4)] },
  { hpScale: 1.1, clearBonus: 25, gap: 8, groups: [g('drone', 10, 1.1), g('drone', 6, 0.6, 14)] },
  // 3–4: fast runners
  { hpScale: 1.2, clearBonus: 30, gap: 8, groups: [g('drone', 10, 1.1), g('runner', 6, 0.9, 6)] },
  {
    hpScale: 1.32,
    clearBonus: 35,
    groups: [g('runner', 8, 0.7), g('drone', 12, 0.9, 3), g('runner', 8, 0.5, 13)],
  },
  // 5–6: heavy juggernauts
  {
    hpScale: 1.48,
    clearBonus: 45,
    groups: [g('drone', 12, 0.9), g('juggernaut', 2, 5, 5), g('runner', 8, 0.6, 12)],
  },
  // 6–10 were flattened in v1.1.2: the web fit test lost a third of players at wave 8
  {
    hpScale: 1.56,
    clearBonus: 55,
    groups: [g('juggernaut', 3, 4.5), g('drone', 16, 0.75, 2), g('runner', 12, 0.5, 10)],
  },
  // 7–8: shielded specters
  {
    hpScale: 1.64,
    clearBonus: 70,
    groups: [g('specter', 5, 1.6), g('drone', 14, 0.8, 3), g('juggernaut', 1, 1, 12)],
  },
  {
    hpScale: 1.64,
    clearBonus: 75,
    groups: [
      g('specter', 4, 1.8),
      g('runner', 10, 0.55, 6),
      g('juggernaut', 1, 1, 16),
      g('drone', 10, 0.7, 22),
    ],
  },
  // 9: swarm spawners
  {
    hpScale: 1.86,
    clearBonus: 80,
    groups: [
      g('spawner', 2, 7),
      g('drone', 12, 0.8, 2),
      g('specter', 5, 1.5, 8),
      g('runner', 10, 0.5, 14),
    ],
  },
  // 10: final mixed assault
  {
    hpScale: 1.98,
    clearBonus: 0,
    groups: [
      g('drone', 16, 0.65),
      g('runner', 14, 0.5, 4),
      g('juggernaut', 3, 5, 6),
      g('specter', 6, 1.5, 10),
      g('spawner', 2, 8, 14),
      g('juggernaut', 1, 1, 30),
    ],
  },
];

/** Sector 2 — Twin Gates: two entrance roads merge into one (10 waves). */
export const WAVES_SECTOR_2: WaveDef[] = [
  { hpScale: 1.15, clearBonus: 25, groups: [g('drone', 14, 0.9)] },
  { hpScale: 1.25, clearBonus: 30, groups: [g('drone', 10, 1, 0, 0), g('runner', 10, 0.7, 4, 1)] },
  { hpScale: 1.35, clearBonus: 35, groups: [g('runner', 12, 0.6), g('drone', 12, 0.9, 6)] },
  {
    hpScale: 1.45,
    clearBonus: 45,
    groups: [g('juggernaut', 2, 6, 0, 0), g('drone', 14, 0.8, 2, 1), g('runner', 8, 0.5, 12)],
  },
  { hpScale: 1.6, clearBonus: 50, groups: [g('specter', 6, 1.5), g('runner', 12, 0.5, 6), g('drone', 8, 0.8, 12)] },
  {
    hpScale: 1.75,
    clearBonus: 60,
    groups: [g('juggernaut', 3, 5), g('specter', 6, 1.4, 4), g('drone', 14, 0.7, 10)],
  },
  {
    hpScale: 1.9,
    clearBonus: 65,
    groups: [g('spawner', 1, 1, 0, 0), g('runner', 14, 0.45, 2, 1), g('drone', 12, 0.7, 10)],
  },
  {
    hpScale: 2.05,
    clearBonus: 75,
    groups: [g('specter', 10, 1.2), g('juggernaut', 3, 5, 6), g('runner', 12, 0.45, 14)],
  },
  {
    hpScale: 2.2,
    clearBonus: 85,
    groups: [
      g('spawner', 1, 1, 0, 0),
      g('spawner', 1, 1, 3, 1),
      g('specter', 8, 1.3, 8),
      g('runner', 12, 0.45, 14),
    ],
  },
  {
    hpScale: 2.35,
    clearBonus: 0,
    groups: [
      g('drone', 18, 0.55),
      g('runner', 16, 0.45, 4),
      g('juggernaut', 4, 4.5, 6),
      g('specter', 10, 1.2, 10),
      g('spawner', 2, 6, 16),
    ],
  },
];

/** Sector 3 — The Long Road: a long serpentine ending with the Titan (12 waves). */
export const WAVES_SECTOR_3: WaveDef[] = [
  { hpScale: 1.25, clearBonus: 25, groups: [g('drone', 16, 0.8)] },
  { hpScale: 1.35, clearBonus: 30, groups: [g('runner', 12, 0.6), g('drone', 12, 0.8, 5)] },
  { hpScale: 1.45, clearBonus: 40, groups: [g('juggernaut', 2, 6), g('drone', 14, 0.7, 3)] },
  { hpScale: 1.6, clearBonus: 45, groups: [g('specter', 7, 1.4), g('runner', 12, 0.5, 6)] },
  { hpScale: 1.75, clearBonus: 50, groups: [g('spawner', 1, 1), g('drone', 16, 0.7, 3)] },
  { hpScale: 1.9, clearBonus: 60, groups: [g('juggernaut', 4, 4), g('specter', 6, 1.3, 6)] },
  { hpScale: 2.05, clearBonus: 65, groups: [g('runner', 22, 0.35), g('drone', 16, 0.6, 6)] },
  { hpScale: 2.2, clearBonus: 75, groups: [g('spawner', 2, 7), g('specter', 8, 1.2, 4)] },
  { hpScale: 2.35, clearBonus: 80, groups: [g('juggernaut', 5, 3.5), g('runner', 14, 0.45, 8)] },
  {
    hpScale: 2.5,
    clearBonus: 90,
    groups: [g('specter', 12, 1), g('spawner', 2, 6, 6), g('drone', 16, 0.6, 12)],
  },
  {
    hpScale: 2.5,
    clearBonus: 110,
    groups: [g('juggernaut', 4, 3.5), g('specter', 10, 1.1, 4), g('runner', 18, 0.4, 10), g('spawner', 1, 1, 12)],
  },
  {
    hpScale: 2.6,
    clearBonus: 0,
    groups: [g('titan', 1, 1, 6), g('juggernaut', 3, 4, 0), g('specter', 8, 1.3, 10), g('drone', 18, 0.5, 2)],
  },
];

/**
 * Sector 4 — Crossfire Junction: two crossing roads (lane 0 = north gate, the long
 * road; lane 1 = south gate, the short one). Introduces the Repair Drone (wave 2)
 * and the Burrower (wave 3); the Titan returns with a repair escort (12 waves).
 */
export const WAVES_SECTOR_4: WaveDef[] = [
  { hpScale: 1.3, clearBonus: 30, groups: [g('drone', 16, 0.8)] },
  // 2: Repair Drones trail the pack and patch it up
  { hpScale: 1.4, clearBonus: 40, groups: [g('drone', 12, 0.9), g('medic', 3, 3, 3)] },
  // 3: Burrowers dig under the defences
  { hpScale: 1.5, clearBonus: 50, groups: [g('burrower', 4, 2.4), g('runner', 10, 0.6, 6)] },
  {
    hpScale: 1.65,
    clearBonus: 60,
    groups: [g('juggernaut', 1, 1, 0, 0), g('medic', 2, 3, 1, 0), g('drone', 16, 0.7, 4, 1)],
  },
  { hpScale: 1.8, clearBonus: 65, groups: [g('specter', 5, 1.6), g('burrower', 5, 1.8, 5)] },
  {
    hpScale: 1.95,
    clearBonus: 80,
    groups: [g('spawner', 1, 1, 0, 0), g('medic', 2, 4, 2, 0), g('runner', 14, 0.45, 6, 1), g('burrower', 4, 2, 10)],
  },
  {
    hpScale: 2.1,
    clearBonus: 85,
    groups: [g('juggernaut', 3, 4.5), g('medic', 3, 3, 3), g('specter', 6, 1.3, 8)],
  },
  {
    hpScale: 2.25,
    clearBonus: 100,
    groups: [g('burrower', 6, 1.4), g('juggernaut', 2, 4, 3), g('drone', 16, 0.6, 6)],
  },
  {
    hpScale: 2.45,
    clearBonus: 105,
    groups: [g('spawner', 2, 6), g('medic', 4, 2.5, 3), g('specter', 8, 1.2, 8), g('juggernaut', 2, 5, 12)],
  },
  {
    hpScale: 2.7,
    clearBonus: 115,
    groups: [g('juggernaut', 5, 3.5), g('burrower', 8, 1.3, 4), g('medic', 3, 3, 6), g('runner', 14, 0.4, 12)],
  },
  {
    hpScale: 2.85,
    clearBonus: 145,
    groups: [
      g('specter', 10, 1.1),
      g('burrower', 8, 1.2, 4),
      g('spawner', 2, 6, 8),
      g('medic', 4, 2.5, 10),
      g('juggernaut', 3, 4, 14),
    ],
  },
  // 12: finale — the Titan with a repair escort while burrowers dig past
  {
    hpScale: 3.3,
    clearBonus: 0,
    groups: [
      g('drone', 18, 0.5, 2),
      g('juggernaut', 4, 4, 0, 1),
      g('titan', 1, 1, 6, 0),
      g('medic', 4, 2.5, 8, 0),
      g('burrower', 10, 1.2, 10),
      g('specter', 8, 1.3, 14),
    ],
  },
];

export function waveEnemyCount(wave: WaveDef): number {
  let n = 0;
  for (const grp of wave.groups) n += grp.count;
  return n;
}
