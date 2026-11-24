import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CharityContribution, LedgerEntry } from "@/types/database";

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Computes a salted HMAC-SHA256 hash of a user ID for pseudonymized storage in the ledger.
 * The salt is kept server-side in LEDGER_SALT and never stored in the database.
 */
export function hashUserId(userId: string, salt?: string): string {
  const secret = salt ?? process.env.LEDGER_SALT ?? "digital_heroes_fallback_salt_for_dev";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

export interface CanonicalLedgerParams {
  sequenceNumber: number | bigint;
  contributionId: string;
  userIdHash: string;
  charityId: string;
  amount: number;
  createdAt: string | Date;
  prevHash: string;
}

/**
 * Normalizes a date/timestamp to standard ISO UTC string with millisecond precision
 * matching PostgreSQL's to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"').
 */
export function formatLedgerTimestamp(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Builds the canonical representation string over fixed fields and the previous hash.
 * Canonical format:
 * seq|contrib_id|user_id_hash|charity_id|amount_2dec|created_at_iso|prev_hash
 */
export function buildCanonicalLedgerString(params: CanonicalLedgerParams): string {
  const amountStr = Number(params.amount).toFixed(2);
  const timeStr = formatLedgerTimestamp(params.createdAt);
  return `${params.sequenceNumber}|${params.contributionId}|${params.userIdHash}|${params.charityId}|${amountStr}|${timeStr}|${params.prevHash}`;
}

/**
 * Computes the SHA-256 hash over the canonical string representation.
 */
export function computeLedgerEntryHash(params: CanonicalLedgerParams): string {
  const canonical = buildCanonicalLedgerString(params);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export interface VerifyLedgerResult {
  ok: boolean;
  entriesVerified: number;
  brokenSequence?: number;
  reason?: "sequence_gap" | "prev_hash_mismatch" | "entry_hash_tampered";
  expected?: string;
  actual?: string;
}

/**
 * Pure verification function that verifies the cryptographic integrity of an ordered ledger chain.
 * Checks:
 * 1. Monotonic sequence numbering starting from 1 with no gaps.
 * 2. Correct chain linking (prev_hash matches preceding entry_hash; genesis matches 64 zeros).
 * 3. Exact SHA-256 hash integrity for every entry against its canonical representation.
 */
export function verifyLedgerChain(entries: LedgerEntry[]): VerifyLedgerResult {
  let expectedPrevHash = GENESIS_PREV_HASH;
  let expectedSeq = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const seq = Number(entry.sequence_number);

    // 1. Sequence continuity check
    if (seq !== expectedSeq) {
      return {
        ok: false,
        entriesVerified: i,
        brokenSequence: seq,
        reason: "sequence_gap",
        expected: String(expectedSeq),
        actual: String(seq),
      };
    }

    // 2. Previous hash pointer check
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        ok: false,
        entriesVerified: i,
        brokenSequence: seq,
        reason: "prev_hash_mismatch",
        expected: expectedPrevHash,
        actual: entry.prev_hash,
      };
    }

    // 3. Hash integrity re-computation
    const computedHash = computeLedgerEntryHash({
      sequenceNumber: seq,
      contributionId: entry.contribution_id,
      userIdHash: entry.user_id_hash,
      charityId: entry.charity_id,
      amount: Number(entry.amount),
      createdAt: entry.created_at,
      prevHash: entry.prev_hash,
    });

    if (entry.entry_hash !== computedHash) {
      return {
        ok: false,
        entriesVerified: i,
        brokenSequence: seq,
        reason: "entry_hash_tampered",
        expected: computedHash,
        actual: entry.entry_hash,
      };
    }

    expectedPrevHash = entry.entry_hash;
    expectedSeq++;
  }

  return {
    ok: true,
    entriesVerified: entries.length,
  };
}

export interface RecordLedgerParams {
  paymentId: string;
  orderId?: string | null;
  charityId: string;
  userId: string;
  amount: number;
}

export interface RecordLedgerResult {
  ok: boolean;
  alreadyProcessed: boolean;
  contributionId?: string;
  ledgerId?: string;
  sequenceNumber?: number;
  entryHash?: string;
  prevHash?: string;
  error?: string;
}

/**
 * Invokes the atomic PostgreSQL transaction procedure record_charity_contribution_and_ledger.
 * Locks the latest entry, calculates prev_hash & entry_hash, and inserts both rows.
 * Enforces strict idempotency on paymentId.
 */
export async function recordContributionAndLedger(
  client: SupabaseClient,
  params: RecordLedgerParams,
): Promise<RecordLedgerResult> {
  const userIdHash = hashUserId(params.userId);

  const { data, error } = await client.rpc("record_charity_contribution_and_ledger", {
    p_payment_id: params.paymentId,
    p_order_id: params.orderId ?? null,
    p_charity_id: params.charityId,
    p_user_id: params.userId,
    p_amount: params.amount,
    p_user_id_hash: userIdHash,
  });

  if (error) {
    return {
      ok: false,
      alreadyProcessed: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    alreadyProcessed: Boolean(data?.already_processed),
    contributionId: data?.contribution_id,
    ledgerId: data?.ledger_id,
    sequenceNumber: data?.sequence_number,
    entryHash: data?.entry_hash,
    prevHash: data?.prev_hash,
  };
}
