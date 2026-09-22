import Link from "next/link";
import { CharityCover } from "./CharityCover";
import type { Charity } from "@/types/database";

export function CharityCard({ charity }: { charity: Charity }) {
  return (
    <Link
      href={`/charities/${charity.id}`}
      className="group flex flex-col overflow-hidden rounded-panel bg-white shadow-sm ring-1 ring-ink/5 transition hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="h-44 overflow-hidden">
        <CharityCover name={charity.name} imageUrl={charity.image_url} className="transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-tight">{charity.name}</h3>
          {charity.featured && <span className="badge shrink-0 bg-marigold-soft text-ink">Featured</span>}
        </div>
        <p className="mt-2 line-clamp-3 text-ink-soft">{charity.tagline || charity.description}</p>
        {charity.events?.length > 0 && (
          <p className="mt-4 text-sm font-semibold text-violet">
            {charity.events.length} upcoming event{charity.events.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </Link>
  );
}
