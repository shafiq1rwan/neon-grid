import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { sfx } from './game/audio/SoundSystem';
import { poki } from './game/platform/PokiAdapter';
import { storage } from './game/utils/Storage';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { MenuScene } from './game/scenes/MenuScene';
import { ResultScene } from './game/scenes/ResultScene';
import { UIScene } from './game/scenes/UIScene';

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
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  // EXPAND keeps the whole 1280x720 battlefield visible and grows the view to
  // fill wider (phones) or taller (tablets) screens. Scenery is baked VIEW_PAD
  // beyond the battlefield; anything past that is plain background colour.
  // (No scale min/max: in EXPAND they would also clamp the on-screen CSS size.)
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  input: { activePointers: 2 },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, MenuScene, GameScene, UIScene, ResultScene],
};

/**
 * Phaser 3.90 refreshes on `screen.orientation` change *before* re-reading the
 * parent size, then records the new size without refreshing again — so after
 * rotating a phone the canvas keeps its old (portrait) size. Re-measure and
 * refresh a few times after any resize/rotation until the browser settles.
 */
function keepScaleInSync(game: Phaser.Game): void {
  let timers: number[] = [];
  const sync = () => {
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const schedule = () => {
    for (const t of timers) window.clearTimeout(t);
    timers = [0, 150, 400, 900].map((ms) => window.setTimeout(sync, ms));
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  screen.orientation?.addEventListener?.('change', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
}

void poki.init().finally(() => {
  const game = new Phaser.Game(config);
  keepScaleInSync(game);
  // Exposed in development only, for debugging and automated smoke tests.
  if (import.meta.env.DEV) (window as unknown as { __nwd: Phaser.Game }).__nwd = game;
});
