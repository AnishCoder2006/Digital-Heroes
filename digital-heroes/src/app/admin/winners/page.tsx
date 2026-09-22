import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { WinnersTable, type WinnerRow } from "@/components/admin/WinnersTable";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Draw, Profile, Winner } from "@/types/database";

export const metadata: Metadata = { title: "Winners" };
export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("winners").select("*").order("created_at", { ascending: false });
  const winners = (data ?? []) as Winner[];

  const [profilesRes, drawsRes] = winners.length
    ? await Promise.all([
        admin.from("profiles").select("id, full_name").in("id", [...new Set(winners.map((w) => w.user_id))]),
        admin.from("draws").select("id, month").in("id", [...new Set(winners.map((w) => w.draw_id))]),
      ])
    : [{ data: [] }, { data: [] }];
  const nameOf = new Map(((profilesRes.data ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));
  const monthOf = new Map(((drawsRes.data ?? []) as Pick<Draw, "id" | "month">[]).map((d) => [d.id, d.month]));

  const rows: WinnerRow[] = winners.map((w) => ({
    id: w.id,
    name: nameOf.get(w.user_id) || "Unnamed player",
    month: monthOf.get(w.draw_id) ?? w.created_at,
    tier: w.tier,
    amount: Number(w.prize_amount),
    proofPath: w.proof_path,
    verification: w.verification_status,
    payment: w.payment_status,
  }));

  return (
    <div>
      <PageTitle title="Winners">Review each winner&apos;s proof, approve or reject it, then mark the payout as paid.</PageTitle>
      <WinnersTable rows={rows} />
    </div>
  );
}
