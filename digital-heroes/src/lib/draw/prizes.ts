import { PLANS, POOL_PERCENT, TIERS, TIER_SHARES, type PlanKey, type Tier } from "../config";
import type { Match } from "./match";

const round2 = (n: number) => Math.round(n * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100 + 1e-9) / 100;

/** Pool created by this month's active subscribers. */
export function monthlyPoolBase(subs: { plan: PlanKey }[]): number {
  return round2(subs.reduce((sum, s) => sum + (PLANS[s.plan].monthlyEquivalent * POOL_PERCENT) / 100, 0));
}

/** Splits the pool 40/35/25. The jackpot tier also receives any rollover from last month. */
export function calculateTierPools(base: number, carryIn: number): Record<Tier, number> {
  return {
    5: round2(base * TIER_SHARES[5] + carryIn),
    4: round2(base * TIER_SHARES[4]),
    3: round2(base * TIER_SHARES[3]),
  };
}

export type Payout = { userId: string; tier: Tier; matched: number[]; amount: number };
export type TierSummary = { tier: Tier; pool: number; winners: number; each: number };

/**
 * Equal split inside a tier (rounded down to the paisa so we never overpay).
 * Only an unclaimed 5-match jackpot rolls over; unclaimed 4 and 3 tiers do not.
 */
export function distribute(winners: Match[], pools: Record<Tier, number>) {
  const payouts: Payout[] = [];
  const summaries: TierSummary[] = [];
  for (const tier of TIERS) {
    const inTier = winners.filter((w) => w.tier === tier);
    const each = inTier.length ? floor2(pools[tier] / inTier.length) : 0;
    for (const w of inTier) payouts.push({ userId: w.userId, tier, matched: w.matched, amount: each });
    summaries.push({ tier, pool: pools[tier], winners: inTier.length, each });
  }
  const jackpotWon = winners.some((w) => w.tier === 5);
  return { payouts, summaries, rolloverOut: jackpotWon ? 0 : pools[5] };
}
