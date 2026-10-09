import type { EnemyType } from './enemies';
import type { TowerType } from './towers';
import { WAVES_SECTOR_1, WAVES_SECTOR_2, WAVES_SECTOR_3, type WaveDef } from './waves';

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
  /** Stable id, used for texture keys and saves. */
  id: string;
  name: string;
  /** One-line description of the sector's twist (sector select screen). */
  subtitle: string;
  /** One or more roads (lanes); corners are rounded at build time. */
  paths: Vec2[][];
  cornerRadius: number;
  roadWidth: number;
  platforms: Vec2[];
  reactor: Vec2;
  /** Where the "call wave" button sits (near the road entrance). */
  waveButton: Vec2;
  /** Handcrafted scenery. When omitted, scenery is placed procedurally. */
  buildings?: BuildingDef[];
  props?: PropDef[];
  seed: number;
  waves: WaveDef[];
  /** Towers that can be built in this sector (later sectors unlock more). */
  towers: TowerType[];
  /** Multiplies every enemy's HP and shield in this sector (main balance knob). */
  difficulty: number;
  startCredits: number;
  /** Platform highlighted by the first-run tutorial (sector 1 only). */
  tutorialPlatform?: number;
}

export const SECTOR_7: MapDef = {
  id: 'reactor-row',
  name: 'Reactor Row',
  subtitle: 'One winding road. Learn the ropes.',
  waves: WAVES_SECTOR_1,
  towers: ['pulse', 'cannon', 'missile', 'tesla'],
  difficulty: 1.1,
  startCredits: 220,
  tutorialPlatform: 1,
  paths: [[
    // starts beyond the widest visible area so machines never pop in on screen
    { x: -440, y: 300 },
    { x: 230, y: 300 },
    { x: 230, y: 560 },
    { x: 520, y: 560 },
    { x: 520, y: 220 },
    { x: 820, y: 220 },
    { x: 820, y: 520 },
    { x: 1060, y: 520 },
    { x: 1060, y: 300 },
    { x: 1150, y: 300 },
  ]],
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
    // outskirts, only visible on wider / taller screens
    { x: -214, y: 70, w: 186, d: 80, h: 70, sign: 0x00e5ff },
    { x: -206, y: 404, w: 170, d: 86, h: 76, ruined: true },
    { x: -214, y: 610, w: 176, d: 60, h: 56, sign: 0xa78bfa },
    { x: 1300, y: 18, w: 176, d: 78, h: 70, ruined: true },
    { x: 1306, y: 380, w: 164, d: 70, h: 60, sign: 0xff3dae },
    { x: 1296, y: 560, w: 184, d: 84, h: 70 },
    { x: 20, y: -132, w: 160, d: 50, h: 56 },
    { x: 560, y: -126, w: 150, d: 46, h: 50, ruined: true },
    { x: 900, y: -134, w: 180, d: 56, h: 60, sign: 0xff9b32 },
    { x: 110, y: 736, w: 170, d: 50, h: 50, ruined: true },
    { x: 690, y: 740, w: 210, d: 50, h: 46, sign: 0x00e5ff },
    { x: 1060, y: 736, w: 170, d: 52, h: 48 },
    // far outskirts for very wide screens
    { x: -372, y: -40, w: 140, d: 70, h: 70, ruined: true },
    { x: -376, y: 150, w: 146, d: 56, h: 56, sign: 0xff3dae },
    { x: -380, y: 400, w: 150, d: 80, h: 70 },
    { x: -372, y: 590, w: 144, d: 70, h: 64, ruined: true },
    { x: 1500, y: -30, w: 150, d: 70, h: 64, sign: 0xa78bfa },
    { x: 1506, y: 170, w: 140, d: 60, h: 60, ruined: true },
    { x: 1500, y: 400, w: 150, d: 76, h: 66, sign: 0x00e5ff },
    { x: 1506, y: 610, w: 146, d: 70, h: 62, ruined: true },
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
    { kind: 'car', x: -120, y: 232, angle: 0.15 },
    { kind: 'truck', x: -150, y: 376, angle: -0.05 },
    { kind: 'tank', x: 1400, y: 300, angle: 0 },
    { kind: 'pipes', x: 470, y: 770, angle: 0 },
    { kind: 'car', x: 420, y: -40, angle: 2.8 },
    { kind: 'crate', x: 1240, y: 760, angle: 0.4 },
    { kind: 'car', x: -300, y: 362, angle: 0.1 },
    { kind: 'barrier', x: -330, y: 246, angle: 0 },
    { kind: 'truck', x: 1440, y: 360, angle: 1.5 },
  ],
  seed: 7331,
};

/** Shared trunk for Twin Gates: both gates merge at (330, 385). */
const TWIN_TRUNK: Vec2[] = [
  { x: 330, y: 385 },
  { x: 640, y: 385 },
  { x: 640, y: 160 },
  { x: 900, y: 160 },
  { x: 900, y: 560 },
  { x: 1080, y: 560 },
  { x: 1080, y: 330 },
  { x: 1150, y: 330 },
];

export const TWIN_GATES: MapDef = {
  id: 'twin-gates',
  name: 'Twin Gates',
  subtitle: 'Two entrances. Machines attack on two lanes.',
  waves: WAVES_SECTOR_2,
  towers: ['pulse', 'cannon', 'missile', 'tesla', 'laser'],
  difficulty: 1.3,
  startCredits: 300,
  paths: [
    [{ x: -440, y: 170 }, { x: 330, y: 170 }, ...TWIN_TRUNK],
    [{ x: -440, y: 600 }, { x: 330, y: 600 }, ...TWIN_TRUNK],
  ],
  cornerRadius: 50,
  roadWidth: 62,
  platforms: [
    { x: 180, y: 290 },
    { x: 180, y: 480 },
    { x: 480, y: 270 },
    { x: 480, y: 500 },
    { x: 770, y: 280 },
    { x: 770, y: 480 },
    { x: 990, y: 440 },
    { x: 990, y: 660 },
    { x: 1180, y: 470 },
    { x: 200, y: 686 },
    { x: 1000, y: 245 },
  ],
  reactor: { x: 1192, y: 330 },
  waveButton: { x: 62, y: 385 },
  seed: 9182,
};

export const LONG_ROAD: MapDef = {
  id: 'long-road',
  name: 'The Long Road',
  subtitle: 'A long serpentine highway. The Titan awaits.',
  waves: WAVES_SECTOR_3,
  towers: ['pulse', 'cannon', 'missile', 'tesla', 'laser', 'cryo'],
  difficulty: 1.7,
  startCredits: 360,
  paths: [
    [
      { x: -440, y: 150 },
      { x: 1010, y: 150 },
      { x: 1010, y: 345 },
      { x: 200, y: 345 },
      { x: 200, y: 545 },
      { x: 1150, y: 545 },
    ],
  ],
  cornerRadius: 56,
  roadWidth: 62,
  platforms: [
    { x: 330, y: 247 },
    { x: 560, y: 247 },
    { x: 790, y: 247 },
    { x: 1130, y: 250 },
    { x: 90, y: 445 },
    { x: 330, y: 445 },
    { x: 560, y: 445 },
    { x: 790, y: 445 },
    { x: 1050, y: 440 },
    { x: 450, y: 650 },
    { x: 800, y: 650 },
    { x: 1110, y: 655 },
  ],
  reactor: { x: 1192, y: 545 },
  waveButton: { x: 66, y: 250 },
  seed: 4471,
};

/** Towers a sector adds compared with the one before it (shown as an unlock). */
export function newTowersInMap(mapIndex: number): TowerType[] {
  const before = mapIndex > 0 ? MAPS[mapIndex - 1].towers : [];
  return MAPS[mapIndex].towers.filter((t) => !before.includes(t));
}

/** The campaign, in order. Each sector unlocks after clearing the previous one. */
export const MAPS: MapDef[] = [SECTOR_7, TWIN_GATES, LONG_ROAD];

/**
 * Enemy types that appear for the first time in the campaign at this wave
 * (earlier sectors count as already seen).
 */
export function newEnemiesInWave(mapIndex: number, waveIndex: number): EnemyType[] {
  const seen = new Set<EnemyType>();
  for (let m = 0; m < mapIndex; m++) for (const w of MAPS[m].waves) for (const grp of w.groups) seen.add(grp.type);
  const waves = MAPS[mapIndex].waves;
  for (let i = 0; i < waveIndex; i++) for (const grp of waves[i].groups) seen.add(grp.type);
  const fresh: EnemyType[] = [];
  for (const grp of waves[waveIndex].groups) {
    if (!seen.has(grp.type) && !fresh.includes(grp.type)) fresh.push(grp.type);
  }
  return fresh;
}
