import type { Vec2 } from '../data/maps';

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function rotateToward(from: number, to: number, maxStep: number): number {
  const diff = wrapAngle(to - from);
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PathSample {
  x: number;
  y: number;
  angle: number;
  /** Unit normal (left side of travel). */
  nx: number;
  ny: number;
}

/**
 * Dense polyline with cumulative distances for cheap path following.
 * Corners are rounded with quadratic curves so units turn smoothly.
 */
export class PathData {
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly cum: Float32Array;
  readonly length: number;
  readonly points: Vec2[];

  constructor(corners: Vec2[], radius: number) {
    const pts: Vec2[] = [{ ...corners[0] }];
    for (let i = 1; i < corners.length - 1; i++) {
      const a = corners[i - 1];
      const b = corners[i];
      const c = corners[i + 1];
      const lab = Math.hypot(a.x - b.x, a.y - b.y);
      const lbc = Math.hypot(c.x - b.x, c.y - b.y);
      const r = Math.min(radius, lab / 2, lbc / 2);
      const p1 = { x: b.x + ((a.x - b.x) / lab) * r, y: b.y + ((a.y - b.y) / lab) * r };
      const p2 = { x: b.x + ((c.x - b.x) / lbc) * r, y: b.y + ((c.y - b.y) / lbc) * r };
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        pts.push({
          x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x,
          y: u * u * p1.y + 2 * u * t * b.y + t * t * p2.y,
        });
      }
    }
    pts.push({ ...corners[corners.length - 1] });

    this.points = pts;
    const n = pts.length;
    this.xs = new Float32Array(n);
    this.ys = new Float32Array(n);
    this.cum = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      this.xs[i] = pts[i].x;
      this.ys[i] = pts[i].y;
      if (i > 0) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      this.cum[i] = total;
    }
    this.length = total;
  }

  /**
   * Sample the path at distance `d`. `hint` is the segment index from the
   * previous call (units only move forward), which keeps lookups O(1).
   * Returns the segment index to pass as the next hint.
   */
  sample(d: number, out: PathSample, hint = 0): number {
    const cum = this.cum;
    const last = cum.length - 1;
    let i = hint < 0 ? 0 : hint > last - 1 ? last - 1 : hint;
    if (d < cum[i]) i = 0;
    while (i < last - 1 && cum[i + 1] < d) i++;
    const segLen = cum[i + 1] - cum[i] || 1;
    const t = clamp((d - cum[i]) / segLen, 0, 1);
    const dx = this.xs[i + 1] - this.xs[i];
    const dy = this.ys[i + 1] - this.ys[i];
    out.x = this.xs[i] + dx * t;
    out.y = this.ys[i] + dy * t;
    out.angle = Math.atan2(dy, dx);
    const len = Math.hypot(dx, dy) || 1;
    out.nx = dy / len;
    out.ny = -dx / len;
    return i;
  }

  /** Shortest distance from a point to the path polyline. */
  distanceTo(x: number, y: number): number {
    let best = Infinity;
    for (let i = 0; i < this.xs.length - 1; i++) {
      const ax = this.xs[i];
      const ay = this.ys[i];
      const bx = this.xs[i + 1];
      const by = this.ys[i + 1];
      const abx = bx - ax;
      const aby = by - ay;
      const l2 = abx * abx + aby * aby || 1;
      const t = clamp(((x - ax) * abx + (y - ay) * aby) / l2, 0, 1);
      const d = dist2(x, y, ax + abx * t, ay + aby * t);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}
