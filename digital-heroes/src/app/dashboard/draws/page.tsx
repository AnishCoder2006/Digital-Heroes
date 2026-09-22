import type { Metadata } from "next";
import { NumberBall, PageTitle, EmptyState, StatusPill, TIER_STYLE } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, hasAccess } from "@/lib/subscription";
import { getUpcomingPool } from "@/lib/pool";
import { MAX_SCORES, TIER_SHARES, inr } from "@/lib/config";
import { formatMonth, monthStart, nextMonthStart } from "@/lib/utils";
import type { Draw, DrawEntry } from "@/types/database";

export const metadata: Metadata = { title: "Draws" };

export default async function DrawsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [sub, scoreCount, entriesRes, thisMonth, pool] = await Promise.all([
    getSubscription(supabase, user.id),
    supabase.from("scores").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("draw_entries").select("*").eq("user_id", user.id),
    supabase.from("draws").select("id").eq("month", monthStart()).maybeSingle(),
    getUpcomingPool(),
  ]);

  const entries = (entriesRes.data ?? []) as DrawEntry[];
  const { data: drawRows } = entries.length
    ? await supabase.from("draws").select("*").in("id", entries.map((e) => e.draw_id)).order("month", { ascending: false })
    : { data: [] };
  const draws = (drawRows ?? []) as Draw[];

  const active = hasAccess(sub);
  const ready = active && (scoreCount.count ?? 0) >= MAX_SCORES;
  const drawMonth = thisMonth.data ? nextMonthStart() : new Date();
  const jackpot = pool.base * TIER_SHARES[5] + pool.carryover;

  return (
    <div className="space-y-6">
      <PageTitle title="Draws">See what you&apos;re entered in and how past draws went.</PageTitle>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Next draw: {formatMonth(drawMonth.toISOString())}</h2>
          <StatusPill tone={ready ? "good" : "warn"}>{ready ? "You're entered" : "Not entered yet"}</StatusPill>
        </div>
        {!ready && (
          <p className="mt-3 text-ink-soft">
            {active ? `Add all ${MAX_SCORES} scores to enter.` : "Subscribe and add five scores to enter."}
          </p>
        )}
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-marigold-soft p-5">
            <dt className="text-sm font-semibold">Jackpot so far</dt>
            <dd className="mt-1 font-display text-3xl font-extrabold">{inr(jackpot)}</dd>
            {pool.carryover > 0 && <dd className="mt-1 text-sm">includes {inr(pool.carryover)} rolled over</dd>}
          </div>
          <div className="rounded-2xl bg-mint-soft p-5">
            <dt className="text-sm font-semibold">Four-match prize pool</dt>
            <dd className="mt-1 font-display text-3xl font-extrabold">{inr(pool.base * TIER_SHARES[4])}</dd>
          </div>
          <div className="rounded-2xl bg-rose-soft p-5">
            <dt className="text-sm font-semibold">Three-match prize pool</dt>
            <dd className="mt-1 font-display text-3xl font-extrabold">{inr(pool.base * TIER_SHARES[3])}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-faint">Based on {pool.subscribers} active subscriber{pool.subscribers === 1 ? "" : "s"}. Amounts are shared equally between winners in each tier.</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Draws you&apos;ve entered</h2>
        {draws.length === 0 ? (
          <EmptyState title="No draws yet" body="Once the admin publishes a draw you're entered in, it shows up here with your result." />
        ) : (
          <div className="space-y-4">
            {draws.map((d) => {
              const entry = entries.find((e) => e.draw_id === d.id)!;
              const tier = entry.matched_count >= 3 ? (entry.matched_count as 3 | 4 | 5) : null;
              return (
                <article key={d.id} className="panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">{formatMonth(d.month)}</h3>
                    {tier ? <span className={`badge ${TIER_STYLE[tier].bg}`}>{entry.matched_count} matches, you won</span> : <StatusPill tone="neutral">No prize</StatusPill>}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-ink-soft">Winning numbers</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.winning_numbers.map((n) => <NumberBall key={n} n={n} tone={entry.scores.includes(n) ? "sun" : "ink"} />)}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-ink-soft">Your scores</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.scores.map((n, i) => <NumberBall key={i} n={n} size="sm" tone={d.winning_numbers.includes(n) ? "sun" : "plain"} />)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
