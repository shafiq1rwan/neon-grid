import Phaser from 'phaser';
import { COLORS, css } from '../config';
import { TOWERS, TOWER_ORDER, type TowerType } from '../data/towers';
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
  shade,
  vents,
  type Ctx,
} from './CanvasKit';

/*
 * Towers are split into a static base (foundation + armour, baked once) and a
 * rotating weapon assembly. Everything is pre-rendered per level so upgrades
 * swap textures instead of redrawing geometry at runtime.
 */

export const TOWER_TEX = 128;
/** Tesla pylons are tall, so their base texture is taller with a lower anchor. */
export const TESLA_TEX_H = 176;
export const TESLA_ANCHOR_Y = 124;
/** Offset from tower centre to the weapon pivot. */
export const GUN_OFFSET_Y = -6;

const METAL = COLORS.metal;
const RAISED = COLORS.raised;
const DARK = 0x0d1322;
const EDGE = css(0x4a5e82);
const EDGE_DIM = css(0x2c3b56);
const DARK_SIDE = css(0x0a101c);

export function baseKey(type: TowerType, level: number): string {
  return `tw_${type}_${level}_base`;
}
export function gunKey(type: TowerType, level: number): string {
  return `tw_${type}_${level}_gun`;
}
export function iconKey(type: TowerType, level: number): string {
  return `tw_${type}_${level}_icon`;
}

/** Height of the tesla column top above the tower centre for a level. */
export function teslaTopY(level: number): number {
  return -(36 + level * 8);
}

export function generateTowerTextures(scene: Phaser.Scene): void {
  for (const type of TOWER_ORDER) {
    const color = TOWERS[type].color;
    for (let level = 1; level <= 3; level++) {
      if (type === 'tesla') {
        bakeTexture(scene, baseKey(type, level), TOWER_TEX, TESLA_TEX_H, (ctx) => {
          ctx.translate(TOWER_TEX / 2, TESLA_ANCHOR_Y);
          drawTesla(ctx, level, color);
        });
      } else {
        bakeTexture(scene, baseKey(type, level), TOWER_TEX, TOWER_TEX, (ctx) => {
          ctx.translate(TOWER_TEX / 2, TOWER_TEX / 2);
          drawFoundation(ctx, level, color);
          drawMountRing(ctx, level, color);
        });
        bakeTexture(scene, gunKey(type, level), TOWER_TEX, TOWER_TEX, (ctx) => {
          ctx.translate(TOWER_TEX / 2, TOWER_TEX / 2);
          drawGun(ctx, type, level, color);
        });
      }
      bakeTexture(scene, iconKey(type, level), TOWER_TEX, TOWER_TEX, (ctx) => {
        if (type === 'tesla') {
          ctx.translate(TOWER_TEX / 2, TOWER_TEX * 0.8);
          ctx.scale(0.78, 0.78);
          drawTesla(ctx, level, color);
          drawTeslaOrbAt(ctx, 0, teslaTopY(level) - 6, 9 + level, color);
        } else {
          ctx.translate(TOWER_TEX / 2, TOWER_TEX / 2 + 6);
          drawFoundation(ctx, level, color);
          drawMountRing(ctx, level, color);
          ctx.translate(0, GUN_OFFSET_Y);
          ctx.rotate(-0.55);
          drawGun(ctx, type, level, color);
        }
      });
    }
  }
  bakeTexture(scene, 'tesla_orb', 48, 48, (ctx) => drawTeslaOrbAt(ctx, 24, 24, 10, COLORS.purple));
}

/* ------------------------------------------------------------------ */
/* Shared foundation                                                   */
/* ------------------------------------------------------------------ */

function drawFoundation(ctx: Ctx, level: number, color: number): void {
  const r = 25 + level * 3;
  const sq = 0.8;
  const h = 8 + level;

  // contact shadow
  ellipse(ctx, 3, 10, r + 6, r * sq + 7, 'rgba(0,0,0,0.55)');

  // outer slab
  const outer = octagon(0, 0, r, sq);
  prism(ctx, outer, h, metalGradient(ctx, -r, -r, r * 2, r * 2, METAL, 1.6, 0.7), DARK_SIDE, EDGE);

  // neon strips along the visible front faces
  const fy = r * 0.924 * sq + h * 0.5;
  const fx = r * 0.383;
  if (level === 1) {
    neonLine(ctx, -fx * 0.6, fy, -fx * 0.15, fy, color, 1.6, 6);
    neonLine(ctx, fx * 0.15, fy, fx * 0.6, fy, color, 1.6, 6);
  } else {
    neonLine(ctx, -fx * 0.85, fy, fx * 0.85, fy, color, 1.8, 7);
    // diagonal faces
    const dx1 = r * 0.924;
    const dy1 = r * 0.383 * sq + h * 0.5;
    neonLine(ctx, fx + 3, fy - 2, dx1 - 3, dy1 + 2, color, 1.4, 6);
    neonLine(ctx, -fx - 3, fy - 2, -dx1 + 3, dy1 + 2, color, 1.4, 6);
  }

  // armour seams from inner plate to the outer corners
  const inner = octagon(0, -3, r * 0.72, sq);
  for (let i = 0; i < 8; i++) {
    line(ctx, inner[i * 2], inner[i * 2 + 1], outer[i * 2], outer[i * 2 + 1], 'rgba(0,0,0,0.55)', 1.2);
  }

  // side vents in the outer ring
  vents(ctx, -r * 0.95, -5, 5, 10, 3);
  vents(ctx, r * 0.95 - 5, -5, 5, 10, 3);

  // inner raised plate
  prism(
    ctx,
    inner,
    4,
    metalGradient(ctx, -r, -r, r * 1.4, r * 1.4, RAISED, 1.45, 0.75),
    css(0x121a2b),
    EDGE,
  );

  // bolts on diagonal corners of the outer slab
  for (const i of [0, 2, 4, 6]) {
    const bx = outer[i * 2] * 0.88;
    const by = outer[i * 2 + 1] * 0.88;
    bolt(ctx, bx, by, 1.4);
  }

  if (level >= 2) {
    // corner armour blocks with indicator lights
    for (const i of [1, 3, 5, 7]) {
      const ax = outer[i * 2] * 0.86;
      const ay = outer[i * 2 + 1] * 0.86;
      const blk = [ax - 5, ay - 4, ax + 5, ay - 4, ax + 6, ay + 3, ax - 6, ay + 3];
      prism(ctx, blk, 3, css(RAISED), DARK_SIDE, EDGE);
      neonDot(ctx, ax, ay - 0.5, 1.2, color, 5);
    }
  }

  if (level === 3) {
    // glowing rim and corner pylons
    ctx.save();
    ctx.globalAlpha = 0.7;
    glow(ctx, color, 8);
    fillPoly(ctx, outer, 'rgba(0,0,0,0)', css(color), 1.2);
    ctx.restore();
    for (const i of [0, 2, 4, 6]) {
      const px = outer[i * 2] * 1.0;
      const py = outer[i * 2 + 1] * 1.0;
      const p = [px - 3.5, py - 3, px + 3.5, py - 3, px + 3.5, py + 3, px - 3.5, py + 3];
      const lifted = p.map((v, k) => (k % 2 ? v - 7 : v));
      prism(ctx, lifted, 7, css(shade(RAISED, 1.2)), DARK_SIDE, EDGE);
      neonDot(ctx, px, py - 7, 2, color, 8);
    }
  }
}

function drawMountRing(ctx: Ctx, level: number, color: number): void {
  const r = 14 + level * 1.5;
  ellipse(ctx, 0, GUN_OFFSET_Y + 1.5, r + 2, r * 0.86 + 2, css(0x070b14));
  ctx.save();
  ctx.globalAlpha = 0.85;
  glow(ctx, color, 6);
  ellipse(ctx, 0, GUN_OFFSET_Y + 1.5, r, r * 0.86, undefined, css(color), 1.1);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Weapon assemblies (drawn pointing +X, pivot at origin)              */
/* ------------------------------------------------------------------ */

function drawGun(ctx: Ctx, type: TowerType, level: number, color: number): void {
  const s = 1 + (level - 1) * 0.09;
  ctx.save();
  ctx.scale(s, s);
  switch (type) {
    case 'pulse':
      drawPulseGun(ctx, level, color);
      break;
    case 'cannon':
      drawCannonGun(ctx, level, color);
      break;
    case 'missile':
      drawMissileGun(ctx, level, color);
      break;
    case 'laser':
      drawLaserGun(ctx, level, color);
      break;
    case 'tesla':
      break;
  }
  ctx.restore();
}

function housing(ctx: Ctx, pts: number[], x: number, y: number, w: number, h: number): void {
  // drop shadow under the turret for height
  ctx.save();
  ctx.translate(2, 3);
  fillPoly(ctx, pts, 'rgba(0,0,0,0.45)');
  ctx.restore();
  fillPoly(ctx, pts, metalGradient(ctx, x, y, w, h, RAISED, 1.55, 0.7), EDGE, 1.2);
}

function drawPulseGun(ctx: Ctx, level: number, c: number): void {
  const ext = level >= 2 ? 5 : 0;
  const len = 26 + ext + (level === 3 ? 3 : 0);

  // side rails
  if (level >= 2) {
    for (const y of [-9.5, 6]) {
      fillRR(ctx, 4, y, 20 + ext, 3.5, 1.5, css(DARK), EDGE_DIM);
      neonDot(ctx, 24 + ext, y + 1.75, 1.2, c, 5);
    }
  }
  // capacitor pods
  if (level === 3) {
    for (const y of [-14, 14]) {
      circle(ctx, -4, y, 6, metalGradient(ctx, -10, y - 6, 12, 12, RAISED), EDGE, 1.1);
      energyCore(ctx, -4, y, 2.6, c);
    }
  }

  // barrel
  fillRR(ctx, 4, -3.8, len, 7.6, 2.2, metalGradient(ctx, 4, -4, len, 8, DARK, 2.2, 0.8), EDGE, 1);
  neonLine(ctx, 9, 0, len + 1, 0, c, 1.7, 7);
  if (level === 3) {
    for (let k = 0; k < 3; k++) {
      ctx.save();
      glow(ctx, c, 6);
      fillRR(ctx, 12 + k * 6.5, -5.5, 2.6, 11, 1, css(c));
      ctx.restore();
    }
  }
  // muzzle emitter
  fillRR(ctx, len, -5.5, 6, 11, 2, metalGradient(ctx, len, -6, 6, 12, RAISED), EDGE);
  neonDot(ctx, len + 3.5, 0, 2.4, c, 9);

  // housing
  const hw = level === 1 ? 0 : 2;
  const pts = [
    -15 - hw, -11 - hw, 5, -11 - hw, 11 + hw, -6, 11 + hw, 6, 5, 11 + hw, -15 - hw, 11 + hw,
    -19 - hw, 6, -19 - hw, -6,
  ];
  housing(ctx, pts, -19, -12, 30, 24);
  // inner panel + seams
  fillPoly(ctx, [-11, -7, 3, -7, 7, -3, 7, 3, 3, 7, -11, 7], css(shade(RAISED, 0.8)), EDGE_DIM, 0.8);
  line(ctx, -15 - hw, -11 - hw + 1, 4, -11 - hw + 1, 'rgba(160,190,230,0.45)', 0.8);
  vents(ctx, -18 - hw, -5, 4, 10, 3);
  energyCore(ctx, -2, 0, 3.8, c);
  bolt(ctx, -13 - hw, -8.5 - hw, 1.1);
  bolt(ctx, -13 - hw, 8.5 + hw, 1.1);
  bolt(ctx, 5, -8.5 - hw, 1.1);
  bolt(ctx, 5, 8.5 + hw, 1.1);
  if (level >= 2) {
    neonLine(ctx, -12, -11 - hw - 0.5, 2, -11 - hw - 0.5, c, 1, 4);
    neonLine(ctx, -12, 11 + hw + 0.5, 2, 11 + hw + 0.5, c, 1, 4);
  }
}

function drawCannonGun(ctx: Ctx, level: number, c: number): void {
  const barrels = level === 3 ? [-7, 7] : [0];
  const len = level === 1 ? 22 : 26;
  const bw = level === 3 ? 9 : level === 2 ? 13 : 12;

  for (const by of barrels) {
    fillRR(ctx, 6, by - bw / 2, len, bw, 2.5, metalGradient(ctx, 6, by - bw / 2, len, bw, DARK, 2.4, 0.8), EDGE);
    // reinforcement bands
    for (let k = 0; k < 3; k++) {
      const bx = 10 + k * 6;
      line(ctx, bx, by - bw / 2 + 1, bx, by + bw / 2 - 1, 'rgba(0,0,0,0.6)', 1.3);
    }
    neonLine(ctx, 9, by - bw / 2 + 1.6, 6 + len - 3, by - bw / 2 + 1.6, c, 0.9, 4);
    // muzzle brake
    const mx = 6 + len - 2;
    fillRR(ctx, mx, by - bw / 2 - 2.5, 8, bw + 5, 2, metalGradient(ctx, mx, by - 8, 8, 16, RAISED), EDGE);
    line(ctx, mx + 3, by - bw / 2 - 1, mx + 3, by - 2, '#05080f', 1.3);
    line(ctx, mx + 3, by + 2, mx + 3, by + bw / 2 + 1, '#05080f', 1.3);
    circle(ctx, mx + 8, by, bw * 0.28, '#05080f');
  }

  if (level === 3) {
    // ammo drum at the rear
    circle(ctx, -19, 0, 9, metalGradient(ctx, -28, -9, 18, 18, RAISED), EDGE, 1.2);
    ctx.save();
    glow(ctx, c, 6);
    circle(ctx, -19, 0, 6, undefined, css(c), 1.2);
    ctx.restore();
    circle(ctx, -19, 0, 3, css(DARK));
  }

  // heavy armoured housing
  const e = level === 1 ? 0 : 2;
  const pts = [
    -17 - e, -14 - e, 6, -14 - e, 13 + e, -8, 13 + e, 8, 6, 14 + e, -17 - e, 14 + e, -20 - e, 10,
    -20 - e, -10,
  ];
  housing(ctx, pts, -20, -15, 33, 30);
  // front wedge armour
  fillPoly(ctx, [4, -10, 12 + e, -6, 12 + e, 6, 4, 10], css(shade(RAISED, 1.2)), EDGE, 1);
  // side skirts
  if (level >= 2) {
    fillRR(ctx, -16, -19 - e + 2, 20, 4.5, 1.5, css(shade(RAISED, 0.9)), EDGE);
    fillRR(ctx, -16, 15 + e - 2, 20, 4.5, 1.5, css(shade(RAISED, 0.9)), EDGE);
  }
  // pink vents
  for (const y of [-10, 10]) {
    neonLine(ctx, -14, y, -4, y, c, 1.4, 6);
  }
  // hatch with energy core
  circle(ctx, -6, 0, 6.5, css(DARK), EDGE, 1);
  energyCore(ctx, -6, 0, 4, c);
  vents(ctx, -19 - e, -6, 4, 12, 3);
  bolt(ctx, -15, -11, 1.2);
  bolt(ctx, -15, 11, 1.2);
  bolt(ctx, 3, -11, 1.2);
  bolt(ctx, 3, 11, 1.2);
}

function drawMissileGun(ctx: Ctx, level: number, c: number): void {
  const rows = level === 1 ? [-6, 6] : level === 2 ? [-10, 0, 10] : [-15, -5, 5, 15];
  const half = rows.length * 5 + 4;

  // side armour plates
  if (level >= 2) {
    fillRR(ctx, -16, -half - 4, 24, 5, 2, css(shade(RAISED, 0.9)), EDGE);
    fillRR(ctx, -16, half - 1, 24, 5, 2, css(shade(RAISED, 0.9)), EDGE);
    neonLine(ctx, -12, -half - 1.5, 4, -half - 1.5, c, 1, 4);
    neonLine(ctx, -12, half + 1.5, 4, half + 1.5, c, 1, 4);
  }

  // launcher box
  const box = [-18, -half, 12, -half, 16, -half + 4, 16, half - 4, 12, half, -18, half];
  housing(ctx, box, -18, -half, 34, half * 2);

  // missile tubes with warheads
  for (const y of rows) {
    fillRR(ctx, -12, y - 4.3, 27, 8.6, 3, '#070b14', EDGE_DIM, 1);
    fillRR(ctx, -8, y - 2.5, 19, 5, 2.2, css(0xc9d2e3));
    line(ctx, -6, y, 9, y, 'rgba(60,70,90,0.6)', 0.8);
    // fins
    fillPoly(ctx, [-9, y - 3.6, -5, y - 2.5, -5, y + 2.5, -9, y + 3.6], css(0x8792a8));
    ctx.save();
    glow(ctx, c, 7);
    fillPoly(ctx, [11, y - 2.6, 17.5, y, 11, y + 2.6], css(c));
    ctx.restore();
  }

  // rear exhaust grille + core
  vents(ctx, -17, -half + 3, 4, half * 2 - 6, rows.length + 1);
  energyCore(ctx, -14, 0, 2.6, c);

  if (level >= 2) {
    // targeting sensor
    fillRR(ctx, -4, -half - 7, 9, 6, 2, css(RAISED), EDGE);
    neonDot(ctx, 3, -half - 4, 1.7, c, 6);
  }
  if (level === 3) {
    // extra shoulder pods
    for (const sy of [-half - 9, half + 4]) {
      fillRR(ctx, -14, sy, 14, 5, 2, css(DARK), EDGE);
      neonDot(ctx, 0, sy + 2.5, 1.5, c, 5);
    }
  }
}

function drawLaserGun(ctx: Ctx, level: number, c: number): void {
  const len = 26 + (level - 1) * 4;

  // cooling fins along the barrel
  if (level >= 2) {
    for (let k = 0; k < 3; k++) {
      const fx = 10 + k * 5;
      fillRR(ctx, fx, -8, 2.5, 16, 1, css(shade(RAISED, 0.85)), EDGE_DIM, 0.8);
    }
  }
  // barrel
  fillRR(ctx, 4, -3.6, len, 7.2, 2, metalGradient(ctx, 4, -4, len, 8, DARK, 2.2, 0.8), EDGE);
  neonLine(ctx, 8, 0, len, 0, c, 1.5, 6);

  // focusing lens assembly
  const lx = 4 + len;
  if (level === 3) {
    ctx.save();
    for (const sgn of [-1, 1]) {
      fillPoly(ctx, [lx - 4, sgn * 6, lx + 8, sgn * 4, lx + 6, sgn * 9, lx - 6, sgn * 11], css(RAISED), EDGE);
      neonDot(ctx, lx + 6, sgn * 6, 1.3, c, 5);
    }
    ctx.restore();
  }
  ellipse(ctx, lx, 0, 4, 8.5 + level, metalGradient(ctx, lx - 4, -9, 8, 18, RAISED), EDGE, 1.1);
  ctx.save();
  glow(ctx, c, 10);
  ellipse(
    ctx,
    lx + 2.5,
    0,
    2.6,
    6 + level,
    radial(ctx, lx + 2.5, 0, 7 + level, [
      [0, '#ffffff'],
      [0.4, css(shade(c, 1.4))],
      [1, css(c)],
    ]),
  );
  ctx.restore();
  if (level >= 2) {
    ellipse(ctx, lx - 10, 0, 2.5, 6.5, css(RAISED), EDGE, 1);
    neonDot(ctx, lx - 10, 0, 1.3, c, 4);
  }

  // housing with heatsink fins on the rear
  for (let k = 0; k < 4; k++) {
    const fy = -9 + k * 6;
    fillRR(ctx, -22, fy - 1, 7, 2.4, 1, css(shade(RAISED, 0.8)), EDGE_DIM, 0.6);
  }
  const e = level - 1;
  const pts = [-16 - e, -11 - e, 4, -11 - e, 10, -5, 10, 5, 4, 11 + e, -16 - e, 11 + e, -18 - e, 8, -18 - e, -8];
  housing(ctx, pts, -18, -12, 28, 24);
  fillPoly(ctx, [-12, -6, 2, -6, 5, -2, 5, 2, 2, 6, -12, 6], css(shade(RAISED, 0.78)), EDGE_DIM, 0.8);
  if (level >= 2) {
    neonLine(ctx, -14, -11 - e + 2, 0, -11 - e + 2, c, 1.1, 5);
    neonLine(ctx, -14, 11 + e - 2, 0, 11 + e - 2, c, 1.1, 5);
  }
  energyCore(ctx, -4, 0, 3.6, c);
  bolt(ctx, -14, -8, 1.1);
  bolt(ctx, -14, 8, 1.1);
}

/* ------------------------------------------------------------------ */
/* Tesla pylon (non-rotating)                                          */
/* ------------------------------------------------------------------ */

function drawTesla(ctx: Ctx, level: number, c: number): void {
  drawFoundation(ctx, level, c);
  const top = teslaTopY(level);

  // satellite pylons at level 2+
  if (level >= 2) {
    const sats = level === 3 ? [-21, 21] : [-19, 19];
    const sh = level === 3 ? 22 : 13;
    for (const sx of sats) {
      fillRR(ctx, sx - 3, -sh - 2, 6, sh + 2, 1.5, metalGradient(ctx, sx - 3, -sh, 6, sh, RAISED), EDGE);
      ctx.save();
      glow(ctx, c, 5);
      ellipse(ctx, sx, -sh * 0.55, 5, 2, undefined, css(c), 1.2);
      ctx.restore();
      neonDot(ctx, sx, -sh - 3, level === 3 ? 2.6 : 1.8, c, 8);
    }
  }

  // support struts
  for (const sx of [-15, 15]) {
    line(ctx, sx, 3, sx * 0.35, top * 0.5, '#05080f', 4);
    line(ctx, sx, 3, sx * 0.35, top * 0.5, css(0x34466a), 2);
  }

  // central column
  const cw = 13;
  const colGrad = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  colGrad.addColorStop(0, css(shade(RAISED, 1.7)));
  colGrad.addColorStop(0.45, css(RAISED));
  colGrad.addColorStop(1, css(shade(RAISED, 0.55)));
  fillRR(ctx, -cw / 2, top, cw, -top - 2, 2, colGrad, EDGE, 1.1);
  // inner energy channel
  neonLine(ctx, 0, top + 6, 0, -6, c, 1.6, 6);

  // coils
  const coils = 2 + level;
  const span = -top - 14;
  for (let k = 0; k < coils; k++) {
    const y = -8 - (k * span) / coils;
    const rx = 12 - k * 0.8 + level * 0.6;
    ellipse(ctx, 0, y + 1, rx, 3.6, css(DARK));
    ctx.save();
    glow(ctx, c, 6);
    ctx.beginPath();
    ctx.ellipse(0, y, rx, 3.6, 0, 0, Math.PI);
    ctx.strokeStyle = css(c);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, y, rx, 3.6, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = css(shade(c, 0.55));
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // crown with prongs
  const prongs = level === 3 ? 4 : 3;
  for (let k = 0; k < prongs; k++) {
    const a = Math.PI + (k + 0.5) * (Math.PI / prongs);
    const px = Math.cos(a) * 11;
    const py = top + Math.sin(a) * 4;
    line(ctx, px * 0.4, top, px, py - 8, '#05080f', 3);
    line(ctx, px * 0.4, top, px, py - 8, css(0x4a5e82), 1.4);
    neonDot(ctx, px, py - 8, 1.4, c, 5);
  }
  ellipse(ctx, 0, top, 10, 4, metalGradient(ctx, -10, top - 4, 20, 8, RAISED), EDGE, 1.1);
  ellipse(ctx, 0, top - 1, 6, 2.4, css(0x05080f));
  bolt(ctx, -4, -4, 1);
  bolt(ctx, 4, -4, 1);
}

function drawTeslaOrbAt(ctx: Ctx, x: number, y: number, r: number, c: number): void {
  ctx.save();
  glow(ctx, c, r * 1.6);
  circle(
    ctx,
    x,
    y,
    r,
    radial(ctx, x - r * 0.25, y - r * 0.25, r * 1.1, [
      [0, '#ffffff'],
      [0.3, css(shade(c, 1.35))],
      [0.8, css(c)],
      [1, css(shade(c, 0.6))],
    ]),
  );
  noGlow(ctx);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.35, r * 0.45, -0.4, 0, Math.PI * 2);
  ctx.strokeStyle = css(shade(c, 1.4));
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
