import Phaser from 'phaser';
import { COLORS, FONT, css } from '../config';
import { sfx } from '../audio/SoundSystem';

export interface PanelStyle {
  color?: number;
  fill?: number;
  fillAlpha?: number;
  radius?: number;
  glow?: boolean;
  corners?: boolean;
}

/** Dark futuristic panel with a thin neon border and corner accents. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {},
): void {
  const color = style.color ?? COLORS.cyan;
  const r = style.radius ?? 10;
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 3, y + 5, w, h, r);
  g.fillStyle(style.fill ?? COLORS.panel, style.fillAlpha ?? 0.92);
  g.fillRoundedRect(x, y, w, h, r);
  // subtle inner sheen on the upper half
  g.fillStyle(0xffffff, 0.025);
  g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.45, { tl: r, tr: r, bl: 0, br: 0 });
  if (style.glow !== false) {
    g.lineStyle(6, color, 0.08);
    g.strokeRoundedRect(x, y, w, h, r);
  }
  g.lineStyle(1.5, color, 0.75);
  g.strokeRoundedRect(x, y, w, h, r);
  if (style.corners !== false) {
    const c = Math.min(16, w / 4, h / 4);
    g.lineStyle(2.5, color, 1);
    g.beginPath();
    g.moveTo(x + r * 0.3, y + c + r * 0.3);
    g.lineTo(x + r * 0.3, y + r * 0.3);
    g.lineTo(x + c + r * 0.3, y + r * 0.3);
    g.moveTo(x + w - r * 0.3, y + h - c - r * 0.3);
    g.lineTo(x + w - r * 0.3, y + h - r * 0.3);
    g.lineTo(x + w - c - r * 0.3, y + h - r * 0.3);
    g.strokePath();
  }
}

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: number | string = COLORS.text,
  style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: typeof color === 'number' ? css(color) : color,
    fontStyle: 'bold',
    ...style,
  });
}

export interface ButtonOptions {
  label?: string;
  fontSize?: number;
  color?: number;
  fill?: number;
  /** Draws an icon centred at (0, 0) of the button. */
  icon?: (g: Phaser.GameObjects.Graphics, color: number) => void;
  onClick: () => void;
  sound?: boolean;
  /** Optional panel appearance for controls with a quieter visual hierarchy. */
  panelStyle?: PanelStyle;
}

/** Touch-friendly neon button. Fires on release over the button. */
export class NeonButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly iconGfx: Phaser.GameObjects.Graphics | null = null;
  readonly label: Phaser.GameObjects.Text | null = null;
  private enabled = true;
  private pressed = false;
  private color: number;
  private iconFn: ((g: Phaser.GameObjects.Graphics, color: number) => void) | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    private readonly opts: ButtonOptions,
  ) {
    super(scene, x, y);
    this.color = opts.color ?? COLORS.cyan;
    this.iconFn = opts.icon ?? null;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    if (opts.icon) {
      this.iconGfx = scene.add.graphics();
      this.add(this.iconGfx);
    }
    if (opts.label !== undefined) {
      this.label = text(scene, 0, 0, opts.label, opts.fontSize ?? 20, COLORS.text).setOrigin(0.5);
      this.add(this.label);
    }
    this.redraw();
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) {
        sfx.play('error');
        return;
      }
      this.pressed = true;
      this.setScale(0.94);
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.setScale(1);
    });
    this.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setScale(1);
      if (opts.sound !== false) sfx.play('click');
      opts.onClick();
    });
    scene.add.existing(this);
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.redraw();
    return this;
  }

  setColor(color: number): this {
    if (this.color === color) return this;
    this.color = color;
    this.redraw();
    return this;
  }

  setLabel(value: string): this {
    this.label?.setText(value);
    return this;
  }

  setIcon(icon: (g: Phaser.GameObjects.Graphics, color: number) => void): this {
    this.iconFn = icon;
    this.redrawIcon();
    return this;
  }

  redrawIcon(): void {
    if (!this.iconGfx || !this.iconFn) return;
    this.iconGfx.clear();
    this.iconFn(this.iconGfx, this.enabled ? this.color : 0x5a6680);
  }

  private redraw(): void {
    const c = this.enabled ? this.color : 0x3a4560;
    this.bg.clear();
    drawPanel(this.bg, -this.w / 2, -this.h / 2, this.w, this.h, {
      color: c,
      fill: this.opts.fill ?? 0x111a2e,
      radius: Math.min(10, this.h / 3),
      corners: this.w > 70,
      ...this.opts.panelStyle,
    });
    this.label?.setColor(this.enabled ? css(COLORS.text) : '#5a6680');
    this.redrawIcon();
  }
}

/* Simple vector icons for HUD buttons ------------------------------------ */

export const Icons = {
  pause(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillRoundedRect(-9, -11, 6, 22, 2);
    g.fillRoundedRect(3, -11, 6, 22, 2);
  },
  play(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillTriangle(-7, -11, -7, 11, 11, 0);
  },
  fast(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillTriangle(-13, -10, -13, 10, 0, 0);
    g.fillTriangle(0, -10, 0, 10, 13, 0);
  },
  normal(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillTriangle(-7, -10, -7, 10, 8, 0);
  },
  sound(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillRect(-12, -5, 6, 10);
    g.fillTriangle(-7, -5, 2, -12, 2, 12);
    g.fillTriangle(-7, -5, -7, 5, 2, 12);
    g.lineStyle(2.4, c, 1);
    g.beginPath();
    g.arc(4, 0, 6, -0.9, 0.9);
    g.strokePath();
    g.beginPath();
    g.arc(4, 0, 11, -0.9, 0.9);
    g.strokePath();
  },
  mute(g: Phaser.GameObjects.Graphics, c: number): void {
    g.fillStyle(c, 1);
    g.fillRect(-12, -5, 6, 10);
    g.fillTriangle(-7, -5, 2, -12, 2, 12);
    g.fillTriangle(-7, -5, -7, 5, 2, 12);
    g.lineStyle(2.6, COLORS.red, 1);
    g.lineBetween(6, -6, 14, 6);
    g.lineBetween(14, -6, 6, 6);
  },
  expand(g: Phaser.GameObjects.Graphics, c: number): void {
    g.lineStyle(3.5, c, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath();
      g.moveTo(sx * 12, sy * 4);
      g.lineTo(sx * 12, sy * 12);
      g.lineTo(sx * 4, sy * 12);
      g.strokePath();
    }
  },
  collapse(g: Phaser.GameObjects.Graphics, c: number): void {
    g.lineStyle(3.5, c, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath();
      g.moveTo(sx * 12, sy * 4);
      g.lineTo(sx * 4, sy * 4);
      g.lineTo(sx * 4, sy * 12);
      g.strokePath();
    }
  },
  close(g: Phaser.GameObjects.Graphics, c: number): void {
    g.lineStyle(3, c, 1);
    g.lineBetween(-7, -7, 7, 7);
    g.lineBetween(7, -7, -7, 7);
  },
  chevrons(g: Phaser.GameObjects.Graphics, c: number): void {
    g.lineStyle(4, c, 1);
    for (const ox of [-8, 4]) {
      g.beginPath();
      g.moveTo(ox - 4, -9);
      g.lineTo(ox + 5, 0);
      g.lineTo(ox - 4, 9);
      g.strokePath();
    }
  },
};

/** Small horizontal stat bar used on cards and the upgrade panel. */
export function statBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  value: number,
  color: number,
  next?: number,
): void {
  g.fillStyle(0x05080f, 0.9);
  g.fillRoundedRect(x, y, w, 6, 3);
  if (next !== undefined && next > value) {
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(x, y, Math.max(6, w * Math.min(1, next)), 6, 3);
  }
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, Math.max(6, w * Math.min(1, value)), 6, 3);
}
