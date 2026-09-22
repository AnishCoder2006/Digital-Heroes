"use client";

import { useState } from "react";
import { feeBreakdown } from "@/lib/charity";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT, PLANS, inr, type PlanKey } from "@/lib/config";
import { cn } from "@/lib/utils";

export function SplitCalculator() {
  const [percent, setPercent] = useState(20);
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const b = feeBreakdown(plan, percent);
  const pct = (n: number) => `${(n / b.fee) * 100}%`;

  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">You decide how much goes to charity.</h2>
        <p className="mt-5 max-w-md text-lg text-ink-soft">
          A fixed 40% of every fee funds the monthly prize pool. Charities get at least 10%, and you can give up to{" "}
          {MAX_CHARITY_PERCENT}%. Slide to see it.
        </p>
      </div>

      <div className="rounded-panel bg-white p-6 shadow-sm ring-1 ring-ink/5 sm:p-8">
        <div className="flex gap-2" role="group" aria-label="Plan">
          {(Object.keys(PLANS) as PlanKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setPlan(k)}
              aria-pressed={plan === k}
              className={cn("btn btn-sm flex-1", plan === k ? "bg-ink text-white" : "bg-mist text-ink-soft hover:bg-mist-deep")}
            >
              {PLANS[k].label}
            </button>
          ))}
        </div>

        <label htmlFor="split" className="mt-6 flex items-baseline justify-between font-semibold">
          <span>Your charity share</span>
          <span className="font-display text-3xl font-extrabold text-rose">{percent}%</span>
        </label>
        <input
          id="split"
          type="range"
          min={MIN_CHARITY_PERCENT}
          max={MAX_CHARITY_PERCENT}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="mt-2 w-full"
        />

        <div className="mt-6 flex h-14 overflow-hidden rounded-full bg-mist-deep" role="img" aria-label="How a monthly fee is split">
          <div className="bg-rose transition-[width] duration-300" style={{ width: pct(b.charity) }} />
          <div className="bg-marigold transition-[width] duration-300" style={{ width: pct(b.pool) }} />
          <div className="bg-violet-soft transition-[width] duration-300" style={{ width: pct(b.platform) }} />
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-2 text-ink-soft"><span className="h-3 w-3 rounded-full bg-rose" />Charity</dt>
            <dd className="font-display text-xl font-bold">{inr(b.charity)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-ink-soft"><span className="h-3 w-3 rounded-full bg-marigold" />Prize pool</dt>
            <dd className="font-display text-xl font-bold">{inr(b.pool)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-ink-soft"><span className="h-3 w-3 rounded-full bg-violet-soft" />Running costs</dt>
            <dd className="font-display text-xl font-bold">{inr(b.platform)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-faint">Per month{plan === "yearly" ? ", based on the yearly price divided by 12" : ""}.</p>
      </div>
    </div>
  );
}
