"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import { adminDeleteScore, adminSaveScore, updateUser } from "@/app/admin/actions";
import { Notice, NumberBall, StatusPill } from "@/components/ui";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT, SCORE_MAX, SCORE_MIN } from "@/lib/config";
import { cn, formatDate, type ActionResult } from "@/lib/utils";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "subscriber" | "admin";
  charityName: string;
  charityPercent: number;
  sub: { plan: "monthly" | "yearly"; status: string; renewal: string | null } | null;
  scores: { id: string; score: number; played_on: string }[];
};

function UserPanel({ user }: { user: UserRow }) {
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [editScore, setEditScore] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setNotice(r);
      if (r.ok) after?.();
    });

  return (
    <div className="grid gap-8 bg-mist/60 p-5 lg:grid-cols-2">
      <form action={(fd) => run(() => updateUser(user.id, fd))} className="space-y-4">
        <h3 className="font-bold">Profile and subscription</h3>
        <div><label className="label" htmlFor={`n-${user.id}`}>Name</label><input id={`n-${user.id}`} name="full_name" defaultValue={user.name} className="field" /></div>
        <div>
          <label className="label" htmlFor={`p-${user.id}`}>Charity share ({MIN_CHARITY_PERCENT} to {MAX_CHARITY_PERCENT}%)</label>
          <input id={`p-${user.id}`} name="charity_percent" type="number" min={MIN_CHARITY_PERCENT} max={MAX_CHARITY_PERCENT} defaultValue={user.charityPercent} className="field" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={`st-${user.id}`}>Status</label>
            <select id={`st-${user.id}`} name="sub_status" defaultValue={user.sub?.status ?? ""} className="field">
              <option value="">No change</option>
              {["active", "cancelled", "lapsed", "expired", "pending"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`pl-${user.id}`}>Plan</label>
            <select id={`pl-${user.id}`} name="sub_plan" defaultValue={user.sub?.plan ?? "monthly"} className="field">
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`rn-${user.id}`}>Renews on</label>
            <input id={`rn-${user.id}`} name="sub_renewal" type="date" defaultValue={user.sub?.renewal?.slice(0, 10) ?? ""} className="field" />
          </div>
        </div>
        <button disabled={pending} className="btn-primary btn-sm">Save user</button>
      </form>

      <div>
        <h3 className="font-bold">Golf scores</h3>
        <ul className="mt-3 divide-y divide-ink/5 rounded-2xl bg-white px-4">
          {user.scores.map((s) =>
            editScore === s.id ? (
              <li key={s.id} className="py-3">
                <form action={(fd) => run(() => adminSaveScore(s.id, user.id, fd), () => setEditScore(null))} className="flex flex-wrap items-end gap-2">
                  <input name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} defaultValue={s.score} aria-label="Score" className="field w-24 py-2" />
                  <input name="played_on" type="date" defaultValue={s.played_on} aria-label="Date played" className="field w-44 py-2" />
                  <button className="btn-primary btn-sm">Save</button>
                  <button type="button" onClick={() => setEditScore(null)} className="btn-ghost btn-sm">Cancel</button>
                </form>
              </li>
            ) : (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <NumberBall n={s.score} size="sm" />
                <span className="flex-1 text-sm">{formatDate(s.played_on)}</span>
                <button onClick={() => setEditScore(s.id)} className="btn-ghost btn-sm">Edit</button>
                <button onClick={() => confirm("Delete this score?") && run(() => adminDeleteScore(s.id))} className="btn-danger btn-sm" aria-label="Delete score"><Trash2 size={14} /></button>
              </li>
            ),
          )}
          {user.scores.length === 0 && <li className="py-4 text-sm text-ink-soft">No scores yet.</li>}
        </ul>
        <form action={(fd) => run(() => adminSaveScore(null, user.id, fd))} className="mt-3 flex flex-wrap items-end gap-2">
          <input name="score" type="number" min={SCORE_MIN} max={SCORE_MAX} placeholder="Score" aria-label="New score" required className="field w-24 py-2" />
          <input name="played_on" type="date" aria-label="New score date" required className="field w-44 py-2" />
          <button className="btn-dark btn-sm">Add score</button>
        </form>
      </div>
      <div className="lg:col-span-2"><Notice result={notice} /></div>
    </div>
  );
}

export function UserManager({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input className="field pl-11" placeholder="Search by name or email" aria-label="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="panel divide-y divide-ink/5 overflow-hidden !p-0">
        {shown.map((u) => (
          <div key={u.id}>
            <button onClick={() => setOpen(open === u.id ? null : u.id)} aria-expanded={open === u.id} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-mist/60">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.name || "Unnamed"} {u.role === "admin" && <span className="badge ml-1 bg-violet-soft">Admin</span>}</p>
                <p className="truncate text-sm text-ink-soft">{u.email} · {u.charityName}</p>
              </div>
              <StatusPill tone={u.sub?.status === "active" ? "good" : u.sub?.status === "lapsed" ? "bad" : "neutral"}>{u.sub?.status ?? "no plan"}</StatusPill>
              <ChevronDown size={18} className={cn("shrink-0 transition", open === u.id && "rotate-180")} />
            </button>
            {open === u.id && <UserPanel user={u} />}
          </div>
        ))}
        {shown.length === 0 && <p className="px-5 py-10 text-center text-ink-soft">No users match that search.</p>}
      </div>
    </div>
  );
}
