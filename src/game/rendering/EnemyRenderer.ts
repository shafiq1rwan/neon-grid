import Phaser from 'phaser';
import { COLORS, css } from '../config';
import type { EnemyType } from '../data/enemies';
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
  radial,
  regularPoly,
  shade,
  vents,
  type Ctx,
} from './CanvasKit';

/* Enemy art is drawn facing +X and rotated at runtime to face travel. */

export const ENEMY_TEX_SIZE: Record<EnemyType, number> = {
  drone: 52,
  mini: 34,
  runner: 52,
  juggernaut: 92,
  specter: 64,
  spawner: 88,
};

export function enemyKey(type: EnemyType): string {
  return `en_${type}`;
}

const EDGE = css(0x5a4660);

export function generateEnemyTextures(scene: Phaser.Scene): void {
  const make = (key: string, size: number, draw: (ctx: Ctx) => void): void =>
    bakeTexture(scene, key, size, size, (ctx) => {
      ctx.translate(size / 2, size / 2);
      draw(ctx);
    });

  make(enemyKey('drone'), ENEMY_TEX_SIZE.drone, (ctx) => drawDrone(ctx, 1, COLORS.red));
  make(enemyKey('mini'), ENEMY_TEX_SIZE.mini, (ctx) => drawDrone(ctx, 0.62, COLORS.red));
  make(enemyKey('runner'), ENEMY_TEX_SIZE.runner, (ctx) => drawRunner(ctx));
  make(enemyKey('juggernaut'), ENEMY_TEX_SIZE.juggernaut, (ctx) => drawJuggernaut(ctx, false));
  make('en_juggernaut_dmg', ENEMY_TEX_SIZE.juggernaut, (ctx) => drawJuggernaut(ctx, true));
  make(enemyKey('specter'), ENEMY_TEX_SIZE.specter, (ctx) => drawSpecter(ctx));
  make(enemyKey('spawner'), ENEMY_TEX_SIZE.spawner, (ctx) => drawSpawner(ctx));
  make('spawner_hatch', 40, (ctx) => drawHatchGlow(ctx));
  make('shield_bubble', 72, (ctx) => drawShield(ctx));
  make('enemy_shadow', 64, (ctx) => {
    ellipse(
      ctx,
      0,
      0,
      28,
      20,
      radial(ctx, 0, 0, 28, [
        [0, 'rgba(0,0,0,0.6)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    );
  });
}

function drawDrone(ctx: Ctx, s: number, c: number): void {
  ctx.scale(s, s);
  const body = shade(c, 0.28);
  // rotor arms
  for (const [ax, ay] of [
    [9, -9],
    [9, 9],
    [-9, -9],
    [-9, 9],
  ]) {
    line(ctx, 0, 0, ax, ay, '#06080f', 4);
    line(ctx, 0, 0, ax, ay, css(0x3a2a3a), 2);
    circle(ctx, ax, ay, 6, 'rgba(255,82,111,0.12)', css(shade(c, 0.7)), 1);
    circle(ctx, ax, ay, 2.2, css(0x2b1d2a), EDGE, 0.8);
    line(ctx, ax - 5, ay + 1, ax + 5, ay - 1, 'rgba(255,170,190,0.35)', 1);
  }
  // hex body
  const hex = regularPoly(0, 0, 8.5, 6, Math.PI / 6);
  ctx.save();
  ctx.translate(1.5, 2);
  fillPoly(ctx, hex, 'rgba(0,0,0,0.5)');
  ctx.restore();
  fillPoly(ctx, hex, metalGradient(ctx, -8, -8, 16, 16, body, 1.9, 0.7));
  ctx.save();
  glow(ctx, c, 6);
  fillPoly(ctx, hex, 'rgba(0,0,0,0)', css(c), 1.3);
  ctx.restore();
  // sensor eye facing forward
  energyCore(ctx, 3, 0, 2.8, c);
  line(ctx, -5, -3, -1, -3, 'rgba(0,0,0,0.6)', 1);
  line(ctx, -5, 3, -1, 3, 'rgba(0,0,0,0.6)', 1);
}

function drawRunner(ctx: Ctx): void {
  const c = COLORS.teal;
  const body = shade(c, 0.22);
  // thruster flare
  ctx.save();
  glow(ctx, c, 10);
  fillPoly(ctx, [-11, -2.5, -19, 0, -11, 2.5], css(c));
  ctx.restore();
  // swept wings
  fillPoly(ctx, [2, -3, -9, -12, -12, -10, -6, -2], css(shade(body, 1.4)), css(shade(c, 0.6)), 1);
  fillPoly(ctx, [2, 3, -9, 12, -12, 10, -6, 2], css(shade(body, 1.4)), css(shade(c, 0.6)), 1);
  // fuselage dart
  const dart = [17, 0, 2, -5.5, -11, -4, -13, 0, -11, 4, 2, 5.5];
  ctx.save();
  ctx.translate(1.5, 2);
  fillPoly(ctx, dart, 'rgba(0,0,0,0.5)');
  ctx.restore();
  fillPoly(ctx, dart, metalGradient(ctx, -12, -6, 28, 12, body, 2, 0.7));
  ctx.save();
  glow(ctx, c, 6);
  fillPoly(ctx, dart, 'rgba(0,0,0,0)', css(c), 1.2);
  ctx.restore();
  neonLine(ctx, -8, 0, 10, 0, c, 1, 4);
  // cockpit
  ellipse(ctx, 6, 0, 4, 2, css(shade(c, 1.4)));
  neonDot(ctx, -10, -8, 1, c, 4);
  neonDot(ctx, -10, 8, 1, c, 4);
}

function drawJuggernaut(ctx: Ctx, damaged: boolean): void {
  const c = COLORS.orange;
  const armor = 0x6b3812;
  // drop shadow
  fillRR(ctx, -21, -19, 44, 42, 6, 'rgba(0,0,0,0.5)');
  // treads
  for (const ty of [-20, 12]) {
    fillRR(ctx, -22, ty, 44, 9, 3, css(0x15171d), css(0x3a3f4b), 1);
    for (let k = 0; k < 9; k++) {
      const tx = -20 + k * 5;
      line(ctx, tx, ty + 1, tx, ty + 8, 'rgba(110,115,130,0.55)', 1.2);
    }
  }
  // hull
  const hull = [20, -12, 24, -6, 24, 6, 20, 12, -18, 12, -21, 8, -21, -8, -18, -12];
  fillPoly(ctx, hull, metalGradient(ctx, -21, -12, 45, 24, armor, 1.7, 0.6), css(shade(c, 0.8)), 1.3);
  // armour plates
  fillPoly(ctx, [10, -9, 21, -5, 21, 5, 10, 9], css(shade(armor, 1.35)), css(shade(c, 0.6)), 1);
  for (const py of [-10, 6]) {
    fillRR(ctx, -16, py, 22, 4, 1, css(shade(armor, 1.15)), css(shade(c, 0.5)), 0.8);
    bolt(ctx, -14, py + 2, 0.9);
    bolt(ctx, 4, py + 2, 0.9);
  }
  vents(ctx, -20, -5, 4, 10, 3);
  // dome turret
  circle(ctx, -2, 0, 8.5, metalGradient(ctx, -10, -8, 16, 16, shade(armor, 1.2), 1.7, 0.7), css(shade(c, 0.7)), 1.2);
  fillRR(ctx, 4, -2, 12, 4, 1.5, css(0x22140a), css(shade(c, 0.6)), 1);
  ctx.save();
  glow(ctx, c, 8);
  fillRR(ctx, -5, -1.2, 8, 2.4, 1, css(c));
  ctx.restore();
  neonLine(ctx, 22, -5, 22, 5, c, 1.4, 6);
  neonDot(ctx, -19, -10, 1.2, c, 5);
  neonDot(ctx, -19, 10, 1.2, c, 5);

  if (damaged) {
    // torn armour with exposed glowing internals and cracks
    ctx.save();
    glow(ctx, 0xff5a1a, 10);
    fillPoly(ctx, [-12, -9, -4, -11, -1, -5, -9, -3], css(0xff7a2a));
    fillPoly(ctx, [6, 5, 12, 8, 9, 11, 3, 10], css(0xff7a2a));
    ctx.restore();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(10,6,4,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(9, -4);
    ctx.lineTo(12, 1);
    ctx.lineTo(7, 6);
    ctx.moveTo(-16, 10);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-12, 2);
    ctx.stroke();
  }
}

function drawSpecter(ctx: Ctx): void {
  const c = COLORS.purple;
  const body = shade(c, 0.25);
  // trailing fins
  fillPoly(ctx, [-4, -4, -16, -13, -12, -3], css(shade(body, 1.5)), css(shade(c, 0.7)), 1);
  fillPoly(ctx, [-4, 4, -16, 13, -12, 3], css(shade(body, 1.5)), css(shade(c, 0.7)), 1);
  // crystalline hull
  const kite = [16, 0, 2, -10, -12, 0, 2, 10];
  ctx.save();
  ctx.translate(1.5, 2);
  fillPoly(ctx, kite, 'rgba(0,0,0,0.5)');
  ctx.restore();
  fillPoly(ctx, kite, metalGradient(ctx, -12, -10, 28, 20, body, 2, 0.7));
  ctx.save();
  glow(ctx, c, 7);
  fillPoly(ctx, kite, 'rgba(0,0,0,0)', css(c), 1.3);
  ctx.restore();
  line(ctx, 2, -10, 2, 10, 'rgba(0,0,0,0.5)', 1);
  line(ctx, -12, 0, 16, 0, 'rgba(200,180,255,0.25)', 0.8);
  energyCore(ctx, 3, 0, 3.4, c);
  neonDot(ctx, 11, 0, 1.2, 0xffffff, 4);
}

function drawShield(ctx: Ctx): void {
  const c = COLORS.purple;
  const r = 24;
  circle(
    ctx,
    0,
    0,
    r,
    radial(ctx, 0, 0, r, [
      [0, 'rgba(167,139,250,0.02)'],
      [0.7, 'rgba(167,139,250,0.12)'],
      [1, 'rgba(200,180,255,0.45)'],
    ]),
  );
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(200,180,255,0.25)';
  ctx.lineWidth = 0.8;
  const hs = 7;
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const hx = col * hs * 1.5;
      const hy = row * hs * 1.732 + (col % 2 ? (hs * 1.732) / 2 : 0);
      ctx.beginPath();
      const pts = regularPoly(hx, hy, hs, 6);
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  glow(ctx, c, 8);
  circle(ctx, 0, 0, r, undefined, 'rgba(200,180,255,0.85)', 1.4);
  ctx.restore();
}

function drawSpawner(ctx: Ctx): void {
  const c = COLORS.red;
  const body = 0x3a1220;
  // side pods
  for (const sy of [-17, 17]) {
    ellipse(ctx, -4, sy, 12, 5.5, metalGradient(ctx, -16, sy - 5, 24, 11, shade(body, 1.3), 1.7, 0.7), css(shade(c, 0.6)), 1);
    neonDot(ctx, 7, sy, 1.6, c, 6);
    vents(ctx, -12, sy - 2.5, 10, 5, 3, true);
  }
  // main carrier hull
  const hull = regularPoly(0, 0, 20, 6, 0, 0.85);
  ctx.save();
  ctx.translate(2, 3);
  fillPoly(ctx, hull, 'rgba(0,0,0,0.5)');
  ctx.restore();
  fillPoly(ctx, hull, metalGradient(ctx, -20, -17, 40, 34, body, 1.8, 0.65));
  ctx.save();
  glow(ctx, c, 8);
  fillPoly(ctx, hull, 'rgba(0,0,0,0)', css(c), 1.4);
  ctx.restore();
  // hangar bay
  fillRR(ctx, -9, -8, 18, 16, 3, css(0x12060b), css(shade(c, 0.7)), 1.2);
  line(ctx, 0, -8, 0, 8, css(shade(c, 0.5)), 1.2);
  for (const by of [-4, 0, 4]) line(ctx, -8, by, 8, by, 'rgba(255,82,111,0.25)', 0.8);
  // forward sensor and bolts
  neonDot(ctx, 17, 0, 2.2, c, 8);
  bolt(ctx, -14, -8, 1.1);
  bolt(ctx, -14, 8, 1.1);
  bolt(ctx, 11, -9, 1.1);
  bolt(ctx, 11, 9, 1.1);
}

function drawHatchGlow(ctx: Ctx): void {
  const c = COLORS.red;
  ctx.save();
  glow(ctx, c, 10);
  fillRR(
    ctx,
    -9,
    -8,
    18,
    16,
    3,
    radial(ctx, 0, 0, 12, [
      [0, '#ffffff'],
      [0.4, css(shade(c, 1.4))],
      [1, css(c, 0.3)],
    ]),
  );
  ctx.restore();
}
