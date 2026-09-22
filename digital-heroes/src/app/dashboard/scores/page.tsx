import type { Metadata } from "next";
import { PageTitle, Paywall } from "@/components/ui";
import { ScoreManager } from "@/components/dashboard/ScoreManager";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, hasAccess } from "@/lib/subscription";
import { sortScores } from "@/lib/scores";

export const metadata: Metadata = { title: "Scores" };

export default async function ScoresPage() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const [sub, { data }] = await Promise.all([
    getSubscription(supabase, user.id),
    supabase.from("scores").select("id, score, played_on").eq("user_id", user.id),
  ]);

  return (
    <div>
      <PageTitle title="Your scores">Enter your latest Stableford scores. We keep the most recent five.</PageTitle>
      {hasAccess(sub) ? <ScoreManager scores={sortScores(data ?? [])} /> : <Paywall what="score tracking" />}
    </div>
  );
}
