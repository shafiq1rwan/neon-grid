/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Target portal: 'poki' (default, .env) or 'crazygames' (.env.crazygames). */
  readonly VITE_PORTAL: 'poki' | 'crazygames';
  /** Portal SDK script, injected into index.html. */
  readonly VITE_SDK_URL: string;
  /** CrazyGames only: 'true' turns ads on (Full Launch). Basic Launch builds keep them off. */
  readonly VITE_CG_ADS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
