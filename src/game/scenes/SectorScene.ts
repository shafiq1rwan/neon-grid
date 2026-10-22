import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES, VIEW_PAD } from '../config';
import { ENEMIES } from '../data/enemies';
import { MAPS, newEnemiesInMap, newTowersInMap, type MapDef } from '../data/maps';
import { TOWERS } from '../data/towers';
import { sfx } from '../audio/SoundSystem';
import { poki } from '../platform/PokiAdapter';
import { bgKey } from '../rendering/EnvironmentRenderer';
import { fullscreen } from '../utils/Fullscreen';
import { storage } from '../utils/Storage';
import { centerCamera } from '../utils/View';
import { NeonButton, drawPanel, text } from '../ui/widgets';
import { availableStars } from '../data/perks';
import { ENDLESS } from '../data/endless';

/* Cards sit in a 2-column grid: schematic preview on the left, details on the right. */
const CARD_W = 590;
const CARD_H = 226;
const GAP_X = 24;
const GAP_Y = 18;
const GRID_TOP = 136;
/** Endless strip under the sector grid. */
const STRIP_H = 68;
const PREVIEW_W = 300;
const PREVIEW_H = (PREVIEW_W * GAME_HEIGHT) / GAME_WIDTH;
const PAD = 18;
/** Left edge of the text column inside a card. */
const INFO_X = PAD + PREVIEW_W + 22;
const INFO_W = CARD_W - INFO_X - PAD;

function starPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  return pts;
}

/** Campaign sector select: every sector in `MAPS` (2 per row), unlocked in order, with best stars. */
export class SectorScene extends Phaser.Scene {
  private starting = false;
  private picker: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENES.sectors);
  }

  create(): void {
    this.starting = false;
    this.picker = null;
    centerCamera(this);
    this.add.image(-VIEW_PAD.x, -VIEW_PAD.y, bgKey(MAPS[0])).setOrigin(0);
    this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, GAME_HEIGHT + 4000, 0x05080f, 0.72).setOrigin(0);

    const cx = GAME_WIDTH / 2;
    text(this, cx, 62, 'SELECT SECTOR', 40, COLORS.cyan).setOrigin(0.5);
    const total = storage.totalStars;
    text(this, cx, 108, `CAMPAIGN  ★ ${total} / ${MAPS.length * 3}`, 18, total > 0 ? COLORS.gold : COLORS.textDim).setOrigin(0.5);

    // 2 columns; a lone last card is centred
    const rows = Math.ceil(MAPS.length / 2);
    MAPS.forEach((map, i) => {
      const row = Math.floor(i / 2);
      const alone = i === MAPS.length - 1 && MAPS.length % 2 === 1;
      const col = alone ? 0.5 : i % 2;
      const left = cx - CARD_W - GAP_X / 2 + col * (CARD_W + GAP_X);
      const top = GRID_TOP + row * (CARD_H + GAP_Y) + (rows === 1 ? CARD_H / 2 : 0);
      this.createCard(map, i, left + CARD_W / 2, top);
    });

    const gridBottom = GRID_TOP + rows * CARD_H + (rows - 1) * GAP_Y;
    this.createEndlessStrip(gridBottom + 16);

    new NeonButton(this, 92, 60, 140, 52, {
      label: '‹  MENU',
      fontSize: 18,
      color: COLORS.textDim,
      onClick: () => this.scene.start(SCENES.menu),
    });
    if (storage.earnedStars > 0) {
      const spare = availableStars();
      new NeonButton(this, GAME_WIDTH - 112, 60, 200, 52, {
        label: spare > 0 ? `WORKSHOP \u2605${spare}` : 'WORKSHOP',
        fontSize: 17,
        color: COLORS.gold,
        onClick: () => this.scene.start(SCENES.workshop),
      });
    }

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== 'Escape') return;
      if (this.picker) this.closePicker();
      else this.scene.start(SCENES.menu);
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown', onKey));
  }

  private createCard(map: MapDef, index: number, centerX: number, top: number): void {
    const unlocked = storage.isUnlocked(index);
    const stars = storage.starsFor(index);
    const x = centerX - CARD_W / 2;
    const c = this.add.container(x, top);

    const frame = this.add.graphics();
    drawPanel(frame, 0, 0, CARD_W, CARD_H, {
      color: unlocked ? (stars > 0 ? COLORS.gold : COLORS.cyan) : 0x2a3550,
      fillAlpha: 0.96,
      radius: 14,
    });
    c.add(frame);

    // schematic preview of the sector's roads, platforms and reactor
    const px = PAD;
    const py = PAD;
    const preview = this.add.graphics();
    this.drawPreview(preview, map, px, py, unlocked);
    c.add(preview);

    c.add(text(this, INFO_X, PAD + 2, `SECTOR ${index + 1}`, 15, COLORS.textDim, { letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle));
    const name = text(this, INFO_X, PAD + 22, map.name, 27, unlocked ? COLORS.text : COLORS.textDim);
    if (name.width > INFO_W) name.setScale(INFO_W / name.width);
    c.add(name);
    c.add(
      text(this, INFO_X, PAD + 62, map.subtitle, 17, COLORS.textDim, {
        fontStyle: 'normal',
        wordWrap: { width: INFO_W },
      }),
    );
    c.add(text(this, INFO_X, CARD_H - PAD - 22, `${map.waves.length} WAVES`, 17, COLORS.cyan));

    // one "what's new" chip: a new tower, otherwise the new machines
    const freshTowers = index > 0 ? newTowersInMap(index) : [];
    const freshEnemies = index > 0 ? newEnemiesInMap(index) : [];
    let chipLabel = '';
    let chipColor: number = COLORS.cyan;
    if (freshTowers.length > 0) {
      const def = TOWERS[freshTowers[0]];
      chipLabel = `NEW TOWER: ${def.name.replace(' Tower', '').toUpperCase()}`;
      chipColor = def.color;
    } else if (freshEnemies.length > 0) {
      chipLabel = `NEW: ${freshEnemies.map((t) => ENEMIES[t].name.toUpperCase()).join(' + ')}`;
      chipColor = COLORS.red;
    }
    if (chipLabel) {
      const chipY = CARD_H - PAD - 62;
      const chip = text(this, INFO_X + 8, chipY + 6, chipLabel, 15, chipColor);
      if (chip.width > INFO_W - 16) chip.setScale((INFO_W - 16) / chip.width);
      const chipBg = this.add.graphics();
      chipBg.fillStyle(chipColor, 0.12);
      chipBg.fillRoundedRect(INFO_X, chipY, chip.displayWidth + 16, 30, 6);
      chipBg.lineStyle(1, chipColor, 0.6);
      chipBg.strokeRoundedRect(INFO_X, chipY, chip.displayWidth + 16, 30, 6);
      c.add([chipBg, chip]);
    }

    const sg = this.add.graphics();
    for (let s = 0; s < 3; s++) {
      const sx = CARD_W - PAD - 92 + s * 38;
      const sy = CARD_H - PAD - 12;
      sg.fillStyle(s < stars ? COLORS.gold : 0x1a2338, 1);
      sg.fillPoints(starPoints(sx, sy, 15), true);
      sg.lineStyle(1.5, s < stars ? 0xfff0b0 : 0x2a3550, 1);
      sg.strokePoints(starPoints(sx, sy, 15), true);
    }
    c.add(sg);

    if (!unlocked) {
      const lock = this.add.graphics();
      lock.fillStyle(0x03050a, 0.55);
      lock.fillRoundedRect(px, py, PREVIEW_W, PREVIEW_H, 8);
      const lx = px + PREVIEW_W / 2;
      const ly = py + PREVIEW_H / 2 - 10;
      lock.lineStyle(5, COLORS.textDim, 1);
      lock.beginPath();
      lock.arc(lx, ly - 8, 14, Math.PI, 0);
      lock.strokePath();
      lock.fillStyle(COLORS.textDim, 1);
      lock.fillRoundedRect(lx - 22, ly - 8, 44, 34, 6);
      c.add(lock);
      c.add(
        text(this, lx, py + PREVIEW_H - 10, `Clear Sector ${index} to unlock`, 16, COLORS.text, {
          fontStyle: 'normal',
        }).setOrigin(0.5, 1),
      );
    }

    const hit = this.add.zone(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: unlocked });
    c.add(hit);
    let pressed = false;
    hit.on('pointerdown', () => {
      pressed = true;
      if (unlocked) c.setScale(0.98);
    });
    hit.on('pointerout', () => {
      pressed = false;
      c.setScale(1);
    });
    hit.on('pointerup', () => {
      c.setScale(1);
      if (!pressed) return;
      pressed = false;
      if (!unlocked) {
        sfx.play('error');
        this.tweens.add({ targets: c, x: x + 6, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      sfx.play('click');
      void this.startSector(index);
    });
  }

  private drawPreview(g: Phaser.GameObjects.Graphics, map: MapDef, ox: number, oy: number, unlocked: boolean): void {
    const k = PREVIEW_W / GAME_WIDTH;
    g.fillStyle(0x0b1020, 1);
    g.fillRoundedRect(ox, oy, PREVIEW_W, PREVIEW_H, 8);
    g.lineStyle(1, 0x2a3550, 1);
    g.strokeRoundedRect(ox, oy, PREVIEW_W, PREVIEW_H, 8);
    const clampX = (x: number) => ox + Phaser.Math.Clamp(x, 0, GAME_WIDTH) * k;
    const py = (y: number) => oy + y * k;
    const roadColor = unlocked ? 0x2c3a58 : 0x1c2436;
    for (const lane of map.paths) {
      g.lineStyle(map.roadWidth * k + 2, roadColor, 1);
      g.beginPath();
      g.moveTo(clampX(lane[0].x), py(lane[0].y));
      for (const p of lane) g.lineTo(clampX(p.x), py(p.y));
      g.strokePath();
      // entry marker
      g.fillStyle(COLORS.red, unlocked ? 1 : 0.4);
      g.fillTriangle(ox + 2, py(lane[0].y) - 6, ox + 2, py(lane[0].y) + 6, ox + 12, py(lane[0].y));
    }
    for (const p of map.platforms) {
      g.fillStyle(unlocked ? COLORS.cyan : COLORS.textDim, unlocked ? 0.75 : 0.35);
      g.fillCircle(clampX(p.x), py(p.y), 4.5);
    }
    g.fillStyle(COLORS.cyan, unlocked ? 1 : 0.4);
    g.fillCircle(clampX(map.reactor.x), py(map.reactor.y), 8);
    g.fillStyle(0xffffff, unlocked ? 0.9 : 0.3);
    g.fillCircle(clampX(map.reactor.x), py(map.reactor.y), 3.5);
  }

  private async startSector(index: number, endless = false): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
    // still inside the tap gesture, so the browser allows fullscreen
    fullscreen.enterOnTouchDevices();
    await poki.commercialBreak();
    this.scene.start(SCENES.game, { mapIndex: index, endless });
  }

  /* Endless ------------------------------------------------------------ */

  /** Full-width strip under the sector cards: Endless mode, best wave, lock state. */
  private createEndlessStrip(top: number): void {
    const unlocked = storage.endlessUnlocked;
    const w = CARD_W * 2 + GAP_X;
    const x = GAME_WIDTH / 2 - w / 2;
    const c = this.add.container(x, top);
    const accent = unlocked ? COLORS.purple : 0x2a3550;
    const frame = this.add.graphics();
    drawPanel(frame, 0, 0, w, STRIP_H, { color: accent, fillAlpha: 0.96, radius: 14 });
    c.add(frame);
    c.add(text(this, 26, STRIP_H / 2, '\u221e ENDLESS', 28, unlocked ? COLORS.purple : COLORS.textDim).setOrigin(0, 0.5));
    const info = unlocked
      ? `How long can you hold? Stars at waves ${ENDLESS.milestones.join(', ')}.`
      : 'Clear Sector 1 to unlock';
    c.add(text(this, 220, STRIP_H / 2, info, 17, unlocked ? COLORS.text : COLORS.textDim, { fontStyle: 'normal' }).setOrigin(0, 0.5));
    if (unlocked) {
      const top = storage.endlessTop;
      c.add(text(this, w - 150, STRIP_H / 2, top > 0 ? `BEST WAVE ${top}` : 'NEW', 19, COLORS.gold).setOrigin(1, 0.5));
      c.add(text(this, w - 30, STRIP_H / 2, 'PLAY \u25b6', 20, COLORS.green).setOrigin(1, 0.5));
    }
    const hit = this.add.zone(w / 2, STRIP_H / 2, w, STRIP_H).setInteractive({ useHandCursor: unlocked });
    c.add(hit);
    hit.on('pointerup', () => {
      if (this.picker) return;
      if (!unlocked) {
        sfx.play('error');
        this.tweens.add({ targets: c, x: x + 6, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      sfx.play('click');
      this.openPicker();
    });
  }

  /** Choose which cleared sector's map to play Endless on. */
  private openPicker(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(-2000, -2000, GAME_WIDTH + 4000, GAME_HEIGHT + 4000, 0x03050a, 0.82)
      .setOrigin(0).setInteractive();
    dim.on('pointerup', () => this.closePicker());
    const pw = 800;
    const ph = 480;
    const g = this.add.graphics();
    drawPanel(g, cx - pw / 2, cy - ph / 2, pw, ph, { color: COLORS.purple, fillAlpha: 1, radius: 18 });
    // swallow taps on the panel itself
    const panelHit = this.add.zone(cx, cy, pw, ph).setInteractive();
    c.add([dim, g, panelHit]);
    c.add(text(this, cx, cy - ph / 2 + 44, '\u221e ENDLESS · CHOOSE A MAP', 28, COLORS.purple).setOrigin(0.5));
    c.add(text(this, cx, cy - ph / 2 + 82, 'Waves never stop. Workshop upgrades apply.', 17, COLORS.textDim,
      { fontStyle: 'normal' }).setOrigin(0.5));
    const bw = 340;
    const bh = 132;
    MAPS.forEach((map, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = cx + (col === 0 ? -1 : 1) * (bw / 2 + 12);
      const by = cy - 40 + row * (bh + 20) + bh / 2 - 30;
      const open = storage.starsFor(i) > 0;
      const best = storage.endlessBestFor(i);
      const label = open
        ? `${map.name}\n${best > 0 ? `Best: wave ${best}` : 'Not played yet'}`
        : `${map.name}\nClear Sector ${i + 1} first`;
      const btn = new NeonButton(this, bx, by, bw, bh, {
        label, fontSize: 20, color: open ? COLORS.purple : COLORS.textDim,
        onClick: () => {
          if (!open) return;
          this.closePicker();
          void this.startSector(i, true);
        },
      });
      btn.label?.setAlign('center').setLineSpacing(8);
      btn.setEnabled(open);
      c.add(btn);
    });
    c.add(new NeonButton(this, cx + pw / 2 - 40, cy - ph / 2 + 40, 52, 52, {
      label: '\u2715', fontSize: 22, color: COLORS.textDim,
      panelStyle: { corners: false, glow: false },
      onClick: () => this.closePicker(),
    }));
    this.picker = c;
  }

  private closePicker(): void {
    this.picker?.destroy();
    this.picker = null;
  }
}
