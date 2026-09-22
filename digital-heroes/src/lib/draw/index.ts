import type { PlanKey } from "../config";
import { buildFrequencies, randomDraw, weightedDraw, type Rng } from "./generate";
import { findWinners, type Entry } from "./match";
import { calculateTierPools, distribute, monthlyPoolBase } from "./prizes";

export type DrawMode = "random" | "algorithmic";

export type DrawInput = {
  mode: DrawMode;
  entries: Entry[]; // subscribers who have a full set of scores
  subscribers: { plan: PlanKey }[]; // every subscriber with access (funds the pool)
  carryIn: number;
  rng?: Rng;
  /** When publishing, the admin passes the numbers they simulated so the result is identical. */
  fixedNumbers?: number[];
};

/** Pure function: same inputs -> same result. Used for both simulate and publish. */
export function runDraw(input: DrawInput) {
  const { mode, entries, subscribers, carryIn, rng = Math.random, fixedNumbers } = input;
  const numbers =
    fixedNumbers ??
    (mode === "random"
      ? randomDraw(rng)
      : weightedDraw(buildFrequencies(entries.flatMap((e) => e.scores)), rng));

  const poolBase = monthlyPoolBase(subscribers);
  const pools = calculateTierPools(poolBase, carryIn);
  const winners = findWinners(entries, numbers);
  const { payouts, summaries, rolloverOut } = distribute(winners, pools);

  return { numbers, poolBase, pools, winners, payouts, summaries, rolloverOut, entryCount: entries.length };
}
