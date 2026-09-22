"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { uploadProof } from "@/app/actions/winners";
import { Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/utils";

export function ProofUploader({ winnerId, resubmit }: { winnerId: string; resubmit?: boolean }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form action={(fd) => start(async () => setResult(await uploadProof(winnerId, fd)))} className="mt-4 space-y-3">
      <label className="label" htmlFor={`proof-${winnerId}`}>
        {resubmit ? "Upload a new screenshot of your scores" : "Upload a screenshot of your scores from your golf platform"}
      </label>
      <input
        id={`proof-${winnerId}`}
        name="proof"
        type="file"
        accept="image/*"
        required
        className="field file:mr-4 file:rounded-full file:border-0 file:bg-violet file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      <button disabled={pending} className="btn-primary btn-sm">
        <Upload size={16} /> {pending ? "Uploading…" : "Submit proof"}
      </button>
      <Notice result={result} />
    </form>
  );
}
