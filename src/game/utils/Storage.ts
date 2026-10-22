import { endlessStarsFor } from '../data/endless';

/** Settings and progress persisted in LocalStorage (fails silently when unavailable). */
export interface SaveData {
  muted: boolean;
  tutorialDone: boolean;
  /** The "Tap to hack!" hint has been completed. */
  hackTipDone: boolean;
  bestStars: number;
  bestWave: number;
  wins: number;
  plays: number;
  /** Best star rating per campaign sector (0 = not cleared). */
  mapStars: number[];
  /** Last chosen game speed was 2x (kept across waves and sectors). */
  fastSpeed: boolean;
  /** Workshop upgrades bought with stars: perk id → level. */
  perks: Record<string, number>;
  /** Completed sector challenges (ids from data/challenges.ts); each is worth a star. */
  challenges: string[];
  /** Endless mode: best wave reached per map (index = sector). */
  endlessBest: number[];
}

// Kept from before the rename to "Neon Wasteland": changing it would wipe players' saves.
const KEY = 'neon-wasteland-defense:v1';

const DEFAULTS: SaveData = {
  muted: false,
  tutorialDone: false,
  hackTipDone: false,
  bestStars: 0,
  bestWave: 0,
  wins: 0,
  plays: 0,
  mapStars: [],
  fastSpeed: false,
  perks: {},
  challenges: [],
  endlessBest: [],
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
        if (!Array.isArray(this.data.challenges)) this.data.challenges = [];
        if (!Array.isArray(this.data.endlessBest)) this.data.endlessBest = [];
        this.data.endlessBest = this.data.endlessBest.map((n) => (typeof n === 'number' ? n : 0));
        this.data.challenges = this.data.challenges.filter((c) => typeof c === 'string');
        const perks = this.data.perks as unknown;
        if (!perks || typeof perks !== 'object' || Array.isArray(perks)) this.data.perks = {};
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

  /** Stars from sector ratings, completed challenges and Endless milestones (the Workshop currency). */
  get earnedStars(): number {
    return this.totalStars + this.data.challenges.length + this.endlessStars;
  }

  /** Endless mode unlocks once Sector 1 is cleared. */
  get endlessUnlocked(): boolean {
    return this.starsFor(0) > 0;
  }

  endlessBestFor(mapIndex: number): number {
    return this.data.endlessBest[mapIndex] ?? 0;
  }

  /** Best wave over every map. */
  get endlessTop(): number {
    return this.data.endlessBest.reduce((a, b) => Math.max(a, b), 0);
  }

  /** One star per Endless milestone reached by the best run on any map. */
  get endlessStars(): number {
    return endlessStarsFor(this.endlessTop);
  }

  /** Returns true when this is a new best for the map. */
  recordEndless(mapIndex: number, wave: number): boolean {
    if (wave <= this.endlessBestFor(mapIndex)) return false;
    const list = [...this.data.endlessBest];
    while (list.length <= mapIndex) list.push(0);
    list[mapIndex] = wave;
    this.update({ endlessBest: list });
    return true;
  }

  hasChallenge(id: string): boolean {
    return this.data.challenges.includes(id);
  }

  completeChallenge(id: string): void {
    if (this.hasChallenge(id)) return;
    this.update({ challenges: [...this.data.challenges, id] });
  }

  perkLevel(id: string): number {
    const n = this.data.perks[id];
    return typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
  }

  setPerkLevel(id: string, level: number): void {
    this.update({ perks: { ...this.data.perks, [id]: level } });
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
