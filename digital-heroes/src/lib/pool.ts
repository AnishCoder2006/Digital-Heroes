import { createAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/subscription";
import { monthlyPoolBase } from "@/lib/draw/prizes";
import type { PlanKey } from "@/lib/config";
import type { Subscription } from "@/types/database";

/** Live prize pool for the upcoming draw, plus any jackpot carried over. Server only. */
export async function getUpcomingPool() {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("plan, status, renewal_date").in("status", ["active", "cancelled"]);
  const subs = ((data ?? []) as Pick<Subscription, "plan" | "status" | "renewal_date">[]).filter(hasAccess);

  const { data: last } = await admin
    .from("draws")
    .select("jackpot_carryover_out")
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    subscribers: subs.length,
    base: monthlyPoolBase(subs.map((s) => ({ plan: s.plan as PlanKey }))),
    carryover: Number(last?.jackpot_carryover_out ?? 0),
  };
}
