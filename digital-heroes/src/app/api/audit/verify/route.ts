import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENESIS_PREV_HASH, verifyLedgerChain } from "@/lib/ledger";
import type { LedgerEntry } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Public audit endpoint: verifies the entire hash-linked ledger chain.
 * Can be called by anyone (public auditor, user, researcher) without login.
 * Returns: ok, or the first broken sequence number; latest entry hash (Section 6 API contract).
 */
export async function GET() {
  try {
    const adminClient = createAdminClient();

    // 1. Fetch latest entry hash
    const { data: latestEntry } = await adminClient
      .from("ledger_entries")
      .select("entry_hash, sequence_number")
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestHash = latestEntry?.entry_hash ?? GENESIS_PREV_HASH;

    // 2. Attempt in-database PostgreSQL verification procedure
    const { data: rpcResult, error: rpcError } = await adminClient.rpc("verify_ledger");

    if (!rpcError && rpcResult) {
      if (rpcResult.ok) {
        return NextResponse.json({
          ok: true,
          entriesVerified: Number(rpcResult.entries_verified ?? 0),
          latestEntryHash: latestHash,
        });
      }

      return NextResponse.json({
        ok: false,
        brokenSequence: Number(rpcResult.broken_sequence),
        reason: rpcResult.reason,
        latestEntryHash: latestHash,
      });
    }

    // 3. Fallback: verification via TypeScript library
    const { data: entries, error: fetchError } = await adminClient
      .from("ledger_entries")
      .select("*")
      .order("sequence_number", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: "Could not read ledger entries." }, { status: 500 });
    }

    const verification = verifyLedgerChain((entries as LedgerEntry[]) ?? []);

    if (!verification.ok) {
      return NextResponse.json({
        ok: false,
        brokenSequence: verification.brokenSequence,
        reason: verification.reason,
        latestEntryHash: latestHash,
      });
    }

    return NextResponse.json({
      ok: true,
      entriesVerified: verification.entriesVerified,
      latestEntryHash: latestHash,
    });
  } catch (err) {
    console.error("audit verify route error:", err);
    return NextResponse.json({ error: "Ledger verification failed." }, { status: 500 });
  }
}
