import type { Metadata } from "next";
import { EmptyState, NumberBall, PageTitle, StatusPill, TIER_STYLE } from "@/components/ui";
import { ProofUploader } from "@/components/dashboard/ProofUploader";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr2 } from "@/lib/config";
import { formatMonth } from "@/lib/utils";
import type { Draw, Winner } from "@/types/database";

export const metadata: Metadata = { title: "Winnings" };

function state(w: Winner) {
  if (w.payment_status === "paid") return { tone: "good" as const, label: "Paid", note: "This prize has been paid out." };
  if (w.verification_status === "approved")
    return { tone: "warn" as const, label: "Approved, payment pending", note: "Your proof is approved. Payment is on its way." };
  if (w.verification_status === "rejected")
    return { tone: "bad" as const, label: "Proof rejected", note: "We couldn't verify that screenshot. Upload a new one." };
  if (w.proof_path) return { tone: "neutral" as const, label: "Under review", note: "We're checking your proof." };
  return { tone: "warn" as const, label: "Proof needed", note: "Upload your proof to claim this prize." };
}

export default async function WinningsPage() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("winners").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const winners = (data ?? []) as Winner[];
  const { data: drawRows } = winners.length
    ? await supabase.from("draws").select("id, month").in("id", winners.map((w) => w.draw_id))
    : { data: [] };
  const monthOf = new Map(((drawRows ?? []) as Pick<Draw, "id" | "month">[]).map((d) => [d.id, d.month]));

  const total = winners.reduce((s, w) => s + Number(w.prize_amount), 0);
  const paid = winners.filter((w) => w.payment_status === "paid").reduce((s, w) => s + Number(w.prize_amount), 0);

  return (
    <div>
      <PageTitle title="Your winnings">Prizes you&apos;ve won, and where each one is in the payment process.</PageTitle>

      {winners.length === 0 ? (
        <EmptyState title="No wins yet" body="Match three, four or five numbers in a monthly draw and your prize shows up here." href="/dashboard/scores" cta="Check your scores" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-panel bg-ink p-6 text-white"><p className="text-white/70">Total won</p><p className="mt-1 font-display text-4xl font-extrabold text-marigold">{inr2(total)}</p></div>
            <div className="rounded-panel bg-mint-soft p-6"><p className="text-ink-soft">Paid</p><p className="mt-1 font-display text-4xl font-extrabold">{inr2(paid)}</p></div>
            <div className="rounded-panel bg-marigold-soft p-6"><p className="text-ink-soft">Still to come</p><p className="mt-1 font-display text-4xl font-extrabold">{inr2(total - paid)}</p></div>
          </div>

          <div className="space-y-4">
            {winners.map((w) => {
              const s = state(w);
              const needsProof = w.payment_status !== "paid" && w.verification_status !== "approved" && (!w.proof_path || w.verification_status === "rejected");
              return (
                <article key={w.id} className="panel">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-soft">{monthOf.get(w.draw_id) ? formatMonth(monthOf.get(w.draw_id)!) : "Draw"}</p>
                      <p className="font-display text-4xl font-extrabold">{inr2(Number(w.prize_amount))}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`badge ${TIER_STYLE[w.tier].bg}`}>{w.tier} matches</span>
                      <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{w.matched_numbers.map((n) => <NumberBall key={n} n={n} size="sm" tone="sun" />)}</div>
                  <p className="mt-4 text-ink-soft">{s.note}</p>
                  {needsProof && <ProofUploader winnerId={w.id} resubmit={w.verification_status === "rejected"} />}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
