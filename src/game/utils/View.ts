import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * The game uses Phaser's EXPAND scale mode: the 1280×720 battlefield is always
 * fully visible and the visible area grows sideways (wide phones) or
 * vertically (tablets) to fill the screen. Every camera is centred on the
 * battlefield, so world coordinates stay 0..1280 × 0..720 and edge-anchored UI
 * uses the bounds below.
 */
export interface ViewBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function viewBounds(scene: Phaser.Scene): ViewBounds {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const left = (GAME_WIDTH - width) / 2;
  const top = (GAME_HEIGHT - height) / 2;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

/** Centre the main camera on the battlefield and keep it centred on resize. */
export function centerCamera(scene: Phaser.Scene, onResize?: (view: ViewBounds) => void): void {
  const cam = scene.cameras.main;
  const apply = () => {
    cam.setSize(scene.scale.width, scene.scale.height);
    cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    onResize?.(viewBounds(scene));
  };
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
}
