/**
 * Optional sector challenges, each worth one Workshop star (once). Skill
 * challenges count even when the run is lost, so first-time players who lose
 * still earn something to spend; "win without..." challenges need a victory.
 * They reward the game's own skills: perfect hacks, combos, calling waves
 * early, and efficient builds.
 */
export type ChallengeKind = 'hacks' | 'perfectHacks' | 'combo' | 'earlyCalls' | 'noSell' | 'maxTowers';

export interface ChallengeDef {
  /** Stable save id. */
  id: string;
  kind: ChallengeKind;
  target: number;
  text: string;
}

/** What a run achieved (tracked by GameScene). */
export interface RunStats {
  /** Successful hacks of any kind. */
  hacks: number;
  perfectHacks: number;
  bestCombo: number;
  earlyCalls: number;
  sold: number;
  /** Most towers standing at the same time. */
  peakTowers: number;
}

export const CHALLENGES: ChallengeDef[][] = [
  [
    // v1.2.1: was "Land 2 perfect hacks" (4 of ~500 fit-test players); most players hack
    { id: 's1-hack', kind: 'hacks', target: 3, text: 'Hack 3 machines' },
    { id: 's1-early', kind: 'earlyCalls', target: 3, text: 'Call 3 waves early' },
  ],
  [
    { id: 's2-combo', kind: 'combo', target: 4, text: 'Get a x4 combo' },
    { id: 's2-nosell', kind: 'noSell', target: 0, text: 'Win without selling a tower' },
  ],
  [
    { id: 's3-towers', kind: 'maxTowers', target: 9, text: 'Win with 9 towers or fewer' },
    { id: 's3-perfect', kind: 'perfectHacks', target: 4, text: 'Land 4 perfect hacks' },
  ],
  [
    { id: 's4-combo', kind: 'combo', target: 6, text: 'Get a x6 combo' },
    { id: 's4-early', kind: 'earlyCalls', target: 5, text: 'Call 5 waves early' },
  ],
];

export function challengesFor(mapIndex: number): ChallengeDef[] {
  return CHALLENGES[mapIndex] ?? [];
}

export function emptyRunStats(): RunStats {
  return { hacks: 0, perfectHacks: 0, bestCombo: 0, earlyCalls: 0, sold: 0, peakTowers: 0 };
}

/** Challenges about how you won only count on a victory. */
export function needsWin(c: ChallengeDef): boolean {
  return c.kind === 'noSell' || c.kind === 'maxTowers';
}

export function challengeMet(c: ChallengeDef, s: RunStats): boolean {
  switch (c.kind) {
    case 'hacks': return s.hacks >= c.target;
    case 'perfectHacks': return s.perfectHacks >= c.target;
    case 'combo': return s.bestCombo >= c.target;
    case 'earlyCalls': return s.earlyCalls >= c.target;
    case 'noSell': return s.sold === 0;
    case 'maxTowers': return s.peakTowers <= c.target;
  }
}

/** Live progress text for the pause screen, e.g. "1 / 2". */
export function challengeProgress(c: ChallengeDef, s: RunStats): string {
  switch (c.kind) {
    case 'hacks': return `${Math.min(s.hacks, c.target)} / ${c.target}`;
    case 'perfectHacks': return `${Math.min(s.perfectHacks, c.target)} / ${c.target}`;
    case 'combo': return `best x${s.bestCombo}`;
    case 'earlyCalls': return `${Math.min(s.earlyCalls, c.target)} / ${c.target}`;
    case 'noSell': return s.sold === 0 ? 'on track' : 'failed';
    case 'maxTowers': return `${s.peakTowers} / ${c.target}`;
  }
}
