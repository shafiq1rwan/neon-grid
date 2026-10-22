import type { EnemyType } from './enemies';
import type { WaveDef, WaveGroup } from './waves';
import { createRng } from '../utils/MathUtils';

/**
 * Endless mode: unlimited generated waves on any cleared sector's map. It
 * exists for playtime (players who clear Sector 1 can keep going far longer
 * than a campaign sector lasts). Waves are deterministic per map + number,
 * so bot balance runs are repeatable.
 */
export const ENDLESS = {
  /** Workshop stars for the best run on any map reaching these waves. */
  milestones: [10, 20, 30] as const,
  /** Minimum start credits (maps with more keep theirs). */
  startCredits: 400,
  /** Seconds between the end of spawning and the next wave. */
  gap: 12,
} as const;

/** HP multiplier per map (geometry differs a lot: crossing roads, long roads...). */
const MAP_DIFFICULTY = [1.0, 1.1, 1.6, 1.3];

export function endlessDifficulty(mapIndex: number): number {
  return MAP_DIFFICULTY[mapIndex] ?? 1.2;
}

/** Wave (1-based) from which each enemy joins the pool. */
const UNLOCK: [EnemyType, number][] = [
  ['drone', 1],
  ['runner', 3],
  ['juggernaut', 5],
  ['specter', 7],
  ['spawner', 9],
  ['medic', 12],
  ['burrower', 14],
];

/** Group shape per enemy: base count, extra per wave, spawn interval. */
const SHAPE: Partial<Record<EnemyType, { base: number; per: number; interval: number }>> = {
  drone: { base: 9, per: 0.6, interval: 0.75 },
  runner: { base: 6, per: 0.45, interval: 0.5 },
  juggernaut: { base: 1, per: 0.09, interval: 4 },
  specter: { base: 3, per: 0.25, interval: 1.4 },
  spawner: { base: 1, per: 0.08, interval: 6 },
  medic: { base: 1, per: 0.1, interval: 3 },
  burrower: { base: 2, per: 0.18, interval: 2 },
};

export function isBossWave(wave: number): boolean {
  return wave % 10 === 0;
}

/** HP scale: quick early growth, then steady (so late waves stay beatable with upgrades). */
export function endlessHpScale(wave: number): number {
  const n = wave - 1;
  return 1 + n * 0.13 + n * n * 0.0035;
}

/** Enemy types that appear for the first time at this wave (for the banner). */
export function newEndlessEnemies(wave: number): EnemyType[] {
  const fresh = UNLOCK.filter(([, w]) => w === wave).map(([t]) => t);
  if (wave === 10) fresh.push('titan');
  return fresh;
}

/** Wave `wave` (1-based) of endless mode on map `mapIndex`. */
export function endlessWave(mapIndex: number, wave: number): WaveDef {
  const rng = createRng(wave * 7919 + mapIndex * 104729 + 13);
  const pool = UNLOCK.filter(([, w]) => w <= wave).map(([t]) => t);
  const groups: WaveGroup[] = [];
  // the newest enemy always features, drones keep the stream busy, plus a
  // random mix from the pool (more groups later on)
  const picks = new Set<EnemyType>([pool[pool.length - 1], 'drone']);
  const want = Math.min(pool.length, 2 + Math.floor(rng() * 2) + (wave >= 15 ? 1 : 0));
  for (let i = 0; i < 20 && picks.size < want; i++) picks.add(pool[Math.floor(rng() * pool.length)]);
  let delay = 0;
  for (const type of picks) {
    const shape = SHAPE[type]!;
    const count = Math.max(1, Math.round(shape.base + shape.per * wave));
    groups.push({ type, count, interval: shape.interval, delay });
    delay += 3 + rng() * 5;
  }
  if (isBossWave(wave)) {
    // boss wave: Titans plus a repair escort once medics exist
    const titans = Math.max(1, Math.floor(wave / 10));
    groups.push({ type: 'titan', count: titans, interval: 8, delay: delay + 2 });
    if (wave >= 20) groups.push({ type: 'medic', count: 2 + Math.floor(wave / 20), interval: 2, delay: delay + 4 });
  }
  return {
    hpScale: endlessHpScale(wave),
    clearBonus: Math.min(120, 30 + wave * 4),
    gap: ENDLESS.gap,
    groups,
  };
}

/** Stars earned from a best wave (one per milestone reached). */
export function endlessStarsFor(bestWave: number): number {
  return ENDLESS.milestones.filter((m) => bestWave >= m).length;
}
