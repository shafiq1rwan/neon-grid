import Phaser from 'phaser';
import { css } from '../config';

/**
 * Small Canvas2D toolkit used to bake vector art into cached textures once at
 * boot. Canvas gives us gradients and real glow (shadowBlur) for free, and
 * the GPU then only ever draws plain sprites.
 */
export type Ctx = CanvasRenderingContext2D;

export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx) => void,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  ctx.restore();
  tex.refresh();
}

/** Multiply RGB channels; factor < 1 darkens, > 1 lightens. */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** Linear blend between two colours. */
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t);
  const g = Math.round(((a >> 8) & 0xff) * (1 - t) + ((b >> 8) & 0xff) * t);
  const bl = Math.round((a & 0xff) * (1 - t) + (b & 0xff) * t);
  return (r << 16) | (g << 8) | bl;
}

export function glow(ctx: Ctx, color: number, blur: number): void {
  ctx.shadowColor = css(color);
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function noGlow(ctx: Ctx): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export function polyPath(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function fillPoly(
  ctx: Ctx,
  pts: number[],
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
): void {
  polyPath(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRR(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
): void {
  rrPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function circle(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function line(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Regular octagon points, optionally squashed vertically for a 2.5D look. */
export function octagon(cx: number, cy: number, r: number, squash = 1): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash);
  }
  return pts;
}

export function regularPoly(cx: number, cy: number, r: number, sides: number, rot = 0, squash = 1): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash);
  }
  return pts;
}

/**
 * Extrude a convex polygon "downward" on screen by `h` pixels to fake a
 * raised slab seen from a tilted top-down camera.
 */
export function prism(
  ctx: Ctx,
  pts: number[],
  h: number,
  top: string | CanvasGradient,
  side: string,
  edge?: string,
): void {
  const n = pts.length / 2;
  ctx.fillStyle = side;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = pts[i * 2];
    const y1 = pts[i * 2 + 1];
    const x2 = pts[j * 2];
    const y2 = pts[j * 2 + 1];
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + h);
    ctx.lineTo(x1, y1 + h);
    ctx.closePath();
    ctx.fill();
  }
  // Darken the lower lip of the side faces
  const lower: number[] = [];
  for (let i = 0; i < pts.length; i += 2) lower.push(pts[i], pts[i + 1] + h);
  ctx.save();
  ctx.globalAlpha = 0.35;
  polyPath(ctx, lower);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  fillPoly(ctx, pts, top, edge, 1.2);
}

/** Vertical metal gradient for top faces (light at top-left). */
export function metalGradient(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
  light = 1.45,
  dark = 0.75,
): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, css(shade(base, light)));
  g.addColorStop(0.55, css(base));
  g.addColorStop(1, css(shade(base, dark)));
  return g;
}

export function radial(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function bolt(ctx: Ctx, x: number, y: number, r = 1.4): void {
  circle(ctx, x, y, r + 0.6, '#070b14');
  circle(ctx, x - 0.3, y - 0.3, r, '#6b7a96');
}

/** Row of thin vent slits. */
export function vents(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  vertical = false,
): void {
  for (let i = 0; i < count; i++) {
    if (vertical) {
      const vx = x + (i + 0.5) * (w / count);
      line(ctx, vx, y, vx, y + h, '#05080f', 1.6);
      line(ctx, vx + 0.9, y, vx + 0.9, y + h, 'rgba(120,140,180,0.35)', 0.6);
    } else {
      const vy = y + (i + 0.5) * (h / count);
      line(ctx, x, vy, x + w, vy, '#05080f', 1.6);
      line(ctx, x, vy + 0.9, x + w, vy + 0.9, 'rgba(120,140,180,0.35)', 0.6);
    }
  }
}

/** A neon light strip: bright core with a glow halo. */
export function neonLine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  width = 2,
  blur = 8,
): void {
  ctx.save();
  glow(ctx, color, blur);
  line(ctx, x1, y1, x2, y2, css(color), width);
  noGlow(ctx);
  line(ctx, x1, y1, x2, y2, css(shade(color, 1.6)), Math.max(0.6, width * 0.4));
  ctx.restore();
}

export function neonDot(ctx: Ctx, x: number, y: number, r: number, color: number, blur = 10): void {
  ctx.save();
  glow(ctx, color, blur);
  circle(ctx, x, y, r, css(color));
  noGlow(ctx);
  circle(ctx, x, y, r * 0.5, '#ffffff');
  ctx.restore();
}

/** Glowing energy core: bright centre fading to the tower colour. */
export function energyCore(ctx: Ctx, x: number, y: number, r: number, color: number): void {
  ctx.save();
  glow(ctx, color, r * 2.2);
  circle(
    ctx,
    x,
    y,
    r,
    radial(ctx, x, y, r, [
      [0, '#ffffff'],
      [0.35, css(shade(color, 1.5))],
      [1, css(color)],
    ]),
  );
  ctx.restore();
  circle(ctx, x, y, r + 1.2, undefined, '#05080f', 1.4);
}
