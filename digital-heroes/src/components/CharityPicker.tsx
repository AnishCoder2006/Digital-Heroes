"use client";

import { Check } from "lucide-react";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Charity } from "@/types/database";

/** Choose a charity and the share of the fee it receives. Used at signup and in settings. */
export function CharityPicker({
  charities,
  value,
  onChange,
  percent,
  onPercent,
}: {
  charities: Charity[];
  value: string;
  onChange: (id: string) => void;
  percent: number;
  onPercent: (n: number) => void;
}) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">Your charity</legend>
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {charities.map((c) => {
            const selected = value === c.id;
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-violet/40",
                  selected ? "bg-violet-soft ring-2 ring-violet" : "bg-white ring-ink/10 hover:bg-mist",
                )}
              >
                <input type="radio" name="charity" className="sr-only" checked={selected} onChange={() => onChange(c.id)} />
                <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", selected ? "bg-violet text-white" : "ring-2 ring-ink/20")}>
                  {selected && <Check size={12} strokeWidth={4} />}
                </span>
                <span>
                  <span className="block font-semibold leading-snug">{c.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{c.tagline}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="percent" className="flex items-baseline justify-between font-semibold text-ink-soft">
          <span>Share of your fee</span>
          <span className="font-display text-2xl font-extrabold text-rose">{percent}%</span>
        </label>
        <input
          id="percent"
          type="range"
          min={MIN_CHARITY_PERCENT}
          max={MAX_CHARITY_PERCENT}
          value={percent}
          onChange={(e) => onPercent(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="flex justify-between text-sm text-ink-faint">
          <span>{MIN_CHARITY_PERCENT}% minimum</span>
          <span>{MAX_CHARITY_PERCENT}%</span>
        </div>
      </div>
    </div>
  );
}
