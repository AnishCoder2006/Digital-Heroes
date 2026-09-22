"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT } from "@/lib/config";
import { getSubscription } from "@/lib/subscription";
import type { ActionResult } from "@/lib/utils";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const charityId = String(formData.get("charity_id") ?? "");
  const percent = Number(formData.get("charity_percent"));

  if (!fullName) return { ok: false, message: "Enter your name." };
  if (!charityId) return { ok: false, message: "Choose a charity." };
  if (!Number.isInteger(percent) || percent < MIN_CHARITY_PERCENT || percent > MAX_CHARITY_PERCENT) {
    return { ok: false, message: `Your charity share must be between ${MIN_CHARITY_PERCENT}% and ${MAX_CHARITY_PERCENT}%.` };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, charity_id: charityId, charity_percent: percent })
    .eq("id", user.id);
  if (error) return { ok: false, message: "Could not save your changes." };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Saved." };
}

/** Marks the plan as cancelled. Access continues until the paid period ends. */
export async function cancelSubscription(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const sub = await getSubscription(supabase, user.id);
  if (!sub || sub.status !== "active") {
    return { ok: false, message: "There's no active subscription to cancel." };
  }
  const { error } = await createAdminClient()
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", sub.id);
  if (error) return { ok: false, message: "Could not cancel right now. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Subscription cancelled. You keep access until your renewal date." };
}
