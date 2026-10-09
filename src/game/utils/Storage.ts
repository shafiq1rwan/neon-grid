/** Settings and progress persisted in LocalStorage (fails silently when unavailable). */
export interface SaveData {
  muted: boolean;
  tutorialDone: boolean;
  bestStars: number;
  bestWave: number;
  wins: number;
  plays: number;
  /** Best star rating per campaign sector (0 = not cleared). */
  mapStars: number[];
}

const KEY = 'neon-wasteland-defense:v1';

const DEFAULTS: SaveData = {
  muted: false,
  tutorialDone: false,
  bestStars: 0,
  bestWave: 0,
  wins: 0,
  plays: 0,
  mapStars: [],
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
        if (!Array.isArray(this.data.mapStars)) this.data.mapStars = [];
        this.data.mapStars = this.data.mapStars.map((n) => (typeof n === 'number' ? n : 0));
        // Saves from before the campaign: a win means sector 1 was cleared.
        if (this.data.mapStars.length === 0 && this.data.bestStars > 0) this.data.mapStars = [this.data.bestStars];
      }
    } catch {
      // private mode / blocked storage: keep defaults
    }
  }

  starsFor(mapIndex: number): number {
    return this.data.mapStars[mapIndex] ?? 0;
  }

  /** A sector is playable once the previous one has been cleared. */
  isUnlocked(mapIndex: number): boolean {
    return mapIndex === 0 || this.starsFor(mapIndex - 1) > 0;
  }

  recordStars(mapIndex: number, stars: number): void {
    const list = [...this.data.mapStars];
    while (list.length <= mapIndex) list.push(0);
    list[mapIndex] = Math.max(list[mapIndex], stars);
    this.update({ mapStars: list });
  }

  get totalStars(): number {
    return this.data.mapStars.reduce((a, b) => a + b, 0);
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
