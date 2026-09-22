import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_BY_EVENT: Record<string, string> = {
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.resumed": "active",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "expired",
  "subscription.expired": "expired",
  "subscription.halted": "lapsed",
  "subscription.pending": "lapsed",
};

/**
 * Razorpay calls this whenever a subscription changes (renewed, cancelled, payment failed).
 * Add it in Razorpay Dashboard -> Webhooks with the same secret as RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const raw = await req.text(); // the signature is computed over the exact raw body
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);
  const status = STATUS_BY_EVENT[event.event as string];
  const entity = event.payload?.subscription?.entity;
  if (!status || !entity?.id) return NextResponse.json({ ok: true, ignored: true });

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (entity.current_end) update.renewal_date = new Date(entity.current_end * 1000).toISOString();

  const { error } = await createAdminClient()
    .from("subscriptions")
    .update(update)
    .eq("razorpay_subscription_id", entity.id);

  if (error) {
    console.error("webhook update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 }); // Razorpay will retry
  }
  return NextResponse.json({ ok: true });
}
