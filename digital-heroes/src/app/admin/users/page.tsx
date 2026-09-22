import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { UserManager, type UserRow } from "@/components/admin/UserManager";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortScores } from "@/lib/scores";
import type { Charity, Profile, Score, Subscription } from "@/types/database";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = createAdminClient();
  const [profilesRes, subsRes, scoresRes, charitiesRes, authRes] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("*"),
    admin.from("scores").select("id, user_id, score, played_on"),
    admin.from("charities").select("id, name"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailOf = new Map(authRes.data.users.map((u) => [u.id, u.email ?? ""]));
  const subOf = new Map(((subsRes.data ?? []) as Subscription[]).map((s) => [s.user_id, s]));
  const charityOf = new Map(((charitiesRes.data ?? []) as Pick<Charity, "id" | "name">[]).map((c) => [c.id, c.name]));
  const scoresByUser = new Map<string, Score[]>();
  for (const s of (scoresRes.data ?? []) as Score[]) scoresByUser.set(s.user_id, [...(scoresByUser.get(s.user_id) ?? []), s]);

  const users: UserRow[] = ((profilesRes.data ?? []) as Profile[]).map((p) => {
    const sub = subOf.get(p.id);
    return {
      id: p.id,
      name: p.full_name,
      email: emailOf.get(p.id) ?? "",
      role: p.role,
      charityName: (p.charity_id && charityOf.get(p.charity_id)) || "No charity",
      charityPercent: p.charity_percent,
      sub: sub ? { plan: sub.plan, status: sub.status, renewal: sub.renewal_date } : null,
      scores: sortScores(scoresByUser.get(p.id) ?? []).map(({ id, score, played_on }) => ({ id, score, played_on })),
    };
  });

  return (
    <div>
      <PageTitle title="Users">View and edit profiles, subscriptions and golf scores.</PageTitle>
      <UserManager users={users} />
    </div>
  );
}
