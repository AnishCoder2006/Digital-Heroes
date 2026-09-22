import type { Metadata } from "next";
import { CharityAdmin } from "@/components/admin/CharityAdmin";
import { PageTitle } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Charity } from "@/types/database";

export const metadata: Metadata = { title: "Charities" };
export const dynamic = "force-dynamic";

export default async function AdminCharitiesPage() {
  const { data } = await createAdminClient().from("charities").select("*").order("featured", { ascending: false }).order("name");
  return (
    <div>
      <PageTitle title="Charities">Add, edit or remove the charities players can support.</PageTitle>
      <CharityAdmin charities={(data ?? []) as Charity[]} />
    </div>
  );
}
