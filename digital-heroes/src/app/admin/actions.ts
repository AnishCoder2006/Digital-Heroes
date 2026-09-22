"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDraw, type DrawMode } from "@/lib/draw";
import { DRAW_MAX, DRAW_MIN, DRAW_NUMBER_COUNT, MAX_SCORES, MAX_CHARITY_PERCENT, MIN_CHARITY_PERCENT, type PlanKey } from "@/lib/config";
import { hasAccess } from "@/lib/subscription";
import { planScoreInsert, validateScore, type ScoreRow } from "@/lib/scores";
import { monthStart, type ActionResult } from "@/lib/utils";
import type { CharityEvent, Subscription } from "@/types/database";

/* ----------------------------------------------------------------------------
 * Draw management
 * -------------------------------------------------------------------------- */

/** Everything a draw needs: who has access, who has a full set of scores, and last month's rollover. */
async function loadDrawContext(month: string) {
  const admin = createAdminClient();

  const { data: subRows } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, renewal_date")
    .in("status", ["active", "cancelled"]);
  const subs = ((subRows ?? []) as Pick<Subscription, "user_id" | "plan" | "status" | "renewal_date">[]).filter(hasAccess);
  const userIds = subs.map((s) => s.user_id);

  const { data: scoreRows } = userIds.length
    ? await admin.from("scores").select("user_id, score").in("user_id", userIds)
    : { data: [] as { user_id: string; score: number }[] };

  const byUser = new Map<string, number[]>();
  for (const r of scoreRows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.score]);
  // Only users with a full set of 5 scores are entered.
  const entries = [...byUser.entries()]
    .filter(([, scores]) => scores.length === MAX_SCORES)
    .map(([userId, scores]) => ({ userId, scores }));

  const { data: prev } = await admin
    .from("draws")
    .select("jackpot_carryover_out")
    .lt("month", month)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    admin,
    subscribers: subs.map((s) => ({ plan: s.plan as PlanKey })),
    entries,
    carryIn: Number(prev?.jackpot_carryover_out ?? 0),
  };
}

export type SimulationResult = {
  numbers: number[];
  mode: DrawMode;
  month: string;
  subscriberCount: number;
  entryCount: number;
  poolBase: number;
  carryIn: number;
  rolloverOut: number;
  summaries: { tier: 5 | 4 | 3; pool: number; winners: number; each: number }[];
  winners: { name: string; tier: 5 | 4 | 3; amount: number }[];
};

/** Runs the draw without saving anything so the admin can review it first. */
export async function simulateDraw(input: { mode: DrawMode; month: string }): Promise<{ ok: boolean; message: string; result?: SimulationResult }> {
  await requireAdmin();
  const month = monthStart(input.month);
  const ctx = await loadDrawContext(month);
  if (!ctx.subscribers.length) return { ok: false, message: "There are no active subscribers to draw for yet." };

  const r = runDraw({ mode: input.mode, entries: ctx.entries, subscribers: ctx.subscribers, carryIn: ctx.carryIn });

  const ids = r.payouts.map((p) => p.userId);
  const { data: names } = ids.length ? await ctx.admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id as string, (n.full_name as string) || "Unnamed player"]));

  return {
    ok: true,
    message: "Simulation ready. Nothing has been published.",
    result: {
      numbers: r.numbers,
      mode: input.mode,
      month,
      subscriberCount: ctx.subscribers.length,
      entryCount: r.entryCount,
      poolBase: r.poolBase,
      carryIn: ctx.carryIn,
      rolloverOut: r.rolloverOut,
      summaries: r.summaries,
      winners: r.payouts.map((p) => ({ name: nameOf.get(p.userId) ?? "Unnamed player", tier: p.tier, amount: p.amount })),
    },
  };
}

/** Publishes the simulated numbers: saves the draw, every entry, and every winner. */
export async function publishDraw(input: { mode: DrawMode; month: string; numbers: number[] }): Promise<ActionResult> {
  await requireAdmin();
  const month = monthStart(input.month);
  const nums = input.numbers;
  const valid =
    nums.length === DRAW_NUMBER_COUNT &&
    new Set(nums).size === DRAW_NUMBER_COUNT &&
    nums.every((n) => Number.isInteger(n) && n >= DRAW_MIN && n <= DRAW_MAX);
  if (!valid) return { ok: false, message: "Run a simulation first." };

  const ctx = await loadDrawContext(month);
  const { data: existing } = await ctx.admin.from("draws").select("id").eq("month", month).maybeSingle();
  if (existing) return { ok: false, message: "A draw has already been published for that month." };

  const r = runDraw({ mode: input.mode, entries: ctx.entries, subscribers: ctx.subscribers, carryIn: ctx.carryIn, fixedNumbers: nums });

  const { data: draw, error } = await ctx.admin
    .from("draws")
    .insert({
      month,
      mode: input.mode,
      winning_numbers: r.numbers,
      subscriber_count: ctx.subscribers.length,
      pool_base: r.poolBase,
      jackpot_carryover_in: ctx.carryIn,
      jackpot_carryover_out: r.rolloverOut,
    })
    .select("id")
    .single();
  if (error || !draw) return { ok: false, message: "Could not publish the draw." };

  const matchedByUser = new Map(r.winners.map((w) => [w.userId, w.count]));
  if (ctx.entries.length) {
    await ctx.admin.from("draw_entries").insert(
      ctx.entries.map((e) => ({
        draw_id: draw.id,
        user_id: e.userId,
        scores: e.scores,
        matched_count: matchedByUser.get(e.userId) ?? 0,
      })),
    );
  }
  if (r.payouts.length) {
    await ctx.admin.from("winners").insert(
      r.payouts.map((p) => ({
        draw_id: draw.id,
        user_id: p.userId,
        tier: p.tier,
        matched_numbers: p.matched,
        prize_amount: p.amount,
      })),
    );
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: r.payouts.length
      ? `Published. ${r.payouts.length} winner${r.payouts.length > 1 ? "s" : ""} recorded.`
      : "Published. No winners this month, so the jackpot rolls over.",
  };
}

/* ----------------------------------------------------------------------------
 * Winners
 * -------------------------------------------------------------------------- */

export async function reviewWinner(id: string, decision: "approve" | "reject"): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("winners")
    .update({ verification_status: decision === "approve" ? "approved" : "rejected" })
    .eq("id", id);
  if (error) return { ok: false, message: "Could not update the submission." };
  revalidatePath("/admin/winners");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: decision === "approve" ? "Approved." : "Rejected. The winner can upload a new proof." };
}

export async function markPaid(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: w } = await admin.from("winners").select("verification_status").eq("id", id).maybeSingle();
  if (w?.verification_status !== "approved") return { ok: false, message: "Approve the proof before marking it paid." };
  const { error } = await admin.from("winners").update({ payment_status: "paid" }).eq("id", id);
  if (error) return { ok: false, message: "Could not mark as paid." };
  revalidatePath("/admin/winners");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Marked as paid." };
}

/** Short-lived link so the admin can view a private proof image. */
export async function getProofUrl(path: string): Promise<string | null> {
  await requireAdmin();
  const { data } = await createAdminClient().storage.from("proofs").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/* ----------------------------------------------------------------------------
 * Charities
 * -------------------------------------------------------------------------- */

function parseEvents(text: string): CharityEvent[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", date = "", location = ""] = line.split("|").map((p) => p.trim());
      return { title, date, location };
    })
    .filter((e) => e.title);
}

export async function saveCharity(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the charity a name." };

  const row = {
    name,
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    featured: formData.get("featured") === "on",
    events: parseEvents(String(formData.get("events") ?? "")),
  };
  const admin = createAdminClient();
  const { error } = id ? await admin.from("charities").update(row).eq("id", id) : await admin.from("charities").insert(row);
  if (error) return { ok: false, message: "Could not save the charity." };

  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Charity updated." : "Charity added." };
}

export async function deleteCharity(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createAdminClient().from("charities").delete().eq("id", id);
  if (error) return { ok: false, message: "Could not delete the charity." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Charity deleted." };
}

/* ----------------------------------------------------------------------------
 * Users, subscriptions and scores
 * -------------------------------------------------------------------------- */

export async function updateUser(userId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const percent = Number(formData.get("charity_percent"));
  if (!Number.isInteger(percent) || percent < MIN_CHARITY_PERCENT || percent > MAX_CHARITY_PERCENT) {
    return { ok: false, message: `Charity share must be ${MIN_CHARITY_PERCENT}% to ${MAX_CHARITY_PERCENT}%.` };
  }
  const { error } = await admin
    .from("profiles")
    .update({ full_name: String(formData.get("full_name") ?? "").trim(), charity_percent: percent })
    .eq("id", userId);
  if (error) return { ok: false, message: "Could not update the profile." };

  const status = String(formData.get("sub_status") ?? "");
  const plan = String(formData.get("sub_plan") ?? "monthly") as PlanKey;
  if (status) {
    const renewal = String(formData.get("sub_renewal") ?? "");
    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        status,
        renewal_date: renewal ? new Date(renewal).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subError) return { ok: false, message: "Could not update the subscription." };
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

export async function adminSaveScore(scoreId: string | null, userId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const score = Number(formData.get("score"));
  const played_on = String(formData.get("played_on") ?? "");
  const invalid = validateScore(score, played_on);
  if (invalid) return { ok: false, message: invalid };

  const admin = createAdminClient();
  if (scoreId) {
    const { error } = await admin.from("scores").update({ score, played_on }).eq("id", scoreId);
    if (error) return { ok: false, message: error.code === "23505" ? "That user already has a score for that date." : "Could not update the score." };
  } else {
    const { data: existing } = await admin.from("scores").select("id, score, played_on").eq("user_id", userId);
    const plan = planScoreInsert((existing ?? []) as ScoreRow[], { score, played_on });
    if (plan.error) return { ok: false, message: plan.error };
    const { error } = await admin.from("scores").insert({ user_id: userId, score, played_on });
    if (error) return { ok: false, message: "Could not add the score." };
    if (plan.dropIds.length) await admin.from("scores").delete().in("id", plan.dropIds);
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "Score saved." };
}

export async function adminDeleteScore(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createAdminClient().from("scores").delete().eq("id", id);
  if (error) return { ok: false, message: "Could not delete the score." };
  revalidatePath("/admin/users");
  return { ok: true, message: "Score deleted." };
}
