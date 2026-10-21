import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { sfx } from './game/audio/SoundSystem';
import { poki } from './game/platform/PokiAdapter';
import { storage } from './game/utils/Storage';
import { applyRotation, installAutoRotate } from './game/utils/AutoRotate';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { MenuScene } from './game/scenes/MenuScene';
import { SectorScene } from './game/scenes/SectorScene';
import { ResultScene } from './game/scenes/ResultScene';
import { UIScene } from './game/scenes/UIScene';
import { WorkshopScene } from './game/scenes/WorkshopScene';

sfx.setMuted(storage.data.muted);

// Audio may only start after a user gesture.
const unlock = () => sfx.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);
window.addEventListener('touchend', unlock, { passive: true });

// Silence audio during ads and while the tab is hidden.
poki.setAudioHooks({ pause: () => sfx.suspend(), resume: () => sfx.resume() });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sfx.suspend();
  else if (!poki.isAdPlaying) sfx.resume();
});

// Keep the page from scrolling / zooming on mobile.
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  // EXPAND keeps the whole 1280x720 battlefield visible and grows the view to
  // fill wider (phones) or taller (tablets) screens. Scenery is baked VIEW_PAD
  // beyond the battlefield; anything past that is plain background colour.
  // Note: in EXPAND, scale max also caps the on-screen CSS size, so keep it
  // far above real screens (4096 covers 4K displays).
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // EXPAND grows one dimension by the parent's aspect ratio. If a host page
    // briefly squeezes the frame to a sliver (1-3 px), that asks for a canvas
    // hundreds of thousands of pixels long and WebGL fails with "Framebuffer
    // status: Incomplete Attachment". Cap it well above any real screen.
    max: { width: 4096, height: 4096 },
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  // Phaser blocks page scrolling for these keys *after* handling them. (A
  // window-level preventDefault would make Phaser ignore the keys entirely.)
  input: { activePointers: 2, keyboard: { capture: [32, 38, 40] } },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, MenuScene, SectorScene, GameScene, UIScene, ResultScene, WorkshopScene],
};

/**
 * Phaser 3.90 refreshes on `screen.orientation` change *before* re-reading the
 * parent size, then records the new size without refreshing again — so after
 * rotating a phone the canvas keeps its old (portrait) size. Re-measure and
 * refresh a few times after any resize/rotation until the browser settles.
 */
function keepScaleInSync(game: Phaser.Game, container: HTMLElement): void {
  let timers: number[] = [];
  const sync = () => {
    // portrait phones: (un)rotate the container before measuring it
    applyRotation(container);
    // ignore transient sliver layouts while the host page re-flows
    const parent = game.scale.parent as HTMLElement | null;
    const rect = parent?.getBoundingClientRect();
    if (!rect || rect.width < 32 || rect.height < 32) return;
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const schedule = () => {
    applyRotation(container);
    for (const t of timers) window.clearTimeout(t);
    timers = [0, 150, 400, 900].map((ms) => window.setTimeout(sync, ms));
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  screen.orientation?.addEventListener?.('change', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
}

void poki.init().finally(() => {
  // Phones held in portrait play rotated instead of showing a "rotate" screen.
  const container = document.getElementById('game')!;
  applyRotation(container);
  const game = new Phaser.Game(config);
  installAutoRotate(game, container);
  keepScaleInSync(game, container);
  // Exposed in development only, for debugging and automated smoke tests.
  if (import.meta.env.DEV) (window as unknown as { __nwd: Phaser.Game }).__nwd = game;
});
