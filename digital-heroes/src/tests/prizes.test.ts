import { describe, expect, it } from "vitest";
import { runDraw } from "@/lib/draw";
import { calculateTierPools, distribute, monthlyPoolBase } from "@/lib/draw/prizes";

describe("prize pool", () => {
  it("40% of each monthly-equivalent fee funds the pool", () => {
    expect(monthlyPoolBase([{ plan: "monthly" }, { plan: "monthly" }])).toBe(399.2); // 2 x 499 x 40%
  });
  it("splits 40/35/25 and adds rollover to the jackpot only", () => {
    expect(calculateTierPools(1000, 0)).toEqual({ 5: 400, 4: 350, 3: 250 });
    expect(calculateTierPools(1000, 250)).toEqual({ 5: 650, 4: 350, 3: 250 });
  });
  it("splits a tier equally between winners, rounding down", () => {
    const winners = [1, 2, 3].map((n) => ({ userId: `u${n}`, tier: 4 as const, matched: [], count: 4 }));
    const { payouts } = distribute(winners, { 5: 0, 4: 100, 3: 0 });
    expect(payouts.map((p) => p.amount)).toEqual([33.33, 33.33, 33.33]);
  });
  it("rolls the jackpot over only when nobody matches 5", () => {
    const pools = { 5: 400, 4: 350, 3: 250 };
    expect(distribute([], pools).rolloverOut).toBe(400);
    expect(distribute([{ userId: "a", tier: 3, matched: [], count: 3 }], pools).rolloverOut).toBe(400);
    expect(distribute([{ userId: "a", tier: 5, matched: [], count: 5 }], pools).rolloverOut).toBe(0);
  });
});

describe("runDraw", () => {
  it("is deterministic when the admin publishes the simulated numbers", () => {
    const entries = [{ userId: "a", scores: [1, 2, 3, 4, 5] }];
    const subscribers = [{ plan: "monthly" as const }];
    const r = runDraw({ mode: "random", entries, subscribers, carryIn: 100, fixedNumbers: [1, 2, 3, 4, 5] });
    expect(r.payouts).toHaveLength(1);
    expect(r.payouts[0].tier).toBe(5);
    expect(r.poolBase).toBe(199.6); // 40% of one 499 fee
    expect(r.payouts[0].amount).toBe(179.84); // 40% of 199.6 = 79.84, plus 100 carried over
    expect(r.rolloverOut).toBe(0);
  });
});
