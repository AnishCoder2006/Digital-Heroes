"use client";

import { useState, useTransition } from "react";
import { cancelSubscription } from "@/app/actions/account";
import { Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/utils";

export function CancelButton() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button
        disabled={pending}
        onClick={() => confirm("Cancel your subscription? You keep access until your renewal date.") && start(async () => setResult(await cancelSubscription()))}
        className="btn-danger"
      >
        {pending ? "Cancelling…" : "Cancel subscription"}
      </button>
      <Notice result={result} />
    </div>
  );
}
