import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRazorpay } from "@/lib/razorpay";

/** Creates a Razorpay order for a one-off donation (independent of the subscription). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { charityId, amount } = (await req.json()) as { charityId: string; amount: number };
  if (!charityId || !Number.isFinite(amount) || amount < 10 || amount > 100000) {
    return NextResponse.json({ error: "Enter an amount between ₹10 and ₹1,00,000." }, { status: 400 });
  }

  const { data: charity } = await supabase.from("charities").select("id").eq("id", charityId).maybeSingle();
  if (!charity) return NextResponse.json({ error: "Charity not found." }, { status: 404 });

  try {
    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `don_${Date.now()}`,
      notes: { user_id: user.id, charity_id: charityId },
    });
    return NextResponse.json({ orderId: order.id, amount: order.amount, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("donation order failed", err);
    return NextResponse.json({ error: "Could not start the donation. Please try again." }, { status: 502 });
  }
}
