"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/account";
import { CharityPicker } from "@/components/CharityPicker";
import { Notice } from "@/components/ui";
import { feeBreakdown } from "@/lib/charity";
import { inr } from "@/lib/config";
import type { PlanKey } from "@/lib/config";
import type { ActionResult } from "@/lib/utils";
import type { Charity } from "@/types/database";

export function ProfileForm({
  charities,
  fullName,
  charityId,
  percent,
  plan,
}: {
  charities: Charity[];
  fullName: string;
  charityId: string | null;
  percent: number;
  plan: PlanKey;
}) {
  const [charity, setCharity] = useState(charityId ?? "");
  const [share, setShare] = useState(percent);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        fd.set("charity_id", charity);
        fd.set("charity_percent", String(share));
        start(async () => setResult(await updateProfile(fd)));
      }}
      className="space-y-6"
    >
      <div>
        <label className="label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" defaultValue={fullName} required className="field max-w-md" />
      </div>
      <CharityPicker charities={charities} value={charity} onChange={setCharity} percent={share} onPercent={setShare} />
      <p className="rounded-2xl bg-rose-soft px-4 py-3 font-medium">
        About {inr(feeBreakdown(plan, share).charity)} a month goes to your charity.
      </p>
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save changes"}</button>
      <Notice result={result} />
    </form>
  );
}
