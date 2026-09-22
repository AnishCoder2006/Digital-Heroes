"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { addScore, deleteScore, updateScore } from "@/app/actions/scores";
import { Notice, NumberBall } from "@/components/ui";
import { ScoreSlots } from "./ScoreSlots";
import { SCORE_MAX, SCORE_MIN, MAX_SCORES } from "@/lib/config";
import { formatDate, type ActionResult } from "@/lib/utils";

type Row = { id: string; score: number; played_on: string };

export function ScoreManager({ scores }: { scores: Row[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.();
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <h2 className="text-xl font-bold">Your entry for the next draw</h2>
        <p className="mt-1 text-ink-soft">
          {scores.length === MAX_SCORES
            ? "You have all five scores. You're in."
            : `Add ${MAX_SCORES - scores.length} more to complete your entry.`}
        </p>
        <div className="mt-6"><ScoreSlots scores={scores} /></div>
      </section>

      <section className="panel">
        <h2 className="text-xl font-bold">Add a score</h2>
        <form
          ref={formRef}
          action={(fd) => run(() => addScore(fd), () => formRef.current?.reset())}
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="score">Stableford score ({SCORE_MIN} to {SCORE_MAX})</label>
            <input id="score" name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} required inputMode="numeric" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="played_on">Date played</label>
            <input id="played_on" name="played_on" type="date" max={today} required className="field" />
          </div>
          <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save score"}</button>
        </form>
        <div className="mt-4"><Notice result={result} /></div>
        <p className="mt-4 text-sm text-ink-faint">One score per date. Adding a sixth replaces your oldest score.</p>
      </section>

      <section className="panel">
        <h2 className="text-xl font-bold">All scores, newest first</h2>
        {scores.length === 0 ? (
          <p className="mt-3 text-ink-soft">No scores yet. Add your latest round above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/5">
            {scores.map((s) =>
              editing === s.id ? (
                <li key={s.id} className="py-3">
                  <form
                    action={(fd) => run(() => updateScore(s.id, fd), () => setEditing(null))}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <div>
                      <label className="label" htmlFor={`s-${s.id}`}>Score</label>
                      <input id={`s-${s.id}`} name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} defaultValue={s.score} required className="field w-28" />
                    </div>
                    <div>
                      <label className="label" htmlFor={`d-${s.id}`}>Date</label>
                      <input id={`d-${s.id}`} name="played_on" type="date" max={today} defaultValue={s.played_on} required className="field" />
                    </div>
                    <button disabled={pending} className="btn-primary btn-sm" aria-label="Save changes"><Check size={16} /> Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-ghost btn-sm" aria-label="Cancel editing"><X size={16} /> Cancel</button>
                  </form>
                </li>
              ) : (
                <li key={s.id} className="flex items-center gap-4 py-3">
                  <NumberBall n={s.score} />
                  <span className="flex-1 font-medium">{formatDate(s.played_on)}</span>
                  <button onClick={() => setEditing(s.id)} className="btn-ghost btn-sm" aria-label={`Edit score from ${formatDate(s.played_on)}`}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    onClick={() => confirm("Delete this score?") && run(() => deleteScore(s.id))}
                    className="btn-danger btn-sm"
                    aria-label={`Delete score from ${formatDate(s.played_on)}`}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
