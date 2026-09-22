"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CharityCard } from "./CharityCard";
import { EmptyState } from "./ui";
import { cn } from "@/lib/utils";
import type { Charity } from "@/types/database";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "featured", label: "Featured" },
  { key: "events", label: "With upcoming events" },
] as const;

export function CharityBrowser({ charities }: { charities: Charity[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return charities.filter((c) => {
      if (filter === "featured" && !c.featured) return false;
      if (filter === "events" && !(c.events?.length > 0)) return false;
      return !q || `${c.name} ${c.tagline} ${c.description}`.toLowerCase().includes(q);
    });
  }, [charities, query, filter]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className="field pl-11"
            placeholder="Search by name or cause"
            aria-label="Search charities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn("btn btn-sm", filter === f.key ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-ink/10 hover:bg-mist-deep")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <CharityCard key={c.id} charity={c} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title="No charities match that search" body="Try a different word, or clear the filter to see every charity." />
        </div>
      )}
    </div>
  );
}
