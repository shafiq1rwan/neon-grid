/** Settings and progress persisted in LocalStorage (fails silently when unavailable). */
export interface SaveData {
  muted: boolean;
  tutorialDone: boolean;
  bestStars: number;
  bestWave: number;
  wins: number;
  plays: number;
}

const KEY = 'neon-wasteland-defense:v1';

const DEFAULTS: SaveData = {
  muted: false,
  tutorialDone: false,
  bestStars: 0,
  bestWave: 0,
  wins: 0,
  plays: 0,
};

class Storage {
  readonly data: SaveData;

  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        for (const k of Object.keys(DEFAULTS) as (keyof SaveData)[]) {
          if (typeof parsed[k] === typeof DEFAULTS[k]) (this.data as unknown as Record<string, unknown>)[k] = parsed[k];
        }
      }
    } catch {
      // private mode / blocked storage: keep defaults
    }
  }

  update(patch: Partial<SaveData>): void {
    Object.assign(this.data, patch);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // ignore quota / privacy errors
    }
  }
}

export const storage = new Storage();
