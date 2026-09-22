import { PLANS, POOL_PERCENT, type PlanKey } from "./config";

/** What a subscriber's fee is used for, per month. */
export function feeBreakdown(plan: PlanKey, charityPercent: number) {
  const fee = PLANS[plan].monthlyEquivalent;
  const charity = (fee * charityPercent) / 100;
  const pool = (fee * POOL_PERCENT) / 100;
  return { fee, charity, pool, platform: fee - charity - pool };
}
