import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, VIEW_PAD, css } from '../config';
import type { BuildingDef, MapDef, PropDef, Vec2 } from '../data/maps';
import { PathData, createRng, dist2 } from '../utils/MathUtils';
import {
  bakeTexture,
  bolt,
  circle,
  ellipse,
  energyCore,
  fillPoly,
  fillRR,
  glow,
  line,
  metalGradient,
  neonDot,
  neonLine,
  noGlow,
  octagon,
  prism,
  radial,
  regularPoly,
  shade,
  vents,
  type Ctx,
} from './CanvasKit';

/** Positions of neon signs baked into the background (for flicker overlays). */
export interface SignInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export const PLATFORM_RADIUS = 36;

/** World-space rectangle covered by the baked background (battlefield + padding). */
const AREA = {
  x: -VIEW_PAD.x,
  y: -VIEW_PAD.y,
  w: GAME_WIDTH + VIEW_PAD.x * 2,
  h: GAME_HEIGHT + VIEW_PAD.y * 2,
};
const rx = (rng: () => number) => AREA.x + rng() * AREA.w;
const ry = (rng: () => number) => AREA.y + rng() * AREA.h;

export function bgKey(map: MapDef): string {
  return `bg_${map.id}`;
}

/** Textures shared by every map (vignette, reactor parts). Bake once at boot. */
export function generateSharedEnvironment(scene: Phaser.Scene): void {
  // screen-space vignette, stretched over whatever area is visible
  bakeTexture(scene, 'vignette', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  bakeTexture(scene, 'reactor_base', 160, 160, (ctx) => {
    ctx.translate(80, 84);
    drawReactorBase(ctx);
  });
  bakeTexture(scene, 'reactor_ring', 120, 120, (ctx) => {
    ctx.translate(60, 60);
    drawReactorRing(ctx);
  });
  bakeTexture(scene, 'reactor_core', 72, 72, (ctx) => {
    ctx.translate(36, 36);
    energyCore(ctx, 0, 0, 14, COLORS.cyan);
  });
}

/**
 * Bakes a map's whole static battlefield (ground, roads, ruins, props,
 * platforms) into one texture so it costs a single sprite draw per frame.
 * Cached: baking only happens the first time a map is shown.
 */
export function ensureMapBackground(scene: Phaser.Scene, map: MapDef, paths: PathData[]): SignInfo[] {
  const key = bgKey(map);
  const signsKey = `signs_${map.id}`;
  if (scene.textures.exists(key)) return (scene.registry.get(signsKey) as SignInfo[] | undefined) ?? [];

  const signs: SignInfo[] = [];
  const rng = createRng(map.seed);
  const scenery =
    map.buildings && map.props ? { buildings: map.buildings, props: map.props } : autoScenery(map, paths, rng);

  bakeTexture(scene, key, AREA.w, AREA.h, (ctx) => {
    // draw in world coordinates; the texture is placed at (AREA.x, AREA.y)
    ctx.translate(-AREA.x, -AREA.y);
    drawGround(ctx, rng);
    for (const path of paths) drawRoad(ctx, map, path, rng);
    for (const lane of map.paths) drawEntry(ctx, lane[0]);
    const blockers: Vec2[] = [...map.platforms, map.reactor];
    drawReactorPad(ctx, map.reactor);
    drawRubbleField(ctx, map, paths, rng, blockers);
    for (const path of paths) drawStreetlights(ctx, map, path);
    const sorted = [...scenery.buildings].sort((a, b) => a.y + a.d + a.h - (b.y + b.d + b.h));
    for (const b of sorted) drawBuilding(ctx, b, rng, signs);
    for (const p of scenery.props) drawProp(ctx, p, rng);
    for (const p of map.platforms) drawPlatform(ctx, p.x, p.y, rng);
  });
  scene.registry.set(signsKey, signs);
  return signs;
}

/** Seeded procedural buildings and props that keep clear of roads and platforms. */
function autoScenery(map: MapDef, paths: PathData[], rng: () => number): { buildings: BuildingDef[]; props: PropDef[] } {
  const half = map.roadWidth / 2;
  const clear = (x: number, y: number, margin: number): boolean => {
    for (const p of paths) if (p.distanceTo(x, y) < half + margin) return false;
    for (const p of map.platforms) if (dist2(x, y, p.x, p.y) < 62 * 62) return false;
    if (dist2(x, y, map.reactor.x, map.reactor.y) < 100 * 100) return false;
    if (dist2(x, y, map.waveButton.x, map.waveButton.y) < 60 * 60) return false;
    return true;
  };
  const buildings: BuildingDef[] = [];
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const signColors = [COLORS.pink, COLORS.cyan, COLORS.purple, COLORS.orange];
  for (let tries = 0; tries < 1400 && buildings.length < 40; tries++) {
    // try big blocks first, then fill gaps with smaller ones
    const big = tries < 700;
    const w = big ? 100 + rng() * 80 : 64 + rng() * 50;
    const d = big ? 48 + rng() * 34 : 38 + rng() * 22;
    const h = big ? 44 + rng() * 30 : 34 + rng() * 22;
    const x = AREA.x + 8 + rng() * (AREA.w - w - 16);
    const y = AREA.y + 8 + rng() * (AREA.h - d - h - 16);
    const fx = x - 6;
    const fy = y - 6;
    const fw = w + 24;
    const fh = d + h + 18;
    let ok = true;
    for (const r of rects) {
      if (fx < r.x + r.w && fx + fw > r.x && fy < r.y + r.h && fy + fh > r.y) {
        ok = false;
        break;
      }
    }
    for (let px = fx; ok && px <= fx + fw; px += 16) {
      for (let py = fy; py <= fy + fh; py += 16) {
        if (!clear(px, py, 12)) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    rects.push({ x: fx, y: fy, w: fw, h: fh });
    buildings.push({
      x,
      y,
      w,
      d,
      h,
      ruined: rng() < 0.4,
      sign: rng() < 0.35 ? signColors[Math.floor(rng() * signColors.length)] : undefined,
    });
  }
  const props: PropDef[] = [];
  const kinds: PropDef['kind'][] = ['car', 'car', 'truck', 'crate', 'barrier', 'tank'];
  for (let tries = 0; tries < 600 && props.length < 26; tries++) {
    const x = AREA.x + rng() * AREA.w;
    const y = AREA.y + rng() * AREA.h;
    if (!clear(x, y, 34)) continue;
    if (rects.some((r) => x > r.x - 30 && x < r.x + r.w + 30 && y > r.y - 30 && y < r.y + r.h + 30)) continue;
    props.push({ kind: kinds[Math.floor(rng() * kinds.length)], x, y, angle: rng() * Math.PI * 2 });
  }
  return { buildings, props };
}

/* ------------------------------------------------------------------ */

function drawGround(ctx: Ctx, rng: () => number): void {
  ctx.fillStyle = css(COLORS.bg);
  ctx.fillRect(AREA.x, AREA.y, AREA.w, AREA.h);

  // large weathered patches
  for (let i = 0; i < 70; i++) {
    const x = rx(rng);
    const y = ry(rng);
    const r = 40 + rng() * 120;
    const light = rng() < 0.45;
    ctx.fillStyle = radial(ctx, x, y, r, [
      [0, light ? 'rgba(40,54,80,0.35)' : 'rgba(3,5,10,0.45)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // concrete slab grid
  ctx.strokeStyle = 'rgba(70,90,130,0.09)';
  ctx.lineWidth = 1;
  for (let x = -384; x <= GAME_WIDTH + 384; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, AREA.y);
    ctx.lineTo(x + 0.5, AREA.y + AREA.h);
    ctx.stroke();
  }
  for (let y = -192; y <= GAME_HEIGHT + 192; y += 64) {
    ctx.beginPath();
    ctx.moveTo(AREA.x, y + 0.5);
    ctx.lineTo(AREA.x + AREA.w, y + 0.5);
    ctx.stroke();
  }

  // speckle grit
  for (let i = 0; i < 2300; i++) {
    const x = rx(rng);
    const y = ry(rng);
    ctx.fillStyle = rng() < 0.5 ? 'rgba(90,110,150,0.12)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }

  // ground cracks
  for (let i = 0; i < 40; i++) crack(ctx, rx(rng), ry(rng), 30 + rng() * 60, rng, 'rgba(0,0,0,0.55)');
}

function crack(ctx: Ctx, x: number, y: number, len: number, rng: () => number, color: string): void {
  let a = rng() * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  const steps = 4 + Math.floor(rng() * 4);
  for (let s = 0; s < steps; s++) {
    a += (rng() - 0.5) * 1.3;
    cx += Math.cos(a) * (len / steps);
    cy += Math.sin(a) * (len / steps);
    ctx.lineTo(cx, cy);
    if (rng() < 0.3) {
      const ba = a + (rng() - 0.5) * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ba) * len * 0.25, cy + Math.sin(ba) * len * 0.25);
      ctx.moveTo(cx, cy);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function strokePath(ctx: Ctx, pts: Vec2[], width: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Offset a polyline sideways (approximate parallel curve). */
function offsetPath(pts: Vec2[], off: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    out.push({ x: pts[i].x + (dy / len) * off, y: pts[i].y - (dx / len) * off });
  }
  return out;
}

function drawRoad(ctx: Ctx, map: MapDef, path: PathData, rng: () => number): void {
  const pts = path.points;
  const w = map.roadWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  // shoulder / curb
  strokePath(ctx, pts, w + 26, 'rgba(4,6,12,0.65)');
  strokePath(ctx, pts, w + 16, css(0x1a2335));
  strokePath(ctx, pts, w + 10, css(0x232e45));
  // asphalt
  strokePath(ctx, pts, w, css(0x121828));

  // asphalt wear patches along the road
  for (let d = 0; d < path.length; d += 26) {
    const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
    path.sample(d, s);
    const off = (rng() - 0.5) * w * 0.7;
    const x = s.x + s.nx * off;
    const y = s.y + s.ny * off;
    const r = 8 + rng() * 18;
    ctx.fillStyle = radial(ctx, x, y, r, [
      [0, rng() < 0.5 ? 'rgba(40,52,76,0.35)' : 'rgba(0,0,0,0.35)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // glowing dashed edge guides
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.lineCap = 'round';
  glow(ctx, 0x6f7dff, 6);
  for (const side of [-1, 1]) {
    strokePath(ctx, offsetPath(pts, side * (w / 2 - 5)), 2, 'rgba(120,140,255,0.55)');
  }
  ctx.restore();

  // faded centre line
  ctx.save();
  ctx.setLineDash([10, 22]);
  strokePath(ctx, pts, 2, 'rgba(255,200,120,0.12)');
  ctx.restore();

  // cracks, potholes and manholes on the road
  for (let i = 0; i < 34; i++) {
    const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
    path.sample(rng() * path.length, s);
    const off = (rng() - 0.5) * w * 0.8;
    crack(ctx, s.x + s.nx * off, s.y + s.ny * off, 16 + rng() * 26, rng, 'rgba(0,0,0,0.75)');
  }
  for (let i = 0; i < 9; i++) {
    const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
    path.sample(60 + rng() * (path.length - 160), s);
    const off = (rng() - 0.5) * w * 0.5;
    const x = s.x + s.nx * off;
    const y = s.y + s.ny * off;
    if (rng() < 0.6) {
      ellipse(ctx, x, y, 6 + rng() * 6, 4 + rng() * 3, 'rgba(2,3,6,0.75)', 'rgba(60,70,95,0.4)', 1);
    } else {
      circle(ctx, x, y, 7, css(0x1a2133), 'rgba(80,95,125,0.5)', 1);
      line(ctx, x - 5, y, x + 5, y, 'rgba(0,0,0,0.5)', 1);
      line(ctx, x, y - 5, x, y + 5, 'rgba(0,0,0,0.5)', 1);
    }
  }
}

function drawEntry(ctx: Ctx, start: Vec2): void {
  // broken city gate where the machines enter
  const y = start.y;
  for (const side of [-1, 1]) {
    const gy = y + side * 50;
    const blk = [0, gy - 12, 26, gy - 12, 26, gy + 8, 0, gy + 8];
    prism(ctx, blk.map((v, i) => (i % 2 ? v - 10 : v)), 10, metalGradient(ctx, 0, gy - 22, 26, 20, COLORS.raised), css(0x0a101c), css(0x3c4d6e));
    neonDot(ctx, 20, gy - 12, 2, COLORS.red, 8);
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  neonLine(ctx, 4, y - 38, 4, y + 38, COLORS.red, 1.5, 10);
  ctx.restore();
}

function drawRubbleField(ctx: Ctx, map: MapDef, paths: PathData[], rng: () => number, blockers: Vec2[]): void {
  const half = map.roadWidth / 2;
  let placed = 0;
  for (let tries = 0; tries < 2000 && placed < 220; tries++) {
    const x = rx(rng);
    const y = ry(rng);
    if (paths.some((p) => p.distanceTo(x, y) < half + 12)) continue;
    let ok = true;
    for (const b of blockers) if (dist2(x, y, b.x, b.y) < 52 * 52) ok = false;
    if (!ok) continue;
    placed++;
    const n = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const rx = x + (rng() - 0.5) * 18;
      const ry = y + (rng() - 0.5) * 12;
      const r = 2 + rng() * 5;
      const pts = regularPoly(rx, ry, r, 4 + Math.floor(rng() * 3), rng() * 3, 0.7);
      ctx.save();
      ctx.translate(1, 2);
      fillPoly(ctx, pts, 'rgba(0,0,0,0.45)');
      ctx.restore();
      const tone = 0x2a3448 + Math.floor(rng() * 3) * 0x050505;
      fillPoly(ctx, pts, metalGradient(ctx, rx - r, ry - r, r * 2, r * 2, tone, 1.5, 0.7), 'rgba(90,110,150,0.25)', 0.6);
    }
    if (rng() < 0.18) {
      // twisted rebar
      line(ctx, x - 8, y + 2, x + 9, y - 6, 'rgba(120,90,70,0.6)', 1);
    }
  }
}

function drawStreetlights(ctx: Ctx, map: MapDef, path: PathData): void {
  const half = map.roadWidth / 2 + 14;
  const s = { x: 0, y: 0, angle: 0, nx: 0, ny: 0 };
  let side = 1;
  let index = 0;
  for (let d = 120; d < path.length - 80; d += 190) {
    path.sample(d, s);
    side = -side;
    index++;
    const x = s.x + s.nx * half * side;
    const y = s.y + s.ny * half * side;
    let ok = true;
    for (const p of map.platforms) if (dist2(x, y, p.x, p.y) < 50 * 50) ok = false;
    if (!ok) continue;
    const broken = index % 3 === 0;
    const armX = -s.nx * side * 16;
    const armY = -s.ny * side * 16;
    if (!broken) {
      const lx = x + armX;
      const ly = y + armY;
      ctx.fillStyle = radial(ctx, lx, ly + 6, 46, [
        [0, index % 2 ? 'rgba(0,229,255,0.16)' : 'rgba(255,170,90,0.14)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.fillRect(lx - 46, ly - 40, 92, 92);
    }
    circle(ctx, x, y, 3.5, css(0x2a3650), css(0x0a0e18), 1);
    if (broken) {
      line(ctx, x, y, x + armX * 1.2 + 6, y + armY * 1.2 + 10, css(0x3a4560), 2.2);
    } else {
      line(ctx, x, y, x + armX, y + armY, css(0x3a4560), 2.2);
      neonDot(ctx, x + armX, y + armY, 2, index % 2 ? COLORS.cyan : 0xffb46a, 8);
    }
  }
}

function drawBuilding(ctx: Ctx, b: BuildingDef, rng: () => number, signs: SignInfo[]): void {
  const { x, y, w, d, h } = b;
  // cast shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(x + w, y + 6);
  ctx.lineTo(x + w + 18, y + 20);
  ctx.lineTo(x + w + 18, y + d + h + 10);
  ctx.lineTo(x + 10, y + d + h + 10);
  ctx.lineTo(x, y + d + h);
  ctx.closePath();
  ctx.fill();

  // facade
  const fg = ctx.createLinearGradient(0, y + d, 0, y + d + h);
  fg.addColorStop(0, css(0x182136));
  fg.addColorStop(1, css(0x0c111d));
  ctx.fillStyle = fg;
  ctx.fillRect(x, y + d, w, h);
  ctx.strokeStyle = 'rgba(70,90,130,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + d + 0.5, w - 1, h - 1);

  // windows
  const litPalette = [0xffb060, COLORS.pink, COLORS.cyan, 0xffe0a0];
  for (let wy = y + d + 7; wy < y + d + h - 8; wy += 13) {
    for (let wx = x + 7; wx < x + w - 10; wx += 14) {
      const roll = rng();
      if (roll < 0.1) {
        const c = litPalette[Math.floor(rng() * litPalette.length)];
        ctx.save();
        glow(ctx, c, 6);
        ctx.fillStyle = css(c, 0.55);
        ctx.fillRect(wx, wy, 7, 6);
        ctx.restore();
      } else if (roll < 0.25 && b.ruined) {
        // blown-out window
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(wx - 1, wy - 1, 9, 8);
      } else {
        ctx.fillStyle = 'rgba(4,7,14,0.85)';
        ctx.fillRect(wx, wy, 7, 6);
        ctx.fillStyle = 'rgba(90,120,170,0.12)';
        ctx.fillRect(wx, wy, 7, 1.5);
      }
    }
  }

  // roof
  let roof: number[];
  if (b.ruined) {
    const cut = 0.3 + rng() * 0.25;
    roof = [x, y, x + w * (1 - cut), y, x + w * (1 - cut * 0.5), y + d * 0.45, x + w, y + d * 0.35, x + w, y + d, x, y + d];
  } else {
    roof = [x, y, x + w, y, x + w, y + d, x, y + d];
  }
  fillPoly(ctx, roof, metalGradient(ctx, x, y, w, d, 0x1f2a40, 1.25, 0.75), 'rgba(110,135,180,0.4)', 1);
  if (b.ruined) {
    // exposed floor beams in the collapsed section
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let k = 0; k < 4; k++) {
      const bx = x + w * (0.72 + k * 0.07);
      line(ctx, bx, y + 2, bx - 4, y + d * 0.5, css(0x3a3a46), 1.5);
    }
    ctx.restore();
    for (let k = 0; k < 6; k++) {
      const rx = x + w * (0.6 + rng() * 0.4);
      const ry = y + d + h - 2 + rng() * 10;
      fillPoly(ctx, regularPoly(rx, ry, 3 + rng() * 5, 5, rng() * 3, 0.7), css(0x2a3448), 'rgba(0,0,0,0.5)', 0.6);
    }
  }
  // parapet line
  line(ctx, x + 3, y + 3, x + w * 0.6, y + 3, 'rgba(150,175,220,0.18)', 1);

  // rooftop equipment
  const units = 1 + Math.floor(rng() * 3);
  for (let k = 0; k < units; k++) {
    const ux = x + 10 + rng() * (w * 0.55);
    const uy = y + 8 + rng() * Math.max(4, d - 26);
    const uw = 12 + rng() * 14;
    const uh = 8 + rng() * 8;
    prism(ctx, [ux, uy, ux + uw, uy, ux + uw, uy + uh, ux, uy + uh], 4, css(0x2a364f), css(0x0d1322), 'rgba(110,135,180,0.4)');
    vents(ctx, ux + 2, uy + 2, uw - 4, uh - 4, 3);
  }
  if (rng() < 0.6) {
    const tx = x + w * 0.78;
    const ty = y + d * 0.55;
    if (!b.ruined) {
      circle(ctx, tx, ty + 2, 9, 'rgba(0,0,0,0.4)');
      circle(ctx, tx, ty, 8, metalGradient(ctx, tx - 8, ty - 8, 16, 16, 0x2a364f), 'rgba(110,135,180,0.4)', 1);
      circle(ctx, tx, ty, 4, undefined, 'rgba(0,0,0,0.5)', 1);
    }
  }
  // antenna with warning light
  if (rng() < 0.7) {
    const ax = x + 8 + rng() * (w - 16);
    const ay = y + 6 + rng() * 10;
    line(ctx, ax, ay, ax + 3, ay - 16, css(0x5a6a88), 1.2);
    neonDot(ctx, ax + 3, ay - 16, 1.5, COLORS.red, 6);
  }

  // neon sign on the facade
  if (b.sign !== undefined) {
    const sw = Math.min(w * 0.42, 54);
    const sh = 14;
    const sx = x + w * 0.5 - sw / 2 + (rng() - 0.5) * w * 0.25;
    const sy = y + d + Math.max(4, h * 0.25);
    fillRR(ctx, sx - 2, sy - 2, sw + 4, sh + 4, 2, 'rgba(5,8,15,0.95)');
    ctx.save();
    glow(ctx, b.sign, 10);
    ctx.strokeStyle = css(b.sign);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(sx, sy, sw, sh);
    // abstract glyph strokes (no real text)
    ctx.beginPath();
    let gx = sx + 5;
    while (gx < sx + sw - 6) {
      const kind = Math.floor(rng() * 3);
      if (kind === 0) {
        ctx.moveTo(gx, sy + 3.5);
        ctx.lineTo(gx, sy + sh - 3.5);
        ctx.moveTo(gx, sy + 3.5);
        ctx.lineTo(gx + 4, sy + 3.5);
      } else if (kind === 1) {
        ctx.moveTo(gx, sy + sh / 2);
        ctx.lineTo(gx + 4, sy + sh / 2);
        ctx.moveTo(gx + 2, sy + 3.5);
        ctx.lineTo(gx + 2, sy + sh - 3.5);
      } else {
        ctx.moveTo(gx, sy + sh - 3.5);
        ctx.lineTo(gx + 2, sy + 3.5);
        ctx.lineTo(gx + 4, sy + sh - 3.5);
      }
      gx += 7;
    }
    ctx.stroke();
    ctx.restore();
    signs.push({ x: sx + sw / 2, y: sy + sh / 2, w: sw, h: sh, color: b.sign });
  }
}

function drawProp(ctx: Ctx, p: PropDef, rng: () => number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  switch (p.kind) {
    case 'car':
    case 'truck': {
      const long = p.kind === 'truck';
      const L = long ? 58 : 36;
      const W = long ? 22 : 17;
      const tones = [0x3a2a2c, 0x23304a, 0x2e2e36, 0x3b3322];
      const tone = tones[Math.floor(rng() * tones.length)];
      fillRR(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 5, 'rgba(0,0,0,0.5)');
      fillRR(ctx, -L / 2, -W / 2, L, W, 5, metalGradient(ctx, -L / 2, -W / 2, L, W, tone, 1.5, 0.6), 'rgba(0,0,0,0.7)', 1);
      if (long) {
        fillRR(ctx, L / 2 - 16, -W / 2 + 2, 13, W - 4, 3, metalGradient(ctx, 0, -W / 2, 14, W, shade(tone, 1.2), 1.5, 0.7), 'rgba(0,0,0,0.6)');
        fillRR(ctx, L / 2 - 6, -W / 2 + 4, 3, W - 8, 1, 'rgba(120,170,220,0.25)');
        for (let k = 0; k < 4; k++) line(ctx, -L / 2 + 6 + k * 9, -W / 2 + 2, -L / 2 + 6 + k * 9, W / 2 - 2, 'rgba(0,0,0,0.4)', 1);
      } else {
        fillRR(ctx, -8, -W / 2 + 2.5, 18, W - 5, 3, 'rgba(10,14,22,0.9)');
        fillRR(ctx, 8, -W / 2 + 3, 4, W - 6, 1.5, 'rgba(120,170,220,0.22)');
        fillRR(ctx, -11, -W / 2 + 3, 3, W - 6, 1.5, 'rgba(120,170,220,0.15)');
      }
      // scorch mark
      ellipse(ctx, -L * 0.15, 0, L * 0.22, W * 0.3, 'rgba(0,0,0,0.45)');
      // dead headlights
      circle(ctx, L / 2 - 2, -W / 2 + 3.5, 1.4, 'rgba(255,220,160,0.25)');
      circle(ctx, L / 2 - 2, W / 2 - 3.5, 1.4, 'rgba(255,220,160,0.25)');
      break;
    }
    case 'tank': {
      circle(ctx, 4, 6, 22, 'rgba(0,0,0,0.45)');
      circle(ctx, 0, 0, 20, metalGradient(ctx, -20, -20, 40, 40, 0x26324a, 1.5, 0.65), 'rgba(110,135,180,0.45)', 1.2);
      circle(ctx, 0, 0, 14, undefined, 'rgba(0,0,0,0.5)', 1.4);
      circle(ctx, 0, 0, 6, css(0x1a2234), 'rgba(110,135,180,0.4)', 1);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        bolt(ctx, Math.cos(a) * 17, Math.sin(a) * 17, 1);
      }
      ctx.save();
      ctx.globalAlpha = 0.6;
      neonLine(ctx, -16, 12, -6, 18, COLORS.green, 1.2, 6);
      ctx.restore();
      fillRR(ctx, 18, -4, 26, 8, 3, css(0x222c40), 'rgba(0,0,0,0.6)');
      break;
    }
    case 'pipes': {
      for (let k = 0; k < 3; k++) {
        const py = -10 + k * 9;
        fillRR(ctx, -70 + 2, py + 3, 140, 7, 3.5, 'rgba(0,0,0,0.45)');
        const g = ctx.createLinearGradient(0, py, 0, py + 7);
        g.addColorStop(0, css(0x4a5878));
        g.addColorStop(0.5, css(0x2a3550));
        g.addColorStop(1, css(0x141b2b));
        fillRR(ctx, -70, py, 140, 7, 3.5, g);
        for (let j = -60; j < 70; j += 32) fillRR(ctx, j, py - 1, 4, 9, 1, css(0x3a4866));
      }
      break;
    }
    case 'barrier': {
      for (let k = -1; k <= 1; k++) {
        const bx = k * 17;
        const pts = [bx - 7, -4, bx + 7, -4, bx + 7, 3, bx - 7, 3];
        prism(ctx, pts, 4, css(0x3a4152), css(0x161b26), 'rgba(140,150,170,0.35)');
        ctx.save();
        ctx.globalAlpha = 0.45;
        for (let s = -6; s < 7; s += 4) line(ctx, bx + s, -3, bx + s + 2, 2, css(0xffb43a), 1.4);
        ctx.restore();
      }
      break;
    }
    case 'crate': {
      const pts = [-11, -9, 11, -9, 11, 7, -11, 7];
      prism(ctx, pts, 6, metalGradient(ctx, -11, -9, 22, 16, 0x2b3a2e, 1.5, 0.7), css(0x111811), 'rgba(140,170,140,0.35)');
      line(ctx, -11, -9, 11, 7, 'rgba(0,0,0,0.4)', 1);
      line(ctx, 11, -9, -11, 7, 'rgba(0,0,0,0.4)', 1);
      break;
    }
  }
  ctx.restore();
}

function drawPlatform(ctx: Ctx, x: number, y: number, rng: () => number): void {
  const r = PLATFORM_RADIUS;
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 2, 8, r + 6, r * 0.8 + 6, 'rgba(0,0,0,0.5)');
  const outer = octagon(0, 0, r, 0.8);
  prism(ctx, outer, 6, metalGradient(ctx, -r, -r, r * 2, r * 2, 0x222c40, 1.35, 0.7), css(0x0a0f1a), 'rgba(110,135,180,0.45)');

  // hazard stripe ring
  ctx.save();
  polyPathLocal(ctx, octagon(0, 0, r - 3, 0.8));
  ctx.clip();
  ctx.globalAlpha = 0.28;
  for (let k = -r * 2; k < r * 2; k += 9) {
    line(ctx, k, -r, k + r, r, css(0xffb43a), 3.2);
  }
  ctx.restore();
  const inner = octagon(0, -1, r * 0.72, 0.8);
  fillPoly(ctx, inner, metalGradient(ctx, -r, -r, r * 1.4, r * 1.4, 0x1a2236, 1.3, 0.75), 'rgba(110,135,180,0.35)', 1);
  // worn targeting glyph
  ctx.save();
  ctx.globalAlpha = 0.35;
  ellipse(ctx, 0, -1, r * 0.42, r * 0.34, undefined, css(COLORS.cyan), 1);
  line(ctx, -r * 0.55, -1, -r * 0.3, -1, css(COLORS.cyan), 1);
  line(ctx, r * 0.3, -1, r * 0.55, -1, css(COLORS.cyan), 1);
  ctx.restore();
  // corner lights (dim cyan)
  for (const i of [1, 3, 5, 7]) {
    neonDot(ctx, outer[i * 2] * 0.86, outer[i * 2 + 1] * 0.86, 1.4, COLORS.cyan, 5);
  }
  for (const i of [0, 2, 4, 6]) bolt(ctx, outer[i * 2] * 0.9, outer[i * 2 + 1] * 0.9, 1.2);
  crack(ctx, (rng() - 0.5) * r, (rng() - 0.5) * r * 0.6, 14, rng, 'rgba(0,0,0,0.6)');
  // rust stain
  ellipse(ctx, (rng() - 0.5) * r, (rng() - 0.5) * r * 0.5, 6, 4, 'rgba(120,60,30,0.18)');
  ctx.restore();
}

function polyPathLocal(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function drawReactorPad(ctx: Ctx, p: Vec2): void {
  ctx.fillStyle = radial(ctx, p.x, p.y, 150, [
    [0, 'rgba(0,229,255,0.16)'],
    [0.5, 'rgba(0,229,255,0.05)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(p.x - 150, p.y - 150, 300, 300);
  // power conduits running off-screen
  for (const [dx, dy] of [
    [1, -1],
    [1, 1],
    [0, 1],
  ]) {
    const ex = p.x + dx * 200;
    const ey = p.y + dy * 260;
    line(ctx, p.x, p.y, ex, ey, css(0x0a0f1a), 9);
    line(ctx, p.x, p.y, ex, ey, css(0x1c2740), 5);
    ctx.save();
    ctx.globalAlpha = 0.5;
    neonLine(ctx, p.x, p.y, ex, ey, COLORS.cyan, 1, 6);
    ctx.restore();
  }
}

function drawReactorBase(ctx: Ctx): void {
  const r = 52;
  ellipse(ctx, 3, 12, r + 10, r * 0.8 + 10, 'rgba(0,0,0,0.6)');
  const outer = octagon(0, 0, r, 0.8);
  prism(ctx, outer, 12, metalGradient(ctx, -r, -r, r * 2, r * 2, COLORS.metal, 1.6, 0.7), css(0x0a101c), 'rgba(110,135,180,0.6)');
  // front light band
  neonLine(ctx, -r * 0.35, r * 0.8 * 0.924 + 6, r * 0.35, r * 0.8 * 0.924 + 6, COLORS.cyan, 2, 8);
  const mid = octagon(0, -4, r * 0.78, 0.8);
  prism(ctx, mid, 6, metalGradient(ctx, -r, -r, r * 2, r * 2, COLORS.raised, 1.4, 0.7), css(0x111827), 'rgba(110,135,180,0.5)');
  // capacitor pylons around the core
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * r * 0.62;
    const py = Math.sin(a) * r * 0.62 * 0.8 - 4;
    const blk = [px - 4, py - 10, px + 4, py - 10, px + 4, py, px - 4, py];
    prism(ctx, blk, 6, metalGradient(ctx, px - 4, py - 10, 8, 10, COLORS.raised, 1.6, 0.7), css(0x0a101c), 'rgba(110,135,180,0.5)');
    neonDot(ctx, px, py - 10, 1.8, COLORS.cyan, 8);
  }
  // core well
  ellipse(ctx, 0, -6, 24, 19, css(0x05080f), 'rgba(0,229,255,0.6)', 1.5);
  ctx.save();
  glow(ctx, COLORS.cyan, 12);
  ellipse(ctx, 0, -6, 19, 15, undefined, css(COLORS.cyan), 1.2);
  ctx.restore();
  vents(ctx, -r * 0.92, -6, 7, 14, 3);
  vents(ctx, r * 0.92 - 7, -6, 7, 14, 3);
  for (const i of [0, 2, 4, 6]) bolt(ctx, outer[i * 2] * 0.9, outer[i * 2 + 1] * 0.9, 1.6);
  noGlow(ctx);
}

function drawReactorRing(ctx: Ctx): void {
  ctx.save();
  glow(ctx, COLORS.cyan, 8);
  ctx.strokeStyle = css(COLORS.cyan, 0.85);
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, 44, a, a + 0.7);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = css(COLORS.cyan, 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
