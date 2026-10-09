import Phaser from 'phaser';
import { COLORS, DEPTH, FONT, css } from '../config';
import { ObjectPool } from '../utils/ObjectPool';
import { bakeTexture, circle, fillPoly, fillRR, glow, radial, shade, type Ctx } from './CanvasKit';

/* ------------------------------------------------------------------ */
/* Texture baking                                                      */
/* ------------------------------------------------------------------ */

export function generateEffectTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'fx_glow', 64, 64, (ctx) => {
    ctx.fillStyle = radial(ctx, 32, 32, 32, [
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,255,255,0.55)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillRect(0, 0, 64, 64);
  });
  bakeTexture(scene, 'fx_dot', 16, 16, (ctx) => {
    ctx.fillStyle = radial(ctx, 8, 8, 8, [
      [0, 'rgba(255,255,255,1)'],
      [0.5, 'rgba(255,255,255,0.7)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillRect(0, 0, 16, 16);
  });
  bakeTexture(scene, 'fx_spark', 18, 6, (ctx) => {
    ctx.fillStyle = radial(ctx, 9, 3, 9, [
      [0, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.beginPath();
    ctx.ellipse(9, 3, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  bakeTexture(scene, 'fx_smoke', 32, 32, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 16, [
      [0, 'rgba(150,160,180,0.55)'],
      [1, 'rgba(150,160,180,0)'],
    ]);
    ctx.fillRect(0, 0, 32, 32);
  });
  bakeTexture(scene, 'fx_ring', 128, 128, (ctx) => {
    ctx.save();
    glow(ctx, 0xffffff, 8);
    circle(ctx, 64, 64, 56, undefined, 'rgba(255,255,255,0.95)', 4);
    ctx.restore();
    circle(ctx, 64, 64, 56, undefined, 'rgba(255,255,255,1)', 1.5);
  });
  bakeTexture(scene, 'fx_flash', 48, 48, (ctx) => {
    ctx.translate(24, 24);
    ctx.fillStyle = radial(ctx, 0, 0, 22, [
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,255,255,0.8)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  projectile(scene, 'proj_bolt', 30, 12, (ctx) => {
    ctx.save();
    glow(ctx, COLORS.cyan, 8);
    ctx.fillStyle = radial(ctx, 20, 6, 14, [
      [0, '#ffffff'],
      [0.4, css(COLORS.cyan)],
      [1, css(COLORS.cyan, 0)],
    ]);
    ctx.beginPath();
    ctx.ellipse(18, 6, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  projectile(scene, 'proj_shell', 28, 18, (ctx) => {
    ctx.save();
    glow(ctx, COLORS.pink, 10);
    ctx.fillStyle = css(COLORS.pink, 0.45);
    ctx.beginPath();
    ctx.ellipse(12, 9, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    fillRR(ctx, 12, 5, 11, 8, 3.5, '#ffd6ee');
    circle(ctx, 20, 9, 3, '#ffffff');
  });
  projectile(scene, 'proj_missile', 34, 14, (ctx) => {
    ctx.save();
    glow(ctx, COLORS.orange, 10);
    fillPoly(ctx, [10, 4, 0, 7, 10, 10], css(COLORS.orange));
    ctx.restore();
    fillRR(ctx, 10, 4.5, 16, 5, 2, '#cfd6e4');
    fillPoly(ctx, [12, 4.5, 9, 1.5, 15, 4.5], '#8792a8');
    fillPoly(ctx, [12, 9.5, 9, 12.5, 15, 9.5], '#8792a8');
    ctx.save();
    glow(ctx, COLORS.orange, 6);
    fillPoly(ctx, [26, 4.5, 31, 7, 26, 9.5], css(shade(COLORS.orange, 1.2)));
    ctx.restore();
  });

  // pulsing build hint for empty platforms
  bakeTexture(scene, 'plat_hint', 80, 80, (ctx) => {
    ctx.translate(40, 40);
    ctx.save();
    glow(ctx, COLORS.cyan, 8);
    ctx.strokeStyle = css(COLORS.cyan, 0.9);
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 24, 0, a - 0.35, a + 0.35);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.restore();
  });

  // UI icons
  bakeTexture(scene, 'ui_coin', 32, 32, (ctx) => drawCoin(ctx, 16, 16, 11));
  bakeTexture(scene, 'ui_heart', 32, 32, (ctx) => drawHeart(ctx, 16, 17, 11));
}

function projectile(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  bakeTexture(scene, key, w, h, draw);
}

export function drawCoin(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  glow(ctx, COLORS.gold, 6);
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  fillPoly(ctx, pts, css(COLORS.gold));
  ctx.restore();
  const inner: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    inner.push(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
  }
  fillPoly(ctx, inner, css(0x8a5a00), css(0xfff0b0), 1.2);
}

export function drawHeart(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  glow(ctx, COLORS.red, 6);
  ctx.fillStyle = css(COLORS.red);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.3, y - s * 0.1, x, y + s * 0.85);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.38, y - s * 0.3, s * 0.18, s * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Runtime effects                                                     */
/* ------------------------------------------------------------------ */

interface ArcFx {
  pts: number[];
  ttl: number;
  life: number;
  color: number;
  width: number;
}

/**
 * Pooled, lightweight combat effects. One shared Graphics object draws all
 * transient lines (tesla arcs, laser beams) and is cleared each frame.
 */
export class Effects {
  private readonly sparkEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly trailEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ringPool: ObjectPool<Phaser.GameObjects.Image>;
  private readonly flashPool: ObjectPool<Phaser.GameObjects.Image>;
  private readonly textPool: ObjectPool<Phaser.GameObjects.Text>;
  readonly gfx: Phaser.GameObjects.Graphics;
  private readonly arcs: ArcFx[] = [];
  private timeScale = 1;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.EFFECT).setBlendMode(Phaser.BlendModes.ADD);
    this.smoke = scene.add
      .particles(0, 0, 'fx_smoke', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 10, max: 40 },
        scale: { start: 0.8, end: 2.2 },
        alpha: { start: 0.5, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.EFFECT - 1);

    this.ringPool = new ObjectPool(
      () => scene.add.image(0, 0, 'fx_ring').setDepth(DEPTH.EFFECT).setBlendMode(Phaser.BlendModes.ADD),
      (img) => img.setVisible(false),
    );
    this.flashPool = new ObjectPool(
      () => scene.add.image(0, 0, 'fx_flash').setDepth(DEPTH.EFFECT + 1).setBlendMode(Phaser.BlendModes.ADD),
      (img) => img.setVisible(false),
    );
    this.textPool = new ObjectPool(
      () =>
        scene.add
          .text(0, 0, '', {
            fontFamily: FONT,
            fontSize: '17px',
            fontStyle: 'bold',
            color: '#ffd34d',
            stroke: '#05080f',
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.FLOAT),
      (t) => t.setVisible(false),
    );
  }

  private sparks(color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.sparkEmitters.get(color);
    if (!e) {
      e = this.scene.add
        .particles(0, 0, 'fx_spark', {
          lifespan: { min: 220, max: 520 },
          speed: { min: 60, max: 230 },
          scale: { start: 1, end: 0 },
          alpha: { start: 1, end: 0 },
          rotate: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
          tint: color,
          emitting: false,
        })
        .setDepth(DEPTH.EFFECT);
      e.timeScale = this.timeScale;
      this.sparkEmitters.set(color, e);
    }
    return e;
  }

  private trails(color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.trailEmitters.get(color);
    if (!e) {
      e = this.scene.add
        .particles(0, 0, 'fx_dot', {
          lifespan: 320,
          speed: { min: 0, max: 12 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 0.75, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          tint: color,
          emitting: false,
        })
        .setDepth(DEPTH.PROJECTILE - 1);
      e.timeScale = this.timeScale;
      this.trailEmitters.set(color, e);
    }
    return e;
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
    this.smoke.timeScale = scale;
    for (const e of this.sparkEmitters.values()) e.timeScale = scale;
    for (const e of this.trailEmitters.values()) e.timeScale = scale;
  }

  burst(x: number, y: number, color: number, count: number): void {
    this.sparks(color).explode(count, x, y);
  }

  trail(x: number, y: number, color: number): void {
    this.trails(color).emitParticleAt(x, y, 1);
  }

  puff(x: number, y: number, count = 2): void {
    this.smoke.explode(count, x, y);
  }

  ring(x: number, y: number, radius: number, color: number, duration = 380): void {
    const img = this.ringPool.get();
    const target = radius / 56;
    img.setPosition(x, y).setVisible(true).setTint(color).setAlpha(1).setScale(target * 0.2);
    this.scene.tweens.add({
      targets: img,
      scale: target,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => this.ringPool.release(img),
    });
  }

  flash(x: number, y: number, color: number, scale = 1, duration = 110): void {
    const img = this.flashPool.get();
    img
      .setPosition(x, y)
      .setVisible(true)
      .setTint(color)
      .setAlpha(1)
      .setScale(scale)
      .setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      scale: scale * 1.4,
      duration,
      onComplete: () => this.flashPool.release(img),
    });
  }

  explosion(x: number, y: number, radius: number, color: number): void {
    this.ring(x, y, radius, color, 420);
    this.flash(x, y, color, radius / 30, 180);
    this.burst(x, y, color, 14);
    this.burst(x, y, 0xffffff, 4);
    this.puff(x, y, 3);
  }

  popup(x: number, y: number, text: string, color = '#ffd34d'): void {
    const t = this.textPool.get();
    t.setText(text).setColor(color).setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({
      targets: t,
      y: y - 34,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 520,
      duration: 300,
      onComplete: () => this.textPool.release(t),
    });
  }

  /** Jagged lightning between two points. */
  arc(x1: number, y1: number, x2: number, y2: number, color: number, width = 2.4, life = 0.14): void {
    const pts: number[] = [x1, y1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segs = Math.max(3, Math.floor(len / 14));
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = (Math.random() - 0.5) * Math.min(22, len * 0.25);
      pts.push(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
    }
    pts.push(x2, y2);
    this.arcs.push({ pts, ttl: life, life, color, width });
  }

  /** Clear the shared graphics and draw live arcs. Call once per frame before beams. */
  beginFrame(dt: number): void {
    const g = this.gfx;
    g.clear();
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.ttl -= dt;
      if (a.ttl <= 0) {
        this.arcs.splice(i, 1);
        continue;
      }
      const k = a.ttl / a.life;
      g.lineStyle(a.width * 3, a.color, 0.18 * k);
      this.strokePts(a.pts);
      g.lineStyle(a.width, a.color, 0.9 * k);
      this.strokePts(a.pts);
      g.lineStyle(Math.max(1, a.width * 0.4), 0xffffff, k);
      this.strokePts(a.pts);
    }
  }

  private strokePts(pts: number[]): void {
    const g = this.gfx;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.strokePath();
  }

  /** Draw a laser beam for this frame. `power` 0..1 controls thickness. */
  beam(x1: number, y1: number, x2: number, y2: number, color: number, power: number, t: number): void {
    const g = this.gfx;
    const wobble = 1 + Math.sin(t * 40) * 0.15;
    const w = (1 + power * 4.5) * wobble;
    g.lineStyle(w * 3.2, color, 0.12 + power * 0.12);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(w, color, 0.5 + power * 0.4);
    g.lineBetween(x1, y1, x2, y2);
    if (power > 0.3) {
      g.lineStyle(Math.max(1, w * 0.35), 0xffffff, power);
      g.lineBetween(x1, y1, x2, y2);
      g.fillStyle(color, 0.5 * power);
      g.fillCircle(x2, y2, 4 + power * 5 * wobble);
      g.fillStyle(0xffffff, 0.8 * power);
      g.fillCircle(x2, y2, 2 + power * 2);
    }
    g.fillStyle(color, 0.6);
    g.fillCircle(x1, y1, 2 + power * 3);
  }

  destroy(): void {
    this.arcs.length = 0;
  }
}
