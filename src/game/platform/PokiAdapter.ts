/**
 * Isolates all Poki SDK calls (https://developers.poki.com/guide/sdk-html5).
 *
 * Only documented SDK v2 functions are used:
 *   init, gameLoadingFinished, gameplayStart, gameplayStop,
 *   commercialBreak(beforeAdCallback), rewardedBreak(beforeAdCallback).
 *
 * When the SDK script is unavailable (local dev, offline, ad blockers) every
 * call becomes a safe no-op and breaks resolve immediately.
 */

interface PokiSDKApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(beforeAd?: () => void): Promise<void>;
  rewardedBreak(beforeAd?: () => void): Promise<boolean>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
  }
}

type AudioHooks = { pause: () => void; resume: () => void };

class PokiAdapter {
  private sdk: PokiSDKApi | null = null;
  /** True once init() resolved; ads are only requested from a ready SDK. */
  private ready = false;
  private gameplayActive = false;
  private adPlaying = false;
  private audio: AudioHooks = { pause: () => {}, resume: () => {} };

  get available(): boolean {
    return this.sdk !== null;
  }

  get isAdPlaying(): boolean {
    return this.adPlaying;
  }

  /** Register how to mute/unmute game audio around ads. */
  setAudioHooks(hooks: AudioHooks): void {
    this.audio = hooks;
  }

  async init(): Promise<void> {
    const sdk = window.PokiSDK;
    // In local development the SDK is skipped unless explicitly requested with ?poki
    const wanted = !import.meta.env.DEV || new URLSearchParams(location.search).has('poki');
    if (!sdk || !wanted) {
      console.info('[Poki] SDK not active, running standalone.');
      return;
    }
    try {
      // Never let a slow or blocked SDK keep the game from booting.
      const timeout = new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), 3000));
      const result = await Promise.race([sdk.init().then(() => 'ok' as const), timeout]);
      if (result === 'timeout') console.info('[Poki] SDK init timed out, continuing.');
      else this.ready = true;
      this.sdk = sdk;
    } catch {
      // The docs say to load the game anyway (e.g. ad blocker); keep using the SDK object.
      console.info('[Poki] SDK init failed, continuing without ads.');
      this.sdk = sdk;
    }
  }

  gameLoadingFinished(): void {
    this.safe(() => this.sdk?.gameLoadingFinished());
  }

  gameplayStart(): void {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    this.safe(() => this.sdk?.gameplayStart());
  }

  gameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    this.safe(() => this.sdk?.gameplayStop());
  }

  /** Natural break (before restarting / starting a new run). Never during combat. */
  async commercialBreak(): Promise<void> {
    if (!this.sdk || !this.ready || this.adPlaying) return;
    this.gameplayStop();
    this.adPlaying = true;
    try {
      await this.sdk.commercialBreak(() => this.audio.pause());
    } catch {
      // ignore
    } finally {
      this.adPlaying = false;
      this.audio.resume();
    }
  }

  /**
   * Rewarded break. Resolves true only if the video was watched. Without the
   * SDK (standalone / local play) the reward is granted so the feature works.
   */
  async rewardedBreak(): Promise<boolean> {
    if (!this.sdk) return true;
    if (!this.ready || this.adPlaying) return false;
    this.gameplayStop();
    this.adPlaying = true;
    try {
      return await this.sdk.rewardedBreak(() => this.audio.pause());
    } catch {
      return false;
    } finally {
      this.adPlaying = false;
      this.audio.resume();
    }
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn('[Poki] call failed', err);
    }
  }
}

export const poki = new PokiAdapter();
