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
  titan: 150,
};

export function enemyKey(type: EnemyType): string {
  return `en_${type}`;
}

const EDGE = css(0x5a4660);

// Four baked tread positions; movement selects a frame by distance travelled.
export const TANK_TEXTURES = Object.fromEntries(
  (['juggernaut', 'titan'] as const).map((type) => [type,
    [false, true].map((damaged) => Array.from({ length: 4 }, (_, frame) =>
      `en_${type}${damaged ? '_dmg' : ''}${frame ? `_track${frame}` : ''}`)),
  ]),
) as Record<'juggernaut' | 'titan', string[][]>;

export function generateEnemyTextures(scene: Phaser.Scene): void {
  const make = (key: string, size: number, draw: (ctx: Ctx) => void): void =>
    bakeTexture(scene, key, size, size, (ctx) => {
      ctx.translate(size / 2, size / 2);
      draw(ctx);
    });

  make(enemyKey('drone'), ENEMY_TEX_SIZE.drone, (ctx) => drawDrone(ctx, 1, COLORS.red));
  make(enemyKey('mini'), ENEMY_TEX_SIZE.mini, (ctx) => drawDrone(ctx, 0.62, COLORS.red));
  make(enemyKey('runner'), ENEMY_TEX_SIZE.runner, (ctx) => drawRunner(ctx));
  for (const type of ['juggernaut', 'titan'] as const) {
    for (let damage = 0; damage < 2; damage++) {
      for (let frame = 0; frame < 4; frame++) {
        make(TANK_TEXTURES[type][damage][frame], ENEMY_TEX_SIZE[type], (ctx) => {
          if (type === 'titan') drawTitan(ctx, damage === 1, frame * 1.5);
          else drawJuggernaut(ctx, damage === 1, COLORS.orange, 0x6b3812, frame * 1.5);
        });
      }
    }
  }
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

/** Boss: a scaled-up war machine in red armour with twin side cannons. */
function drawTitan(ctx: Ctx, damaged: boolean, trackOffset = 0): void {
  ctx.save();
  ctx.scale(1.6, 1.6);
  // twin side cannons under the hull
  for (const sy of [-15, 15]) {
    fillRR(ctx, 4, sy - 2.5, 26, 5, 2, css(0x1b1214), css(0x5a2a30), 1);
    neonDot(ctx, 30, sy, 1.6, COLORS.red, 6);
  }
  drawJuggernaut(ctx, damaged, COLORS.red, 0x4a1420, trackOffset);
  // command spires
  for (const sx of [-12, -4]) {
    fillPoly(ctx, [sx - 3, -4, sx, -10, sx + 3, -4], css(0x2a1218), css(COLORS.red), 0.8);
    neonDot(ctx, sx, -10, 1.1, COLORS.red, 5);
  }
  ctx.restore();
}

function drawJuggernaut(ctx: Ctx, damaged: boolean, c: number = COLORS.orange, armor = 0x6b3812, trackOffset = 0): void {
  // Broad, exposed track pods make the silhouette readable at gameplay scale.
  fillRR(ctx, -24, -21, 51, 46, 7, 'rgba(0,0,0,0.5)');
  for (const ty of [-23, 13]) {
    fillRR(ctx, -25, ty, 49, 11, 4, '#090d15', '#586170', 1.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-23, ty + 1, 45, 9);
    ctx.clip();
    for (let k = -1; k < 9; k++) {
      const tx = -21 + k * 6 - trackOffset;
      fillRR(ctx, tx, ty + 2, 3.5, 7, 0.7, '#343d4b');
      line(ctx, tx, ty + 2, tx + 3, ty + 2, '#748093', 0.8);
    }
    ctx.restore();
    // A single armor rail leaves the outer tread visible.
    const railY = ty < 0 ? ty + 7 : ty;
    fillRR(ctx, -18, railY, 34, 4, 1.5, css(shade(armor, 1.4)), css(shade(c, 0.65)), 0.8);
    neonLine(ctx, 17, ty + 3, 17, ty + 8, c, 1.5, 3);
  }

  // Low wedge hull with a bright front glacis and a recessed rear engine deck.
  const hull = [-23, -10, -17, -16, 14, -16, 25, -8, 25, 8, 14, 16, -17, 16, -23, 10];
  fillPoly(ctx, hull, metalGradient(ctx, -23, -16, 48, 32, armor, 1.65, 0.65), '#0a101b', 2);
  line(ctx, -17, -15, 14, -15, css(shade(c, 0.85)), 1.2);
  fillPoly(ctx, [13, -13, 23, -7, 23, 7, 13, 13, 16, 0], css(shade(armor, 1.8)), css(shade(c, 0.6)), 0.8);
  fillRR(ctx, -21, -8, 8, 16, 2, '#161c26', '#55525a', 0.8);
  vents(ctx, -20, -6, 6, 12, 4);
  neonLine(ctx, 21, -9, 24, -6, c, 1.8, 4);
  neonLine(ctx, 21, 9, 24, 6, c, 1.8, 4);

  // Raised angular turret, with a barrel that clearly extends past the hull.
  circle(ctx, -2, 1, 12, '#10151f', '#5b5050', 1);
  fillRR(ctx, 4, -3, 27, 6, 1, '#202a38', '#788393', 1);
  line(ctx, 9, -1.5, 29, -1.5, css(shade(c, 0.85)), 1.2);
  fillPoly(ctx, [28, -4, 34, -3, 34, 3, 28, 4], '#394353', '#9298a0', 1);
  line(ctx, 33, -2, 33, 2, '#080d16', 2);
  const turret = [-13, -7, -8, -11, 5, -11, 12, -5, 12, 5, 5, 11, -8, 11, -13, 7];
  fillPoly(ctx, turret, metalGradient(ctx, -13, -11, 25, 22, armor, 2.1, 0.85), '#111722', 1.6);
  line(ctx, -8, -10, 4, -10, css(shade(c, 1.15)), 1.2);
  fillPoly(ctx, [-10, 5, 5, 5, 10, 2, 10, 5, 4, 9, -7, 9], css(shade(armor, 0.65)));
  circle(ctx, -3, -1, 5.5, '#151b25', css(shade(c, 0.65)), 1);
  energyCore(ctx, -3, -1, 3.4, c);
  neonDot(ctx, -20, -12, 1.2, c, 3);
  neonDot(ctx, -20, 12, 1.2, c, 3);

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
