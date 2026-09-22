"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PLANS, inr, type PlanKey } from "@/lib/config";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any;
  }
}

/** Loads Razorpay's checkout script once. */
export function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PlanPicker({ initial, charityName, percent }: { initial: PlanKey; charityName: string; percent: number }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanKey>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yearlySaving = PLANS.monthly.priceInr * 12 - PLANS.yearly.priceInr;

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      if (!(await loadRazorpay())) throw new Error("Could not load the payment window. Check your connection and try again.");

      const res = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "Digital Heroes",
        description: `${PLANS[plan].label} plan (one ${PLANS[plan].interval})`,
        prefill: { email: data.email },
        theme: { color: "#5B4BFF" },
        handler: async (response: Record<string, string>) => {
          const v = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (!v.ok) {
            setError("Your payment went through but we couldn't confirm it yet. Refresh in a minute. If it's still locked, contact us.");
            setBusy(false);
            return;
          }
          router.push("/dashboard?welcome=1");
          router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => {
        setError("The payment didn't go through. Try again or use a different method.");
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2" role="radiogroup" aria-label="Plan">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => {
          const selected = plan === k;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(k)}
              className={cn(
                "relative rounded-panel p-7 text-left transition",
                selected ? "bg-violet text-white shadow-lift" : "bg-white ring-1 ring-ink/10 hover:ring-violet",
              )}
            >
              {k === "yearly" && <span className="badge absolute right-5 top-5 bg-marigold text-ink">Save {inr(yearlySaving)}</span>}
              <span className="text-xl font-bold">{PLANS[k].label}</span>
              <span className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-5xl font-extrabold">{inr(PLANS[k].priceInr)}</span>
                <span className={selected ? "text-white/70" : "text-ink-soft"}>per {PLANS[k].interval}</span>
              </span>
              <span className={cn("mt-4 flex items-center gap-2 text-sm", selected ? "text-white/85" : "text-ink-soft")}>
                <Check size={16} /> {percent}% of your fee goes to {charityName}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-rose-soft px-4 py-3 text-sm font-medium">{error}</p>}
      <button onClick={checkout} disabled={busy} className="btn-primary mt-6 w-full py-4 text-lg sm:w-auto sm:px-12">
        {busy ? "Opening payment…" : `Subscribe ${plan === "monthly" ? "monthly" : "yearly"} for ${inr(PLANS[plan].priceInr)}`}
      </button>
      <p className="mt-3 text-sm text-ink-faint">Payments are handled securely by Razorpay in test mode, so no real money moves. Each payment covers one {plan === "monthly" ? "month" : "year"}, and you can renew from your dashboard.</p>
    </div>
  );
}
