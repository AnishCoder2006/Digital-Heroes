import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRazorpay } from "@/lib/razorpay";
import { PLANS, type PlanKey } from "@/lib/config";
import { getSubscription, needsPayment } from "@/lib/subscription";

/**
 * Step 1 of checkout: create a Razorpay order for one billing period.
 * Nothing is saved yet. Access is granted only after the payment is verified.
 * (The route keeps its original name so existing links keep working.)
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { plan } = (await req.json()) as { plan: PlanKey };
  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "Choose a monthly or yearly plan." }, { status: 400 });
  }

  const existing = await getSubscription(supabase, user.id);
  if (!needsPayment(existing)) {
    return NextResponse.json({ error: "Your plan is active. You can renew during its last 7 days." }, { status: 409 });
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: PLANS[plan].priceInr * 100, // paise
      currency: "INR",
      receipt: `sub_${Date.now()}`,
      notes: { user_id: user.id, plan },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      email: user.email,
    });
  } catch (err) {
    console.error("create order failed", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
