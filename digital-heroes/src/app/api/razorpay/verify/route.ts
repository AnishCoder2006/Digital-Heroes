import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";
import { addPeriod, getSubscription } from "@/lib/subscription";
import { calculatePaymentCharityShare } from "@/lib/charity";
import { recordContributionAndLedger } from "@/lib/ledger";

/**
 * Step 2 of checkout: verify Razorpay's signature, record the charity contribution
 * in the append-only ledger, then activate the plan.
 * Plan and user come from Razorpay's own order record, never from the browser.
 * The order id is stored in subscriptions.razorpay_subscription_id, and the payment id
 * is stored in charity_contributions, preventing duplicate entries.
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

  const adminClient = createAdminClient();

  // Load the user's selected charity and allocation percent
  const { data: profile } = await adminClient
    .from("profiles")
    .select("charity_id, charity_percent")
    .eq("id", user.id)
    .maybeSingle();

  // If user has a charity assigned, record the contribution and append-only ledger entry atomically
  let ledgerResult = null;
  if (profile?.charity_id) {
    const charityAmount = calculatePaymentCharityShare(plan, profile.charity_percent ?? 10);
    ledgerResult = await recordContributionAndLedger(adminClient, {
      paymentId: body.razorpay_payment_id,
      orderId: body.razorpay_order_id,
      charityId: profile.charity_id,
      userId: user.id,
      amount: charityAmount,
    });

    if (!ledgerResult.ok && !ledgerResult.alreadyProcessed) {
      console.error("Ledger recording failed:", ledgerResult.error);
      return NextResponse.json({ error: "Could not record charity contribution." }, { status: 500 });
    }
  }

  const existing = await getSubscription(supabase, user.id);
  if (existing?.razorpay_subscription_id === body.razorpay_order_id) {
    return NextResponse.json({
      ok: true,
      alreadyApplied: true,
      sequenceNumber: ledgerResult?.sequenceNumber,
    });
  }

  // Renewing early stacks the new period on top of the remaining time.
  const now = new Date();
  const stillPaidUntil = existing?.status === "active" && existing.renewal_date ? new Date(existing.renewal_date) : null;
  const base = stillPaidUntil && stillPaidUntil > now ? stillPaidUntil : now;

  const { error } = await adminClient
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

  return NextResponse.json({
    ok: true,
    contributionId: ledgerResult?.contributionId,
    sequenceNumber: ledgerResult?.sequenceNumber,
  });
}
