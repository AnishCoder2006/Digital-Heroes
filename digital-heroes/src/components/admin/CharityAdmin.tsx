"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCharity, saveCharity } from "@/app/admin/actions";
import { CharityCover } from "@/components/CharityCover";
import { Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/utils";
import type { Charity } from "@/types/database";

const eventsToText = (c?: Charity) => (c?.events ?? []).map((e) => `${e.title} | ${e.date} | ${e.location}`).join("\n");

function CharityForm({ charity, onDone }: { charity?: Charity; onDone: () => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await saveCharity(charity?.id ?? null, fd);
          setResult(r);
          if (r.ok) onDone();
        })
      }
      className="panel space-y-4 ring-2 ring-violet"
    >
      <h3 className="text-lg font-bold">{charity ? `Edit ${charity.name}` : "Add a charity"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">Name</label><input id="c-name" name="name" defaultValue={charity?.name} required className="field" /></div>
        <div><label className="label" htmlFor="c-tag">One-line summary</label><input id="c-tag" name="tagline" defaultValue={charity?.tagline} className="field" /></div>
      </div>
      <div><label className="label" htmlFor="c-desc">Description</label><textarea id="c-desc" name="description" rows={4} defaultValue={charity?.description} className="field" /></div>
      <div><label className="label" htmlFor="c-img">Image URL (optional)</label><input id="c-img" name="image_url" type="url" defaultValue={charity?.image_url ?? ""} placeholder="https://" className="field" /></div>
      <div>
        <label className="label" htmlFor="c-events">Upcoming events, one per line: title | date (YYYY-MM-DD) | location</label>
        <textarea id="c-events" name="events" rows={3} defaultValue={eventsToText(charity)} className="field" />
      </div>
      <label className="flex items-center gap-3 font-medium"><input type="checkbox" name="featured" defaultChecked={charity?.featured} className="h-5 w-5" /> Show in the homepage spotlight</label>
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save charity"}</button>
        <button type="button" onClick={onDone} className="btn-ghost">Cancel</button>
      </div>
      <Notice result={result} />
    </form>
  );
}

export function CharityAdmin({ charities }: { charities: Charity[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-ink-soft">{charities.length} charities listed</p>
        {editing !== "new" && <button onClick={() => setEditing("new")} className="btn-primary btn-sm"><Plus size={16} /> Add charity</button>}
      </div>
      <Notice result={notice} />
      {editing === "new" && <CharityForm onDone={() => setEditing(null)} />}

      <div className="space-y-3">
        {charities.map((c) =>
          editing === c.id ? (
            <CharityForm key={c.id} charity={c} onDone={() => setEditing(null)} />
          ) : (
            <article key={c.id} className="panel flex flex-wrap items-center gap-5 !p-4">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl"><CharityCover name={c.name} imageUrl={c.image_url} /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold">{c.name} {c.featured && <span className="badge ml-2 bg-marigold-soft">Featured</span>}</h3>
                <p className="truncate text-sm text-ink-soft">{c.tagline}</p>
                <p className="text-sm text-ink-faint">{c.events?.length ?? 0} event(s)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(c.id)} className="btn-ghost btn-sm"><Pencil size={14} /> Edit</button>
                <button
                  disabled={pending}
                  onClick={() => confirm(`Delete ${c.name}? Users who chose it will need to pick another.`) && start(async () => setNotice(await deleteCharity(c.id)))}
                  className="btn-danger btn-sm"
                ><Trash2 size={14} /> Delete</button>
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
