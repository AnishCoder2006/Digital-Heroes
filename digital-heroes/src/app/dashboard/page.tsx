import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Heart, Wallet } from "lucide-react";
import { PageTitle, StatusPill } from "@/components/ui";
import { ScoreSlots } from "@/components/dashboard/ScoreSlots";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, hasAccess, statusLabel } from "@/lib/subscription";
import { feeBreakdown } from "@/lib/charity";
import { MAX_SCORES, PLANS, inr, inr2 } from "@/lib/config";
import { formatDate, formatMonth, monthStart, nextMonthStart } from "@/lib/utils";
import type { Score, Winner } from "@/types/database";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireUser();
  const supabase = await createClient();

  const [sub, scoresRes, charityRes, entriesRes, winnersRes, thisMonthRes] = await Promise.all([
    getSubscription(supabase, user.id),
    supabase.from("scores").select("*").eq("user_id", user.id).order("played_on", { ascending: false }),
    profile.charity_id ? supabase.from("charities").select("name").eq("id", profile.charity_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("draw_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("winners").select("*").eq("user_id", user.id),
    supabase.from("draws").select("id").eq("month", monthStart()).maybeSingle(),
  ]);

  const scores = (scoresRes.data ?? []) as Score[];
  const winners = (winnersRes.data ?? []) as Winner[];
  const active = hasAccess(sub);
  const nextDraw = thisMonthRes.data ? nextMonthStart() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const missing = MAX_SCORES - scores.length;

  const totalWon = winners.reduce((s, w) => s + Number(w.prize_amount), 0);
  const paid = winners.filter((w) => w.payment_status === "paid").reduce((s, w) => s + Number(w.prize_amount), 0);
  const monthlyCharity = feeBreakdown(sub?.plan ?? "monthly", profile.charity_percent).charity;

  return (
    <div className="space-y-6">
      <PageTitle title="Your overview" />

      {sp.welcome && (
        <div className="rounded-panel bg-marigold p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold">You&apos;re in. Welcome to Digital Heroes.</h2>
          <p className="mt-1">Add your last five scores to enter this month&apos;s draw.</p>
          <Link href="/dashboard/scores" className="btn-dark mt-4">Add scores</Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Wallet size={20} /> Subscription</h2>
            <StatusPill tone={active ? "good" : sub?.status === "lapsed" ? "bad" : "neutral"}>
              {active ? (sub?.status === "cancelled" ? "Ending" : "Active") : "Inactive"}
            </StatusPill>
          </div>
          {sub && active ? (
            <dl className="mt-5 space-y-2">
              <div className="flex justify-between"><dt className="text-ink-soft">Plan</dt><dd className="font-semibold">{PLANS[sub.plan].label}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Status</dt><dd className="font-semibold">{statusLabel[sub.status]}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Paid until</dt><dd className="font-semibold">{formatDate(sub.renewal_date)}</dd></div>
            </dl>
          ) : (
            <>
              <p className="mt-4 text-ink-soft">
                {sub?.status === "lapsed" ? "Your last payment didn't go through." : "You don't have an active plan yet."} Subscribe to log scores and join the monthly draw.
              </p>
              <Link href="/subscribe" className="btn-primary mt-5">See plans</Link>
            </>
          )}
        </section>

        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Heart size={20} /> Your charity</h2>
          <p className="mt-5 font-display text-3xl font-extrabold leading-tight">{charityRes.data?.name ?? "Not chosen yet"}</p>
          <p className="mt-2 text-ink-soft">
            {profile.charity_percent}% of your fee, about <strong className="text-ink">{inr(monthlyCharity)}</strong> a month.
          </p>
          <Link href="/dashboard/settings" className="btn-ghost btn-sm mt-5">Change charity or share</Link>
        </section>
      </div>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Your five scores</h2>
          <Link href="/dashboard/scores" className="btn-ghost btn-sm">Add or edit</Link>
        </div>
        <div className="mt-6">
          <ScoreSlots scores={scores} />
        </div>
        {active && missing > 0 && (
          <p className="mt-5 rounded-2xl bg-marigold-soft px-4 py-3 font-medium">
            Add {missing} more score{missing > 1 ? "s" : ""} to enter this month&apos;s draw.
          </p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarClock size={20} /> Draws</h2>
          <dl className="mt-5 space-y-2">
            <div className="flex justify-between"><dt className="text-ink-soft">Draws entered</dt><dd className="font-semibold">{entriesRes.count ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Upcoming draw</dt><dd className="font-semibold">{formatMonth(nextDraw.toISOString())}</dd></div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Your entry</dt>
              <dd className="font-semibold">{active && missing <= 0 ? "Ready" : "Not ready"}</dd>
            </div>
          </dl>
          <Link href="/dashboard/draws" className="btn-ghost btn-sm mt-5">Draw history</Link>
        </section>

        <section className="panel bg-ink text-white">
          <h2 className="text-xl font-bold">Winnings</h2>
          <p className="mt-4 font-display text-5xl font-extrabold text-marigold">{inr2(totalWon)}</p>
          <p className="mt-1 text-white/70">
            {winners.length === 0 ? "No wins yet. Every month is a fresh draw." : `${inr2(paid)} paid, ${inr2(totalWon - paid)} still to come`}
          </p>
          {winners.length > 0 && <Link href="/dashboard/winnings" className="btn-sun btn-sm mt-5">View winnings</Link>}
        </section>
      </div>
    </div>
  );
}