"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, hasAccess } from "@/lib/subscription";
import { planScoreInsert, validateScore, type ScoreRow } from "@/lib/scores";
import type { ActionResult } from "@/lib/utils";

async function activeSubscriber() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." } as const;
  // Real-time subscription check on every write.
  if (!hasAccess(await getSubscription(supabase, user.id))) {
    return { ok: false, message: "Scores are available to active subscribers." } as const;
  }
  return { ok: true, supabase, user } as const;
}

function parse(formData: FormData) {
  return { score: Number(formData.get("score")), played_on: String(formData.get("played_on") ?? "") };
}

export async function addScore(formData: FormData): Promise<ActionResult> {
  const ctx = await activeSubscriber();
  if (!ctx.ok) return { ok: false, message: ctx.message };
  const { score, played_on } = parse(formData);

  const invalid = validateScore(score, played_on);
  if (invalid) return { ok: false, message: invalid };

  const { data: existing } = await ctx.supabase.from("scores").select("id, score, played_on").eq("user_id", ctx.user.id);
  const plan = planScoreInsert((existing ?? []) as ScoreRow[], { score, played_on });
  if (plan.error) return { ok: false, message: plan.error };

  const { error } = await ctx.supabase.from("scores").insert({ user_id: ctx.user.id, score, played_on });
  if (error) {
    return { ok: false, message: error.code === "23505" ? "You already have a score for that date." : "Could not save the score." };
  }
  if (plan.dropIds.length) await ctx.supabase.from("scores").delete().in("id", plan.dropIds);

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: plan.dropIds.length ? "Score saved. Your oldest score was replaced." : "Score saved.",
  };
}

export async function updateScore(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await activeSubscriber();
  if (!ctx.ok) return { ok: false, message: ctx.message };
  const { score, played_on } = parse(formData);

  const invalid = validateScore(score, played_on);
  if (invalid) return { ok: false, message: invalid };

  const { error } = await ctx.supabase.from("scores").update({ score, played_on }).eq("id", id).eq("user_id", ctx.user.id);
  if (error) {
    return { ok: false, message: error.code === "23505" ? "You already have a score for that date." : "Could not update the score." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Score updated." };
}

export async function deleteScore(id: string): Promise<ActionResult> {
  const ctx = await activeSubscriber();
  if (!ctx.ok) return { ok: false, message: ctx.message };
  const { error } = await ctx.supabase.from("scores").delete().eq("id", id).eq("user_id", ctx.user.id);
  if (error) return { ok: false, message: "Could not delete the score." };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Score deleted." };
}
