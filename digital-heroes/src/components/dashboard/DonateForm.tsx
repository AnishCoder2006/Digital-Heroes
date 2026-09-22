"use client";

import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { loadRazorpay } from "@/components/PlanPicker";
import { Notice } from "@/components/ui";
import { cn, type ActionResult } from "@/lib/utils";
import type { Charity } from "@/types/database";

const PRESETS = [100, 250, 500, 1000];

/** One-off donation. It's separate from the subscription and has nothing to do with the draw. */
export function DonateForm({ charities, defaultCharityId }: { charities: Charity[]; defaultCharityId: string | null }) {
  const [charityId, setCharityId] = useState(defaultCharityId ?? charities[0]?.id ?? "");
  const [amount, setAmount] = useState(250);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function donate() {
    setBusy(true);
    setResult(null);
    try {
      if (!(await loadRazorpay())) throw new Error("Could not load the payment window. Check your connection.");
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charityId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the donation.");

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "Digital Heroes",
        description: "Donation",
        theme: { color: "#5B4BFF" },
        handler: async (response: Record<string, string>) => {
          const v = await fetch("/api/donations/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          setResult(v.ok ? { ok: true, message: "Thank you. Your donation was received." } : { ok: false, message: "Payment went through but we couldn't record it. Contact us with your payment ID." });
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Something went wrong." });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="don-charity">Charity</label>
        <select id="don-charity" value={charityId} onChange={(e) => setCharityId(e.target.value)} className="field max-w-md">
          {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <span className="label">Amount</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setAmount(p)} aria-pressed={amount === p} className={cn("btn btn-sm", amount === p ? "bg-ink text-white" : "bg-mist text-ink-soft hover:bg-mist-deep")}>
              ₹{p}
            </button>
          ))}
          <input type="number" min={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Custom amount in rupees" className="field w-32 py-2" />
        </div>
      </div>
      <button onClick={donate} disabled={busy || !charityId} className="btn-sun"><HeartHandshake size={18} /> {busy ? "Opening payment…" : `Donate ₹${amount}`}</button>
      <Notice result={result} />
    </div>
  );
}
