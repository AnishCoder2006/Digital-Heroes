"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { getProofUrl, markPaid, reviewWinner } from "@/app/admin/actions";
import { Notice, StatusPill, TIER_STYLE } from "@/components/ui";
import { inr2 } from "@/lib/config";
import { cn, type ActionResult } from "@/lib/utils";

export type WinnerRow = {
  id: string;
  name: string;
  month: string;
  tier: 3 | 4 | 5;
  amount: number;
  proofPath: string | null;
  verification: "pending" | "approved" | "rejected";
  payment: "pending" | "paid";
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "payout", label: "Ready to pay" },
  { key: "paid", label: "Paid" },
] as const;

export function WinnersTable({ rows }: { rows: WinnerRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const shown = rows.filter((r) => {
    if (filter === "review") return r.verification === "pending" && !!r.proofPath;
    if (filter === "payout") return r.verification === "approved" && r.payment === "pending";
    if (filter === "paid") return r.payment === "paid";
    return true;
  });

  const run = (fn: () => Promise<ActionResult>) => start(async () => setNotice(await fn()));

  async function viewProof(path: string) {
    const url = await getProofUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else setNotice({ ok: false, message: "Could not open the proof image." });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter winners">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={cn("btn btn-sm", filter === f.key ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-ink/10 hover:bg-mist-deep")}>
            {f.label}
          </button>
        ))}
      </div>
      <Notice result={notice} />

      <div className="panel overflow-x-auto !p-0">
        <table className="w-full min-w-[46rem] text-left">
          <thead className="bg-mist text-sm text-ink-soft">
            <tr><th className="px-5 py-3 font-semibold">Winner</th><th className="px-5 py-3 font-semibold">Prize</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-4">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-ink-soft">{new Date(r.month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`badge ${TIER_STYLE[r.tier].bg}`}>{r.tier} matches</span>
                  <p className="mt-1 font-display text-xl font-bold">{inr2(r.amount)}</p>
                </td>
                <td className="px-5 py-4 space-y-1">
                  <StatusPill tone={r.verification === "approved" ? "good" : r.verification === "rejected" ? "bad" : "neutral"}>
                    {r.verification === "pending" ? (r.proofPath ? "Proof to review" : "Waiting for proof") : r.verification === "approved" ? "Approved" : "Rejected"}
                  </StatusPill>
                  <div><StatusPill tone={r.payment === "paid" ? "good" : "warn"}>{r.payment === "paid" ? "Paid" : "Payment pending"}</StatusPill></div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {r.proofPath && <button onClick={() => viewProof(r.proofPath!)} className="btn-ghost btn-sm"><ExternalLink size={14} /> View proof</button>}
                    {r.verification === "pending" && r.proofPath && (
                      <>
                        <button disabled={pending} onClick={() => run(() => reviewWinner(r.id, "approve"))} className="btn-primary btn-sm"><Check size={14} /> Approve</button>
                        <button disabled={pending} onClick={() => run(() => reviewWinner(r.id, "reject"))} className="btn-danger btn-sm"><X size={14} /> Reject</button>
                      </>
                    )}
                    {r.verification === "approved" && r.payment === "pending" && (
                      <button disabled={pending} onClick={() => confirm(`Mark ${inr2(r.amount)} as paid to ${r.name}?`) && run(() => markPaid(r.id))} className="btn-sun btn-sm">Mark as paid</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-ink-soft">Nothing here. Winners appear after a draw is published.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
