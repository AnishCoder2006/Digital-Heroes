import { PLANS, POOL_PERCENT, type PlanKey } from "./config";

/** What a subscriber's fee is used for, per month. */
export function feeBreakdown(plan: PlanKey, charityPercent: number) {
  const fee = PLANS[plan].monthlyEquivalent;
  const charity = (fee * charityPercent) / 100;
  const pool = (fee * POOL_PERCENT) / 100;
  return { fee, charity, pool, platform: fee - charity - pool };
}

/**
 * Calculates the exact charity contribution amount for a given plan payment.
 * For a payment of PLANS[plan].priceInr, charity share is (priceInr * charityPercent) / 100.
 */
export function calculatePaymentCharityShare(plan: PlanKey, charityPercent: number): number {
  const price = PLANS[plan].priceInr;
  const charity = (price * charityPercent) / 100;
  return Number(charity.toFixed(2));
}

/** Converts rupees to whole paise (e.g. ₹99.80 -> 9980 paise). */
export function inPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
