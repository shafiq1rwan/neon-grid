import type { Enemy } from '../entities/Enemy';

/**
 * Stateless target queries. Squared distances only; no allocations except the
 * reusable chain buffer.
 */
export const Targeting = {
  /** Enemy furthest along the path within range (default "first" priority). */
  first(enemies: readonly Enemy[], x: number, y: number, range: number): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestDist = -1;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const pad = e.def.radius;
      if (dx * dx + dy * dy > r2 + pad * pad + 2 * range * pad) continue;
      if (e.dist > bestDist) {
        bestDist = e.dist;
        best = e;
      }
    }
    return best;
  },

  inRange(e: Enemy, x: number, y: number, range: number): boolean {
    if (!e.alive) return false;
    const dx = e.x - x;
    const dy = e.y - y;
    const r = range + e.def.radius;
    return dx * dx + dy * dy <= r * r;
  },

  /** Nearest living enemy to (x, y) within `range` that is not in `exclude`. */
  nearest(
    enemies: readonly Enemy[],
    x: number,
    y: number,
    range: number,
    exclude: readonly Enemy[],
  ): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestD = r2;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || exclude.includes(e)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  },

  /** Collect enemies within a radius into `out` (cleared first). */
  within(enemies: readonly Enemy[], x: number, y: number, radius: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const r = radius + e.def.radius * 0.5;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r * r) out.push(e);
    }
    return out;
  },
};
