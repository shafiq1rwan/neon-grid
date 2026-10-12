import type Phaser from 'phaser';
import { viewBounds } from '../utils/View';

/** Drawers follow the battlefield scale, preserving compact layouts on phones. */
export function drawerLayout(scene: Phaser.Scene, desktopWidth: number) {
  const view = viewBounds(scene);
  const displayed = scene.scale.canvas.getBoundingClientRect().width;
  const compact = displayed < 1000 || window.matchMedia('(pointer: coarse)').matches;
  const scale = 1;
  const width = Math.min(desktopWidth, view.width - 40);
  return { compact, scale, width, x: view.left + (view.width - width * scale) / 2 };
}
