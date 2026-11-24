import { NextResponse } from "next/server";
import { authorizeApiRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inPaise } from "@/lib/charity";
import { decryptDonorData, generateSearchToken } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export interface DonationSearchResult {
  contributionId: string;
  donorName: string;
  donorEmail: string;
  charity: string;
  amount: number; // whole paise per Section 6 API contract
  date: string;
}

/**
 * GET /api/admin/donations/search?q=<keyword>
 *
 * Searchable encryption lookup for admins and auditors.
 * 1. Hashes search query keyword into deterministic HMAC token.
 * 2. Matches token against blind `donation_search_index` (no raw keyword stored in DB).
 * 3. Fetches AES-256-GCM encrypted donor details (`donation_records_enc`) and decrypts them.
 * 4. Joins with contribution amount (in whole paise), charity name, and timestamp.
 *
 * Authorization: Admin or Auditor only.
 * Returns: 401 if unauthenticated, 403 if subscriber, 400 if 'q' missing.
 */
export async function GET(req: Request) {
  try {
    // 1. Authorize caller as admin or auditor
    const auth = await authorizeApiRole(["admin", "auditor"]);
    if (auth.response) {
      return auth.response;
    }

    // 2. Validate query parameter
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ error: "Search query 'q' parameter is required." }, { status: 400 });
    }

    const admin = createAdminClient();

    // 3. Generate HMAC search tokens for query and component keywords
    const tokens = new Set<string>();
    tokens.add(generateSearchToken(q));

    const words = q.split(/[\s,._-]+/).filter((w) => w.length >= 2);
    for (const word of words) {
      tokens.add(generateSearchToken(word));
    }

    // 4. Look up matching contribution IDs in blind index
    const { data: indexRows, error: indexError } = await admin
      .from("donation_search_index")
      .select("contribution_id")
      .in("token", Array.from(tokens));

    if (indexError) {
      console.error("Search index lookup failed:", indexError);
      return NextResponse.json({ error: "Search query failed." }, { status: 500 });
    }

    if (!indexRows || indexRows.length === 0) {
      return NextResponse.json({
        query: q,
        count: 0,
        results: [],
      });
    }

    const contribIds = Array.from(new Set(indexRows.map((r) => r.contribution_id)));

    // 5. Fetch contribution details and encrypted donor payloads in parallel
    const [contribRes, encRes] = await Promise.all([
      admin
        .from("charity_contributions")
        .select(`
          id,
          amount,
          created_at,
          charities (
            name
          )
        `)
        .in("id", contribIds)
        .order("created_at", { ascending: false }),
      admin
        .from("donation_records_enc")
        .select("contribution_id, ciphertext, nonce")
        .in("contribution_id", contribIds),
    ]);

    if (contribRes.error) {
      console.error("Fetch contributions failed:", contribRes.error);
      return NextResponse.json({ error: "Could not retrieve matching contributions." }, { status: 500 });
    }

    // Index encrypted payloads by contribution_id
    const encMap = new Map<string, { ciphertext: string; nonce: string }>();
    for (const row of encRes.data ?? []) {
      encMap.set(row.contribution_id, { ciphertext: row.ciphertext, nonce: row.nonce });
    }

    // 6. Decrypt donor records and format results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: DonationSearchResult[] = (contribRes.data ?? []).map((row: any) => {
      const charity = Array.isArray(row.charities) ? row.charities[0] : row.charities;
      const enc = encMap.get(row.id);

      let donorName = "Anonymous Donor";
      let donorEmail = "";

      if (enc) {
        try {
          const decrypted = decryptDonorData({ ciphertext: enc.ciphertext, nonce: enc.nonce });
          donorName = decrypted.fullName;
          donorEmail = decrypted.email;
        } catch (decryptErr) {
          console.error(`Tampered or invalid ciphertext for contribution ${row.id}:`, decryptErr);
          donorName = "[Decryption Failed - Tampered]";
          donorEmail = "[Tampered]";
        }
      }

      return {
        contributionId: row.id,
        donorName,
        donorEmail,
        charity: charity?.name ?? "Unknown Charity",
        amount: inPaise(Number(row.amount)),
        date: row.created_at,
      };
    });

    return NextResponse.json({
      query: q,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("search donations exception:", err);
    return NextResponse.json({ error: "Donation search failed." }, { status: 500 });
  }
}
