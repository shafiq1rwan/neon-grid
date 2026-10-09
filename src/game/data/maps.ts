export interface Vec2 {
  x: number;
  y: number;
}

export interface BuildingDef {
  /** Roof top-left. */
  x: number;
  y: number;
  w: number;
  /** Roof depth (vertical extent of the top face). */
  d: number;
  /** Visible facade height below the roof. */
  h: number;
  /** Optional neon sign colour on the facade. */
  sign?: number;
  ruined?: boolean;
}

export interface PropDef {
  kind: 'car' | 'truck' | 'tank' | 'pipes' | 'barrier' | 'crate';
  x: number;
  y: number;
  angle: number;
}

export interface MapDef {
  name: string;
  /** Corner points of the road; corners are rounded at build time. */
  path: Vec2[];
  cornerRadius: number;
  roadWidth: number;
  platforms: Vec2[];
  reactor: Vec2;
  /** Where the "call wave" button sits (near the road entrance). */
  waveButton: Vec2;
  buildings: BuildingDef[];
  props: PropDef[];
  seed: number;
}

export const SECTOR_7: MapDef = {
  name: 'Sector 7 — Reactor Row',
  path: [
    { x: -50, y: 300 },
    { x: 230, y: 300 },
    { x: 230, y: 560 },
    { x: 520, y: 560 },
    { x: 520, y: 220 },
    { x: 820, y: 220 },
    { x: 820, y: 520 },
    { x: 1060, y: 520 },
    { x: 1060, y: 300 },
    { x: 1150, y: 300 },
  ],
  cornerRadius: 56,
  roadWidth: 62,
  platforms: [
    { x: 120, y: 410 },
    { x: 375, y: 430 },
    { x: 375, y: 662 },
    { x: 420, y: 205 },
    { x: 670, y: 118 },
    { x: 670, y: 372 },
    { x: 670, y: 592 },
    { x: 945, y: 402 },
    { x: 945, y: 642 },
    { x: 960, y: 168 },
  ],
  reactor: { x: 1192, y: 300 },
  waveButton: { x: 62, y: 222 },
  buildings: [
    { x: 14, y: 118, w: 150, d: 66, h: 58, sign: 0xff3dae },
    { x: 186, y: 34, w: 106, d: 84, h: 70, ruined: true },
    { x: 322, y: 8, w: 120, d: 58, h: 52, sign: 0x00e5ff },
    { x: 8, y: 482, w: 150, d: 84, h: 70, ruined: true },
    { x: 478, y: 14, w: 132, d: 62, h: 70, sign: 0xa78bfa },
    { x: 724, y: 6, w: 150, d: 54, h: 58, ruined: true },
    { x: 1010, y: 96, w: 140, d: 64, h: 66, sign: 0xff9b32 },
    { x: 1172, y: 72, w: 100, d: 56, h: 52, ruined: true },
    { x: 1122, y: 418, w: 150, d: 80, h: 70, sign: 0xff3dae },
    { x: 1112, y: 612, w: 160, d: 58, h: 46, ruined: true },
    { x: 1000, y: 600, w: 92, d: 52, h: 50 },
    { x: 430, y: 628, w: 112, d: 44, h: 40, ruined: true },
  ],
  props: [
    { kind: 'car', x: 300, y: 632, angle: 0.25 },
    { kind: 'car', x: 860, y: 690, angle: -0.15 },
    { kind: 'truck', x: 606, y: 486, angle: 1.45 },
    { kind: 'car', x: 898, y: 296, angle: 0.6 },
    { kind: 'tank', x: 742, y: 486, angle: 0 },
    { kind: 'pipes', x: 600, y: 680, angle: 0 },
    { kind: 'car', x: 300, y: 250, angle: -0.35 },
    { kind: 'barrier', x: 165, y: 640, angle: 0.4 },
    { kind: 'crate', x: 1000, y: 470, angle: 0.3 },
    { kind: 'car', x: 54, y: 680, angle: 1.2 },
    { kind: 'crate', x: 300, y: 500, angle: 0.1 },
    { kind: 'barrier', x: 1110, y: 228, angle: -0.2 },
  ],
  seed: 7331,
};
