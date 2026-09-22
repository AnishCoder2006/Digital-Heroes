"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CharityPicker } from "@/components/CharityPicker";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config";
import type { Charity } from "@/types/database";

export function SignupForm({ charities, preselected }: { charities: Charity[]; preselected?: string }) {
  const router = useRouter();
  const [charityId, setCharityId] = useState(preselected && charities.some((c) => c.id === preselected) ? preselected : "");
  const [percent, setPercent] = useState(MIN_CHARITY_PERCENT);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!charityId) {
      setError("Choose the charity you want to support.");
      return;
    }
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const { data, error } = await createClient().auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: { data: { full_name: String(f.get("full_name")), charity_id: charityId, charity_percent: percent } },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      router.push("/subscribe");
      router.refresh();
    } else {
      setNotice("Check your inbox to confirm your email, then log in to choose a plan.");
      setBusy(false);
    }
  }

  if (notice) return <p role="status" className="rounded-2xl bg-mint-soft px-5 py-4 font-medium">{notice}</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" required autoComplete="name" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
        </div>
      </div>

      <CharityPicker charities={charities} value={charityId} onChange={setCharityId} percent={percent} onPercent={setPercent} />

      {error && <p role="alert" className="rounded-2xl bg-rose-soft px-4 py-3 text-sm font-medium">{error}</p>}
      <button disabled={busy} className="btn-primary w-full py-4">{busy ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm text-ink-soft">
        At least {MIN_CHARITY_PERCENT}% of your fee goes to charity, up to {MAX_CHARITY_PERCENT}%. Already registered?{" "}
        <Link href="/login" className="font-semibold text-violet hover:underline">Log in</Link>
      </p>
    </form>
  );
}
