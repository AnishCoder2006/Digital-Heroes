import type { Metadata } from "next";
import Link from "next/link";
import { NumberBall, PageTitle, TIER_STYLE } from "@/components/ui";
import { PLANS, POOL_PERCENT, TIERS, TIER_SHARES, inr } from "@/lib/config";

export const metadata: Metadata = { title: "How the draw works" };

const EXAMPLE_SUBSCRIBERS = 100;

const RULES = [
  { q: "Which scores count?", a: "Your latest five Stableford scores, each from 1 to 45. Every score needs the date you played, and you can log one score per date." },
  { q: "What happens when I add a sixth score?", a: "The oldest one drops off automatically, so your entry always reflects your five most recent rounds." },
  { q: "How is a match counted?", a: "A match is one of your scores that also appears in the five drawn numbers. Order doesn't matter." },
  { q: "Random or weighted?", a: "Each month the draw runs in one of two modes. Random gives every number equal odds. Weighted makes numbers that players score more often more likely to come up." },
  { q: "What if nobody wins the jackpot?", a: "The 40% jackpot share carries forward into next month's jackpot. Unclaimed 4-match and 3-match shares don't roll over." },
  { q: "How do I get paid?", a: "Upload a screenshot of your scores from your golf platform. We review it, approve it, then mark your prize as paid." },
];

export default function HowItWorksPage() {
  const pool = EXAMPLE_SUBSCRIBERS * PLANS.monthly.priceInr * (POOL_PERCENT / 100);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <PageTitle title="How the draw works">
        No tricks. Your scores are your ticket, the pool comes from subscriptions, and the split is the same every month.
      </PageTitle>

      <section className="grid gap-8 rounded-blob bg-white p-8 shadow-sm ring-1 ring-ink/5 sm:p-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold">Your ticket</h2>
          <p className="mt-3 text-lg text-ink-soft">These are your five latest scores. They&apos;re your entry for the month.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[22, 27, 31, 34, 38].map((n) => (
              <NumberBall key={n} n={n} tone={n === 27 || n === 34 || n === 38 ? "sun" : "plain"} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold">The draw</h2>
          <p className="mt-3 text-lg text-ink-soft">Five numbers are drawn. Here, 27, 34 and 38 match, which is three matches.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[9, 27, 34, 38, 41].map((n) => (
              <NumberBall key={n} n={n} tone={n === 27 || n === 34 || n === 38 ? "sun" : "ink"} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-3xl font-extrabold">Where the prize money comes from</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          {POOL_PERCENT}% of every subscription goes into the pool. With {EXAMPLE_SUBSCRIBERS} monthly subscribers, that&apos;s{" "}
          <strong className="text-ink">{inr(pool)}</strong> to share out.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t} className={`rounded-panel p-6 ${TIER_STYLE[t].bg}`}>
              <p className="font-semibold">{t} matches</p>
              <p className="mt-2 font-display text-5xl font-extrabold">{inr(pool * TIER_SHARES[t])}</p>
              <p className="mt-2 text-sm font-medium">
                {Math.round(TIER_SHARES[t] * 100)}% of the pool, split equally between winners in the tier
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-3xl font-extrabold">The rules</h2>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {RULES.map((r) => (
            <div key={r.q} className="rounded-panel bg-white p-6 ring-1 ring-ink/5">
              <dt className="text-lg font-bold">{r.q}</dt>
              <dd className="mt-2 text-ink-soft">{r.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-14 text-center">
        <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
          Start giving
        </Link>
      </div>
    </div>
  );
}
