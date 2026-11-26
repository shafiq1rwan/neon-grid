import { CrazyGamesAdapter } from './CrazyGamesAdapter';
import { PokiAdapter } from './PokiAdapter';
import type { Platform } from './Platform';

export type { Platform } from './Platform';

/**
 * The portal this build targets: `npm run build` is Poki, `npm run build:crazygames`
 * sets VITE_PORTAL=crazygames (.env.crazygames). The constant is replaced at
 * build time, so the other adapter is dropped from the bundle.
 */
export const platform: Platform =
  import.meta.env.VITE_PORTAL === 'crazygames' ? new CrazyGamesAdapter() : new PokiAdapter();
