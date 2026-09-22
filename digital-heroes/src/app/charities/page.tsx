import type { Metadata } from "next";
import { CharityBrowser } from "@/components/CharityBrowser";
import { PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Charity } from "@/types/database";

export const metadata: Metadata = { title: "Charities" };

export default async function CharitiesPage() {
  const { data } = await (await createClient()).from("charities").select("*").order("featured", { ascending: false }).order("name");
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <PageTitle title="Choose who you play for">
        Every subscriber sends part of their fee to a charity. Browse the causes below and pick the one that matters to you.
      </PageTitle>
      <CharityBrowser charities={(data ?? []) as Charity[]} />
    </div>
  );
}
