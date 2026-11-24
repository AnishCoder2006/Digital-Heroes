import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inPaise } from "@/lib/charity";

export const dynamic = "force-dynamic";

/**
 * Returns the authenticated user's personal charity contributions.
 * Money fields are returned in whole paise per the API contract (Section 6).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  // Load contributions for logged-in user joined with charity name and ledger entry
  const { data: contributions, error } = await supabase
    .from("charity_contributions")
    .select(`
      id,
      amount,
      created_at,
      razorpay_payment_id,
      charities (
        name
      ),
      ledger_entries (
        entry_hash,
        sequence_number
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetch contributions error:", error);
    return NextResponse.json({ error: "Could not fetch your contributions." }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (contributions ?? []).map((row: any) => {
    const charity = Array.isArray(row.charities) ? row.charities[0] : row.charities;
    const ledger = Array.isArray(row.ledger_entries) ? row.ledger_entries[0] : row.ledger_entries;

    return {
      id: row.id,
      charity: charity?.name ?? "Unknown Charity",
      amount: inPaise(Number(row.amount)), // Whole paise per Section 6 API contract
      date: row.created_at,
      entryHash: ledger?.entry_hash ?? null,
      sequenceNumber: ledger?.sequence_number ?? null,
    };
  });

  return NextResponse.json({
    contributions: items,
  });
}
