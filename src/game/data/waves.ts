import type { EnemyType } from './enemies';

export interface WaveGroup {
  type: EnemyType;
  count: number;
  /** Seconds between spawns within the group. */
  interval: number;
  /** Seconds after the wave starts before the group begins. */
  delay: number;
}

export interface WaveDef {
  groups: WaveGroup[];
  /** Health multiplier applied to every enemy in the wave. */
  hpScale: number;
  /** Credits awarded once the wave has finished spawning. */
  clearBonus: number;
}

const g = (type: EnemyType, count: number, interval: number, delay = 0): WaveGroup => ({
  type,
  count,
  interval,
  delay,
});

export const WAVES: WaveDef[] = [
  // 1–2: basic drones
  { hpScale: 1, clearBonus: 20, groups: [g('drone', 8, 1.4)] },
  { hpScale: 1.1, clearBonus: 25, groups: [g('drone', 10, 1.1), g('drone', 6, 0.6, 14)] },
  // 3–4: fast runners
  { hpScale: 1.2, clearBonus: 30, groups: [g('drone', 10, 1.1), g('runner', 6, 0.9, 6)] },
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
  {
    hpScale: 1.64,
    clearBonus: 50,
    groups: [g('juggernaut', 3, 4.5), g('drone', 16, 0.75, 2), g('runner', 12, 0.5, 10)],
  },
  // 7–8: shielded specters
  {
    hpScale: 1.82,
    clearBonus: 60,
    groups: [g('specter', 6, 1.6), g('drone', 14, 0.8, 3), g('juggernaut', 2, 5, 10)],
  },
  {
    hpScale: 2.0,
    clearBonus: 65,
    groups: [
      g('specter', 7, 1.4),
      g('runner', 12, 0.5, 5),
      g('juggernaut', 2, 5, 9),
      g('drone', 10, 0.7, 14),
    ],
  },
  // 9: swarm spawners
  {
    hpScale: 2.22,
    clearBonus: 75,
    groups: [
      g('spawner', 2, 7),
      g('drone', 12, 0.8, 2),
      g('specter', 6, 1.4, 8),
      g('runner', 10, 0.5, 14),
    ],
  },
  // 10: final mixed assault
  {
    hpScale: 2.3,
    clearBonus: 0,
    groups: [
      g('drone', 16, 0.65),
      g('runner', 14, 0.5, 4),
      g('juggernaut', 3, 5, 6),
      g('specter', 8, 1.4, 10),
      g('spawner', 2, 8, 14),
      g('juggernaut', 1, 1, 30),
    ],
  },
];

export function waveEnemyCount(wave: WaveDef): number {
  let n = 0;
  for (const grp of wave.groups) n += grp.count;
  return n;
}

/** Enemy types that appear for the first time in the given wave (index). */
export function newEnemiesInWave(index: number): EnemyType[] {
  const seen = new Set<EnemyType>();
  for (let i = 0; i < index; i++) for (const grp of WAVES[i].groups) seen.add(grp.type);
  const fresh: EnemyType[] = [];
  for (const grp of WAVES[index].groups) {
    if (!seen.has(grp.type) && !fresh.includes(grp.type)) fresh.push(grp.type);
  }
  return fresh;
}
