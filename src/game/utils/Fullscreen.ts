import { poki } from '../platform/PokiAdapter';

/**
 * Browser fullscreen for standalone play (e.g. GitHub Pages on a phone), which
 * hides the address bar so the battlefield gets the whole screen.
 *
 * Disabled on Poki (the site provides its own fullscreen) and wherever the
 * Fullscreen API is unavailable (iPhone Safari).
 */
type OrientationLock = { lock?: (o: string) => Promise<void> };

export const fullscreen = {
  get supported(): boolean {
    const el = document.documentElement as HTMLElement & { requestFullscreen?: unknown };
    return !poki.isLive && !!document.fullscreenEnabled && typeof el.requestFullscreen === 'function';
  },

  get active(): boolean {
    return !!document.fullscreenElement;
  },

  /** Must be called from a user gesture (tap/click handler). */
  enter(): void {
    if (!this.supported || this.active) return;
    document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as unknown as OrientationLock).lock?.('landscape'))
      .catch(() => {
        // denied or orientation lock unsupported: keep playing as-is
      });
  },

  exit(): void {
    if (this.active) document.exitFullscreen().catch(() => {});
  },

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  },

  /** Auto-enter on touch devices, where the browser UI eats the most space. */
  enterOnTouchDevices(): void {
    if (window.matchMedia('(pointer: coarse)').matches) this.enter();
  },
};
