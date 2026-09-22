import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";

/** Verifies the donation payment signature, then records the donation. */
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

  // Amount and charity come from Razorpay's own order record, never from the browser.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = (await getRazorpay().orders.fetch(body.razorpay_order_id)) as any;
  if (order.notes?.user_id !== user.id) return NextResponse.json({ error: "Order mismatch." }, { status: 403 });

  const { error } = await createAdminClient().from("donations").upsert(
    {
      user_id: user.id,
      charity_id: order.notes.charity_id,
      amount: Number(order.amount) / 100,
      razorpay_payment_id: body.razorpay_payment_id,
    },
    { onConflict: "razorpay_payment_id" },
  );
  if (error) return NextResponse.json({ error: "Could not record the donation." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
