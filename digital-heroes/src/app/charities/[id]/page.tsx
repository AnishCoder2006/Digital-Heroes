import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";
import { CharityCover } from "@/components/CharityCover";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Charity } from "@/types/database";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await (await createClient()).from("charities").select("*").eq("id", id).maybeSingle();
  return data as Charity | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await load(id);
  return { title: c?.name ?? "Charity" };
}

export default async function CharityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const charity = await load(id);
  if (!charity) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/charities" className="font-semibold text-violet hover:underline">
        Back to charities
      </Link>

      <div className="mt-6 overflow-hidden rounded-blob bg-white shadow-sm ring-1 ring-ink/5">
        <div className="h-64 sm:h-80">
          <CharityCover name={charity.name} imageUrl={charity.image_url} />
        </div>
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{charity.name}</h1>
            {charity.tagline && <p className="mt-3 text-xl text-ink-soft">{charity.tagline}</p>}
            <p className="mt-6 max-w-prose whitespace-pre-line text-lg leading-relaxed">{charity.description}</p>
            <Link href={`/signup?charity=${charity.id}`} className="btn-primary mt-8 px-8 py-4 text-lg">
              Play for {charity.name}
            </Link>
          </div>

          <aside className="rounded-panel bg-mist p-6">
            <h2 className="text-xl font-bold">Upcoming events</h2>
            {charity.events?.length ? (
              <ul className="mt-4 space-y-5">
                {charity.events.map((e, i) => (
                  <li key={i}>
                    <p className="font-semibold">{e.title}</p>
                    {e.date && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
                        <CalendarDays size={16} /> {formatDate(e.date)}
                      </p>
                    )}
                    {e.location && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
                        <MapPin size={16} /> {e.location}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-soft">No events are listed right now. Check back soon.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}