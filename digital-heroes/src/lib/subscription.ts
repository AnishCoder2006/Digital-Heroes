import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subscription } from "@/types/database";

const GRACE_MS = 2 * 24 * 60 * 60 * 1000; // renewals can land a little late

/**
 * Does this subscription currently give access?
 * - active: yes (unless the paid period ended long ago without a renewal event)
 * - cancelled: yes until the period they already paid for ends
 * - pending / lapsed / expired: no
 */
export function hasAccess(sub: Pick<Subscription, "status" | "renewal_date"> | null | undefined): boolean {
  if (!sub) return false;
  const end = sub.renewal_date ? new Date(sub.renewal_date).getTime() : null;
  const now = Date.now();
  if (sub.status === "active") return end === null || end + GRACE_MS > now;
  if (sub.status === "cancelled") return end !== null && end > now;
  return false;
}

/** Adds one billing period (a month or a year) to a date. */
export function addPeriod(from: Date, plan: "monthly" | "yearly"): Date {
  const d = new Date(from);
  if (plan === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Can this user pay for another period right now?
 * Yes when they have no access, cancelled, or their paid period ends within 7 days.
 */
export function needsPayment(sub: Pick<Subscription, "status" | "renewal_date"> | null | undefined): boolean {
  if (!hasAccess(sub)) return true;
  if (sub!.status === "cancelled") return true;
  const end = sub!.renewal_date ? new Date(sub!.renewal_date).getTime() : 0;
  return end - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

export const statusLabel: Record<Subscription["status"], string> = {
  pending: "Not started",
  active: "Active",
  cancelled: "Ends at renewal date",
  lapsed: "Payment failed",
  expired: "Expired",
};

export async function getSubscription(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return (data as Subscription | null) ?? null;
}
