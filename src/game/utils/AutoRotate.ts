import Phaser from 'phaser';

/**
 * Auto-rotate for phones held in portrait: instead of asking the player to
 * turn the device, the game container is laid out as a landscape box and
 * rotated 90° with CSS, so the game always plays in landscape.
 *
 * Phaser doesn't support a rotated canvas on its own, so two things are
 * patched on this game instance:
 *  - parent size is read from the container's layout size (unaffected by the
 *    CSS transform) instead of its on-screen bounding box;
 *  - pointer coordinates are mapped from the screen back into the rotated
 *    canvas.
 */

let rotated = false;

/** True while the game is being shown rotated (portrait touch device). */
export function isAutoRotated(): boolean {
  return rotated;
}

function shouldRotate(): boolean {
  const portrait = window.innerHeight > window.innerWidth;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  return portrait && touch;
}

/** Apply or clear the rotation on the game container. Safe to call often. */
export function applyRotation(container: HTMLElement): void {
  rotated = shouldRotate();
  const s = container.style;
  if (rotated) {
    // a landscape box (screen height × screen width), rotated into the portrait screen
    s.inset = 'auto';
    s.top = '0';
    s.left = '0';
    s.width = `${window.innerHeight}px`;
    s.height = `${window.innerWidth}px`;
    s.transformOrigin = 'top left';
    s.transform = 'rotate(90deg) translateY(-100%)';
  } else {
    s.inset = '0';
    s.top = '';
    s.left = '';
    s.width = '';
    s.height = '';
    s.transformOrigin = '';
    s.transform = '';
  }
}

interface ScaleInternals {
  parent: HTMLElement | null;
  parentSize: Phaser.Structs.Size;
  getParentBounds(): boolean;
  updateCenter(): void;
}

interface InputInternals {
  transformPointer(pointer: Phaser.Input.Pointer, pageX: number, pageY: number, wasMove: boolean): void;
}

/** Patch the game so sizing and input work while rotated. Call right after creating the game. */
export function installAutoRotate(game: Phaser.Game, container: HTMLElement): void {
  const scale = game.scale as unknown as ScaleInternals;
  const originalBounds = scale.getParentBounds.bind(scale);
  scale.getParentBounds = function patchedBounds(this: ScaleInternals): boolean {
    if (!rotated || !this.parent) return originalBounds();
    // layout size ignores the CSS rotation (getBoundingClientRect would be swapped)
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    if (this.parentSize.width !== w || this.parentSize.height !== h) {
      this.parentSize.setSize(w, h);
      return true;
    }
    return false;
  };

  // autoCenter measures the canvas with getBoundingClientRect too, which would
  // shift it sideways by half the width/height difference. Centre on layout size.
  const originalCenter = scale.updateCenter.bind(scale);
  scale.updateCenter = function patchedCenter(this: ScaleInternals): void {
    if (!rotated) {
      originalCenter();
      return;
    }
    const canvas = game.canvas;
    const x = Math.floor((this.parentSize.width - canvas.clientWidth) / 2);
    const y = Math.floor((this.parentSize.height - canvas.clientHeight) / 2);
    canvas.style.marginLeft = `${x}px`;
    canvas.style.marginTop = `${y}px`;
  };

  const input = game.input as unknown as InputInternals;
  const originalTransform = input.transformPointer.bind(input);
  input.transformPointer = (pointer, pageX, pageY, wasMove) => {
    if (!rotated) {
      originalTransform(pointer, pageX, pageY, wasMove);
      return;
    }
    // Container local → screen is (u, v) → (H - v, u) with H = container height
    // (= screen width), so screen → local is u = pageY, v = H - pageX.
    const canvas = game.canvas;
    const u = pageY - window.scrollY;
    const v = container.clientHeight - (pageX - window.scrollX);
    const cx = u - canvas.offsetLeft;
    const cy = v - canvas.offsetTop;
    const x = (cx * game.scale.width) / canvas.clientWidth;
    const y = (cy * game.scale.height) / canvas.clientHeight;

    const p0 = pointer.position;
    const p1 = pointer.prevPosition;
    p1.x = p0.x;
    p1.y = p0.y;
    const a = pointer.smoothFactor;
    if (!wasMove || a === 0) {
      p0.x = x;
      p0.y = y;
    } else {
      p0.x = x * a + p1.x * (1 - a);
      p0.y = y * a + p1.y * (1 - a);
    }
  };

  // Phaser may have measured the (rotated) container before this patch: re-measure.
  const remeasure = () => {
    scale.getParentBounds();
    game.scale.refresh();
  };
  if (game.isBooted) remeasure();
  else game.events.once(Phaser.Core.Events.READY, remeasure);
}
