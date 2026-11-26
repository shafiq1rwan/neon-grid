/**
 * What the game needs from the web portal it runs on. One adapter per portal
 * (PokiAdapter, CrazyGamesAdapter); `platform/index.ts` picks one at build time
 * from VITE_PORTAL. Without a portal SDK every call is a safe no-op.
 */

export type AudioHooks = {
  /** Silence audio while an ad plays. */
  pause: () => void;
  resume: () => void;
  /** The portal's own mute setting, which overrides the in-game toggle. */
  mute: (muted: boolean) => void;
};

export interface Platform {
  /** Resolves once the SDK is ready or given up on; never rejects. */
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Progress events for the portal's analytics (Poki Game Events). */
  measure(category: string, what: string, action: string): void;
  /** Natural break (before restarting / starting a new run). Never during combat. */
  commercialBreak(): Promise<void>;
  /** Resolves true only if the rewarded video was watched. */
  rewardedBreak(): Promise<boolean>;
  /** Offer a rewarded ad at all? Never show a button that cannot pay out. */
  readonly rewardedAvailable: boolean;
  readonly isAdPlaying: boolean;
  /** The host page has its own fullscreen control, so the game must not show one. */
  readonly hostFullscreen: boolean;
  setAudioHooks(hooks: AudioHooks): void;
}
