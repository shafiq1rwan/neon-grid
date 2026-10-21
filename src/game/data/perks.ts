import { COLORS, ECONOMY, HACK } from '../config';
import { storage } from '../utils/Storage';

/**
 * Workshop: permanent upgrades bought with stars (sector ratings + challenges).
 * They help players who lose come back stronger, without changing how the
 * game plays. Balance numbers in docs/BALANCING.md are measured with no perks.
 */
export type PerkId = 'budget' | 'bounty' | 'salvage' | 'spare' | 'plating';

export interface PerkDef {
  id: PerkId;
  name: string;
  color: number;
  /** Star cost of each level, in order. */
  costs: number[];
  /** What the perk does at a given level (1-based). */
  describe(level: number): string;
}

export const PERKS: PerkDef[] = [
  {
    id: 'budget', name: 'Bigger Budget', color: COLORS.gold, costs: [1, 2, 3],
    describe: (l) => `+${l * 25} starting credits`,
  },
  {
    id: 'bounty', name: 'Wave Bounty', color: COLORS.green, costs: [1, 2],
    describe: (l) => `+${l * 25}% wave clear bonus`,
  },
  {
    id: 'salvage', name: 'Salvage Crew', color: COLORS.orange, costs: [1, 2],
    describe: (l) => `Selling refunds ${Math.round((ECONOMY.sellRefund + l * 0.1) * 100)}%`,
  },
  {
    id: 'spare', name: 'Spare Charge', color: COLORS.cyan, costs: [2],
    describe: () => `Start with ${HACK.startCharges + 1} hack charges`,
  },
  {
    id: 'plating', name: 'Reactor Plating', color: COLORS.pink, costs: [2, 3],
    describe: (l) => `+${l * 2} reactor HP`,
  },
];

export const TOTAL_PERK_COST = PERKS.reduce((sum, p) => sum + p.costs.reduce((a, b) => a + b, 0), 0);

function ownedLevel(p: PerkDef): number {
  return Math.min(storage.perkLevel(p.id), p.costs.length);
}

export function perkLevelOf(id: PerkId): number {
  return ownedLevel(PERKS.find((p) => p.id === id)!);
}

/** Stars spent on the levels currently owned. */
export function spentStars(): number {
  let spent = 0;
  for (const p of PERKS) {
    const level = ownedLevel(p);
    for (let i = 0; i < level; i++) spent += p.costs[i];
  }
  return spent;
}

export function availableStars(): number {
  return Math.max(0, storage.earnedStars - spentStars());
}

/** Gameplay effect of the owned perks (read once when a sector starts). */
export function perkEffects() {
  return {
    bonusCredits: perkLevelOf('budget') * 25,
    bountyMult: 1 + perkLevelOf('bounty') * 0.25,
    sellRefund: ECONOMY.sellRefund + perkLevelOf('salvage') * 0.1,
    startCharges: Math.min(HACK.maxCharges, HACK.startCharges + perkLevelOf('spare')),
    bonusHp: perkLevelOf('plating') * 2,
  };
}

/** Current sell refund rate (towers and the upgrade panel). */
export function sellRefundRate(): number {
  return perkEffects().sellRefund;
}
