import type { AudioHooks, Platform } from './Platform';

/**
 * Isolates all CrazyGames SDK v3 calls (https://docs.crazygames.com/sdk/intro/).
 *
 * Used: init, environment, game.loadingStart / loadingStop, game.gameplayStart /
 * gameplayStop, game.settings.muteAudio + addSettingsChangeListener,
 * ad.requestAd('midgame' | 'rewarded', callbacks), ad.hasAdblock.
 *
 * Ads only run when VITE_CG_ADS is 'true'. CrazyGames disables monetization during
 * Basic Launch and forbids rewarded buttons that cannot pay out, so the Basic
 * Launch build ships with ads off (no Revive button) and Full Launch turns them on.
 *
 * Outside CrazyGames the SDK reports environment 'disabled' and every call throws,
 * so the adapter then stays inactive and every call becomes a safe no-op.
 */

type AdType = 'midgame' | 'rewarded';
type AdError = { code: string; message: string };
type CrazySettings = { muteAudio: boolean };

interface CrazyGamesSDKApi {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    settings: CrazySettings;
    addSettingsChangeListener(listener: (settings: CrazySettings) => void): void;
  };
  ad: {
    requestAd(
      type: AdType,
      callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (error: AdError) => void },
    ): void;
    hasAdblock(): Promise<boolean>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDKApi };
  }
}

const ADS_ENABLED = import.meta.env.VITE_CG_ADS === 'true';

export class CrazyGamesAdapter implements Platform {
  private sdk: CrazyGamesSDKApi | null = null;
  private gameplayActive = false;
  private adPlaying = false;
  /** Set when the SDK reports ads cannot play here (adblock, Basic Launch, kids mode). */
  private adsBlocked = false;
  private audio: AudioHooks = { pause: () => {}, resume: () => {}, mute: () => {} };

  /** CrazyGames provides fullscreen, and its rules forbid an in-game fullscreen button. */
  readonly hostFullscreen = true;

  get rewardedAvailable(): boolean {
    if (!this.sdk) return import.meta.env.DEV;
    return ADS_ENABLED && !this.adsBlocked;
  }

  get isAdPlaying(): boolean {
    return this.adPlaying;
  }

  setAudioHooks(hooks: AudioHooks): void {
    this.audio = hooks;
  }

  async init(): Promise<void> {
    const sdk = window.CrazyGames?.SDK;
    // In local development the SDK is skipped unless explicitly requested with ?crazygames
    const wanted = !import.meta.env.DEV || new URLSearchParams(location.search).has('crazygames');
    if (!sdk || !wanted) {
      console.info('[CrazyGames] SDK not active, running standalone.');
      return;
    }
    try {
      // Never let a slow or blocked SDK keep the game from booting, but if init
      // finishes later still use it from then on.
      const initDone = sdk.init().then(() => this.activate(sdk));
      initDone.catch(() => console.info('[CrazyGames] SDK init failed, continuing without it.'));
      const timeout = new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), 3000));
      const result = await Promise.race([initDone.then(() => 'ok' as const), timeout]);
      if (result === 'timeout') console.info('[CrazyGames] SDK still initialising, starting the game anyway.');
    } catch {
      console.info('[CrazyGames] SDK init failed, continuing without it.');
    }
  }

  private activate(sdk: CrazyGamesSDKApi): void {
    // off CrazyGames' domains every SDK call throws
    if (sdk.environment === 'disabled') return;
    this.sdk = sdk;
    this.safe(() => sdk.game.loadingStart());
    // the portal's mute setting takes priority over the in-game toggle
    this.safe(() => {
      this.audio.mute(sdk.game.settings.muteAudio);
      sdk.game.addSettingsChangeListener((settings) => this.audio.mute(settings.muteAudio));
    });
    if (ADS_ENABLED) {
      sdk.ad.hasAdblock().then((blocked) => {
        if (blocked) this.adsBlocked = true;
      }).catch(() => {});
    }
  }

  gameLoadingFinished(): void {
    this.safe(() => this.sdk?.game.loadingStop());
  }

  gameplayStart(): void {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    this.safe(() => this.sdk?.game.gameplayStart());
  }

  gameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    this.safe(() => this.sdk?.game.gameplayStop());
  }

  /** CrazyGames has no Game Events equivalent; kept for dev logging only. */
  measure(category: string, what: string, action: string): void {
    if (import.meta.env.DEV) console.debug('[CrazyGames] measure', category, what, action);
  }

  async commercialBreak(): Promise<void> {
    if (!this.sdk || !ADS_ENABLED || this.adsBlocked || this.adPlaying) return;
    this.gameplayStop();
    this.adPlaying = true;
    try {
      await this.requestAd(this.sdk, 'midgame');
    } finally {
      this.adPlaying = false;
      this.audio.resume();
    }
  }

  async rewardedBreak(): Promise<boolean> {
    if (!this.sdk) return import.meta.env.DEV;
    if (!ADS_ENABLED || this.adsBlocked || this.adPlaying) return false;
    this.gameplayStop();
    this.adPlaying = true;
    try {
      // the reward is granted only on adFinished, never on adError
      return await this.requestAd(this.sdk, 'rewarded');
    } finally {
      this.adPlaying = false;
      this.audio.resume();
    }
  }

  /** Resolves true when the ad finished, false on any error. Audio is muted on adStarted, not on request. */
  private requestAd(sdk: CrazyGamesSDKApi, type: AdType): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => this.audio.pause(),
          adFinished: () => resolve(true),
          adError: (error) => {
            if (error.code === 'adblock' || error.code === 'adsDisabled') this.adsBlocked = true;
            resolve(false);
          },
        });
      } catch {
        resolve(false);
      }
    });
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn('[CrazyGames] call failed', err);
    }
  }
}
