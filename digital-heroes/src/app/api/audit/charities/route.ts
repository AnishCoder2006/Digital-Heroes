import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inPaise } from "@/lib/charity";

export const dynamic = "force-dynamic";

export interface CharityAuditItem {
  id: string;
  name: string;
  ledgerTotal: number;       // whole paise
  contributionTotal: number; // whole paise
  status: "ok" | "mismatch";
}

/**
 * GET /api/audit/charities
 *
 * Public audit endpoint: returns every charity with its ledger total,
 * contribution total, and integrity status ('ok' or 'mismatch').
 * All monetary amounts are formatted in whole paise at the API boundary.
 *
 * Who can call: Anyone (unauthenticated public, donors, auditors).
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    // 1. Fetch all registered charities
    const { data: charities, error: charityError } = await admin
      .from("charities")
      .select("id, name")
      .order("name", { ascending: true });

    if (charityError) {
      console.error("Fetch charities error:", charityError);
      return NextResponse.json({ error: "Could not fetch charities." }, { status: 500 });
    }

    // 2. Fetch all contributions and ledger entries
    const [contribRes, ledgerRes] = await Promise.all([
      admin.from("charity_contributions").select("charity_id, amount"),
      admin.from("ledger_entries").select("charity_id, amount"),
    ]);

    if (contribRes.error || ledgerRes.error) {
      console.error("Fetch audit totals error:", contribRes.error || ledgerRes.error);
      return NextResponse.json({ error: "Could not calculate charity audit totals." }, { status: 500 });
    }

    // 3. Aggregate totals per charity in rupees
    const contribTotals = new Map<string, number>();
    for (const c of contribRes.data ?? []) {
      const current = contribTotals.get(c.charity_id) ?? 0;
      contribTotals.set(c.charity_id, current + Number(c.amount));
    }

    const ledgerTotals = new Map<string, number>();
    for (const l of ledgerRes.data ?? []) {
      const current = ledgerTotals.get(l.charity_id) ?? 0;
      ledgerTotals.set(l.charity_id, current + Number(l.amount));
    }

    // 4. Construct audit records with status check
    const items: CharityAuditItem[] = (charities ?? []).map((ch) => {
      const contribRupees = contribTotals.get(ch.id) ?? 0;
      const ledgerRupees = ledgerTotals.get(ch.id) ?? 0;

      const contributionTotalPaise = inPaise(contribRupees);
      const ledgerTotalPaise = inPaise(ledgerRupees);

      const status: "ok" | "mismatch" =
        contributionTotalPaise === ledgerTotalPaise ? "ok" : "mismatch";

      return {
        id: ch.id,
        name: ch.name,
        ledgerTotal: ledgerTotalPaise,
        contributionTotal: contributionTotalPaise,
        status,
      };
    });

    return NextResponse.json({
      charities: items,
    });
  } catch (err) {
    console.error("audit charities route exception:", err);
    return NextResponse.json({ error: "Charity audit failed." }, { status: 500 });
  }
}
