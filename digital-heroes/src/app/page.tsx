import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { SplitCalculator } from "@/components/home/SplitCalculator";
import { CharityCard } from "@/components/CharityCard";
import { createClient } from "@/lib/supabase/server";
import { PLANS, TIERS, inr } from "@/lib/config";
import { TIER_STYLE } from "@/components/ui";
import type { Charity } from "@/types/database";
import { Check } from "lucide-react";

const STEPS = [
  {
    title: "Subscribe and pick a cause",
    body: "Choose monthly or yearly, then choose the charity that gets your share. You can change it later.",
    tone: "bg-violet text-white",
  },
  {
    title: "Log your last five rounds",
    body: "Enter your Stableford scores, from 1 to 45. We keep your latest five and swap out the oldest.",
    tone: "bg-marigold text-ink",
  },
  {
    title: "Match the monthly draw",
    body: "Five numbers are drawn each month. Match three, four or five of your scores and you share a prize.",
    tone: "bg-mint text-ink",
  },
];

const TIER_BAR_HEIGHT = { 5: "h-56", 4: "h-48", 3: "h-36" } as const;
const TIER_NOTE = {
  5: "Rolls over to next month if nobody wins",
  4: "Split equally between winners",
  3: "Split equally between winners",
} as const;

export default async function HomePage() {
  const { data } = await (await createClient()).from("charities").select("*").eq("featured", true).limit(3);
  const featured = (data ?? []) as Charity[];
  const yearlySaving = PLANS.monthly.priceInr * 12 - PLANS.yearly.priceInr;

  return (
    <>
      <Hero />

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Three steps, then the draw does the rest.</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`rounded-panel p-7 ${s.tone} ${i === 1 ? "md:translate-y-6" : ""}`}>
              <span className="font-display text-6xl font-extrabold opacity-60">{i + 1}</span>
              <h3 className="mt-6 text-2xl font-bold leading-tight">{s.title}</h3>
              <p className="mt-3 opacity-90">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Split calculator */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SplitCalculator />
      </section>

      {/* Prize tiers */}
      <section className="px-3 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-blob bg-ink px-6 py-14 text-white sm:px-12">
          <h2 className="max-w-xl text-4xl font-extrabold leading-tight sm:text-5xl">Three ways to win, every month.</h2>
          <p className="mt-4 max-w-xl text-lg text-white/70">
            The pool grows with every subscriber. If nobody matches all five, the jackpot carries forward and keeps growing.
          </p>
          <div className="mt-12 grid grid-cols-3 items-end gap-3 sm:gap-6">
            {TIERS.map((t) => (
              <div key={t} className="flex flex-col">
                <div className={`${TIER_BAR_HEIGHT[t]} ${TIER_STYLE[t].bg} flex flex-col justify-end rounded-t-[2rem] rounded-b-xl p-4 text-ink sm:p-6`}>
                  <span className="font-display text-5xl font-extrabold sm:text-7xl">{TIER_STYLE[t].share}</span>
                  <span className="mt-1 text-sm font-semibold sm:text-base">of the pool</span>
                </div>
                <h3 className="mt-4 text-lg font-bold sm:text-2xl">{t} matches</h3>
                <p className="mt-1 text-sm text-white/60">{TIER_NOTE[t]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured charities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-4xl font-extrabold leading-tight sm:text-5xl">Causes our players are backing.</h2>
            <Link href="/charities" className="btn-ghost">
              Browse all charities
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {featured.map((c) => (
              <CharityCard key={c.id} charity={c} />
            ))}
          </div>
        </section>
      )}

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
        <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">Pick a plan.</h2>
        <p className="mt-3 text-lg text-ink-soft">Both plans include the draw, the score tracker and your charity share.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {(["monthly", "yearly"] as const).map((k) => {
            const yearly = k === "yearly";
            return (
              <div key={k} className={`relative rounded-panel p-8 ${yearly ? "bg-violet text-white shadow-lift" : "bg-white ring-1 ring-ink/5"}`}>
                {yearly && <span className="badge absolute right-6 top-6 bg-marigold text-ink">Save {inr(yearlySaving)}</span>}
                <h3 className="text-2xl font-bold">{PLANS[k].label}</h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-extrabold">{inr(PLANS[k].priceInr)}</span>
                  <span className={yearly ? "text-white/70" : "text-ink-soft"}>per {PLANS[k].interval}</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {["Entry into every monthly draw", "Score tracker for your latest five rounds", "10% to 50% of your fee to a charity you pick"].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check size={20} className="mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/subscribe?plan=${k}`} className={`mt-8 w-full ${yearly ? "btn-sun" : "btn-primary"}`}>
                  Choose {k}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="relative overflow-hidden rounded-blob bg-rose p-10 sm:p-16">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-marigold" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <h2 className="text-4xl font-extrabold leading-tight sm:text-6xl">Your next round can help someone.</h2>
            <Link href="/signup" className="btn-dark mt-8 px-8 py-4 text-lg">
              Create your account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
