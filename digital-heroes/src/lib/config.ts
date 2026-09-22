/** Single place for every business rule in the PRD. */

export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const MAX_SCORES = 5;

export type PlanKey = "monthly" | "yearly";

export const PLANS: Record<
  PlanKey,
  { label: string; priceInr: number; monthlyEquivalent: number; interval: string; cycles: number }
> = {
  monthly: { label: "Monthly", priceInr: 499, monthlyEquivalent: 499, interval: "month", cycles: 120 },
  // Yearly is discounted: 4999 vs 12 x 499 = 5988
  yearly: { label: "Yearly", priceInr: 4999, monthlyEquivalent: 4999 / 12, interval: "year", cycles: 10 },
};

export const MIN_CHARITY_PERCENT = 10;
export const MAX_CHARITY_PERCENT = 50;

/** Share of each subscription (monthly equivalent) that funds the prize pool. */
export const POOL_PERCENT = 40;

/** How the monthly pool splits between match tiers (PRD section 07). */
export const TIER_SHARES = { 5: 0.4, 4: 0.35, 3: 0.25 } as const;
export type Tier = 5 | 4 | 3;
export const TIERS: Tier[] = [5, 4, 3];

export const DRAW_NUMBER_COUNT = 5;
export const DRAW_MIN = 1;
export const DRAW_MAX = 45;

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const inr2 = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);
