import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";
import { addPeriod, getSubscription } from "@/lib/subscription";

/**
 * Step 2 of checkout: verify Razorpay's signature, then activate the plan.
 * Plan and user come from Razorpay's own order record, never from the browser.
 * The order id is stored in subscriptions.razorpay_subscription_id, so verifying
 * the same payment twice cannot extend the plan twice.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const body = (await req.json()) as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(body.razorpay_signature ?? "");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = (await getRazorpay().orders.fetch(body.razorpay_order_id)) as any;
  if (order.notes?.user_id !== user.id) return NextResponse.json({ error: "Order mismatch." }, { status: 403 });
  const plan = order.notes?.plan === "yearly" ? "yearly" : "monthly";

  const existing = await getSubscription(supabase, user.id);
  if (existing?.razorpay_subscription_id === body.razorpay_order_id) return NextResponse.json({ ok: true }); // already applied

  // Renewing early stacks the new period on top of the remaining time.
  const now = new Date();
  const stillPaidUntil = existing?.status === "active" && existing.renewal_date ? new Date(existing.renewal_date) : null;
  const base = stillPaidUntil && stillPaidUntil > now ? stillPaidUntil : now;

  const { error } = await createAdminClient()
    .from("subscriptions")
    .upsert(
      {
        user_id: user.id,
        plan,
        status: "active",
        razorpay_subscription_id: body.razorpay_order_id,
        renewal_date: addPeriod(base, plan).toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) return NextResponse.json({ error: "Could not activate your plan." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
