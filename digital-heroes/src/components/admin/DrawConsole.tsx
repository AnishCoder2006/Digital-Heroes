"use client";

import { useState, useTransition } from "react";
import { Dices, Send } from "lucide-react";
import { publishDraw, simulateDraw, type SimulationResult } from "@/app/admin/actions";
import { Notice, NumberBall, TIER_STYLE } from "@/components/ui";
import { inr2 } from "@/lib/config";
import { cn, type ActionResult } from "@/lib/utils";
import type { DrawMode } from "@/lib/draw";

export function DrawConsole({ defaultMonth }: { defaultMonth: string }) {
  const [mode, setMode] = useState<DrawMode>("random");
  const [month, setMonth] = useState(defaultMonth);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const clear = () => { setSim(null); setNotice(null); };

  function simulate() {
    start(async () => {
      const r = await simulateDraw({ mode, month });
      setNotice({ ok: r.ok, message: r.message });
      setSim(r.result ?? null);
    });
  }

  function publish() {
    if (!sim || !confirm(`Publish the ${month} draw? This can't be undone.`)) return;
    start(async () => {
      const r = await publishDraw({ mode: sim.mode, month, numbers: sim.numbers });
      setNotice(r);
      if (r.ok) setSim(null);
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <h2 className="text-xl font-bold">Configure the draw</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label">Draw logic</span>
            <div className="flex gap-2" role="group" aria-label="Draw logic">
              {(["random", "algorithmic"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); clear(); }} aria-pressed={mode === m} className={cn("btn btn-sm flex-1 capitalize", mode === m ? "bg-ink text-white" : "bg-mist text-ink-soft hover:bg-mist-deep")}>
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {mode === "random" ? "Every number from 1 to 45 has equal odds." : "Numbers players score more often are more likely to be drawn."}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="month">Draw month</label>
            <input id="month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); clear(); }} className="field" />
          </div>
        </div>
        <button onClick={simulate} disabled={pending} className="btn-primary mt-6"><Dices size={18} /> {pending ? "Working…" : "Run simulation"}</button>
        <div className="mt-4"><Notice result={notice} /></div>
      </section>

      {sim && (
        <section className="panel space-y-6 ring-2 ring-violet">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Simulation result</h2>
            <span className="badge bg-marigold-soft">Not published</span>
          </div>

          <div className="flex flex-wrap gap-3">{sim.numbers.map((n) => <NumberBall key={n} n={n} size="lg" tone="ink" />)}</div>

          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["Subscribers with access", String(sim.subscriberCount)],
              ["Entries with 5 scores", String(sim.entryCount)],
              ["Pool this month", inr2(sim.poolBase)],
              ["Jackpot carried in", inr2(sim.carryIn)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-mist p-4"><dt className="text-sm text-ink-soft">{k}</dt><dd className="font-display text-2xl font-extrabold">{v}</dd></div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead className="text-sm text-ink-soft"><tr><th className="py-2 font-semibold">Tier</th><th className="py-2 font-semibold">Pool</th><th className="py-2 font-semibold">Winners</th><th className="py-2 font-semibold">Each</th></tr></thead>
              <tbody className="divide-y divide-ink/5">
                {sim.summaries.map((s) => (
                  <tr key={s.tier}>
                    <td className="py-3"><span className={`badge ${TIER_STYLE[s.tier].bg}`}>{s.tier} matches</span></td>
                    <td className="py-3">{inr2(s.pool)}</td><td className="py-3">{s.winners}</td><td className="py-3">{s.winners ? inr2(s.each) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sim.rolloverOut > 0 && <p className="rounded-2xl bg-marigold-soft px-4 py-3 font-medium">No 5-match winner. {inr2(sim.rolloverOut)} rolls over to next month&apos;s jackpot.</p>}
          {sim.winners.length > 0 && (
            <ul className="space-y-1">{sim.winners.map((w, i) => <li key={i} className="flex justify-between rounded-xl bg-mist px-4 py-2"><span className="font-medium">{w.name}</span><span>{w.tier} matches, {inr2(w.amount)}</span></li>)}</ul>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={publish} disabled={pending} className="btn-dark"><Send size={18} /> Publish results</button>
            <button onClick={simulate} disabled={pending} className="btn-ghost">Simulate again</button>
          </div>
        </section>
      )}
    </div>
  );
}
