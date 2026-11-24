import { describe, expect, it } from "vitest";
import {
  GENESIS_PREV_HASH,
  buildCanonicalLedgerString,
  computeLedgerEntryHash,
  formatLedgerTimestamp,
  hashUserId,
  verifyLedgerChain,
} from "@/lib/ledger";
import { calculatePaymentCharityShare, inPaise } from "@/lib/charity";
import type { LedgerEntry } from "@/types/database";

describe("hashUserId", () => {
  const userId = "c1a93b48-3569-45ff-812e-d0fb0f07cb9b";

  it("produces a 64-character hex hash", () => {
    const hash = hashUserId(userId, "test_salt_123");
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it("is deterministic with the same salt", () => {
    const h1 = hashUserId(userId, "salt_a");
    const h2 = hashUserId(userId, "salt_a");
    expect(h1).toBe(h2);
  });

  it("produces different hashes with different salts", () => {
    const h1 = hashUserId(userId, "salt_a");
    const h2 = hashUserId(userId, "salt_b");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different users", () => {
    const otherId = "e5b83981-b516-43f9-ba2a-a92c4f69e6b3";
    const h1 = hashUserId(userId, "salt_a");
    const h2 = hashUserId(otherId, "salt_a");
    expect(h1).not.toBe(h2);
  });
});

describe("Canonical payload and hashing", () => {
  const sampleParams = {
    sequenceNumber: 1,
    contributionId: "00000000-0000-0000-0000-000000000001",
    userIdHash: "a".repeat(64),
    charityId: "11111111-1111-1111-1111-111111111111",
    amount: 99.8,
    createdAt: "2026-11-24T12:00:00.000Z",
    prevHash: GENESIS_PREV_HASH,
  };

  it("formats canonical string with pipe delimiter and 2 decimal places for amount", () => {
    const str = buildCanonicalLedgerString(sampleParams);
    expect(str).toBe(
      `1|00000000-0000-0000-0000-000000000001|${"a".repeat(64)}|11111111-1111-1111-1111-111111111111|99.80|2026-11-24T12:00:00.000Z|${GENESIS_PREV_HASH}`,
    );
  });

  it("normalizes Date objects into ISO string", () => {
    const d = new Date("2026-11-24T12:00:00.000Z");
    expect(formatLedgerTimestamp(d)).toBe("2026-11-24T12:00:00.000Z");
  });

  it("computes reproducible SHA-256 hash", () => {
    const hash1 = computeLedgerEntryHash(sampleParams);
    const hash2 = computeLedgerEntryHash(sampleParams);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe("verifyLedgerChain", () => {
  function makeChain(count: number): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    let prevHash = GENESIS_PREV_HASH;

    for (let seq = 1; seq <= count; seq++) {
      const contribId = `contrib-uuid-000${seq}`;
      const charityId = `charity-uuid-000${seq}`;
      const userIdHash = hashUserId(`user-${seq}`, "secret_salt");
      const amount = 50 * seq;
      const createdAt = new Date(Date.UTC(2026, 10, 24, 12, seq)).toISOString();

      const entryHash = computeLedgerEntryHash({
        sequenceNumber: seq,
        contributionId: contribId,
        userIdHash,
        charityId,
        amount,
        createdAt,
        prevHash,
      });

      entries.push({
        id: `ledger-uuid-000${seq}`,
        sequence_number: seq,
        contribution_id: contribId,
        user_id_hash: userIdHash,
        charity_id: charityId,
        amount,
        prev_hash: prevHash,
        entry_hash: entryHash,
        created_at: createdAt,
      });

      prevHash = entryHash;
    }

    return entries;
  }

  it("validates an empty chain as OK", () => {
    const result = verifyLedgerChain([]);
    expect(result.ok).toBe(true);
    expect(result.entriesVerified).toBe(0);
  });

  it("validates a healthy multi-block ledger chain", () => {
    const chain = makeChain(5);
    const result = verifyLedgerChain(chain);
    expect(result.ok).toBe(true);
    expect(result.entriesVerified).toBe(5);
  });

  it("detects a broken previous hash pointer", () => {
    const chain = makeChain(4);
    // Tamper with block 3's prev_hash
    chain[2].prev_hash = "f".repeat(64);

    const result = verifyLedgerChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenSequence).toBe(3);
    expect(result.reason).toBe("prev_hash_mismatch");
    expect(result.entriesVerified).toBe(2);
  });

  it("detects tampered entry data (amount altered)", () => {
    const chain = makeChain(4);
    // Maliciously alter contribution amount in block 2 without updating hash
    chain[1].amount = 99999;

    const result = verifyLedgerChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenSequence).toBe(2);
    expect(result.reason).toBe("entry_hash_tampered");
    expect(result.entriesVerified).toBe(1);
  });

  it("detects tampered charity id", () => {
    const chain = makeChain(3);
    chain[1].charity_id = "diverted-charity-id";

    const result = verifyLedgerChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenSequence).toBe(2);
    expect(result.reason).toBe("entry_hash_tampered");
  });

  it("detects sequence gap or missing entry", () => {
    const chain = makeChain(4);
    // Remove block 2
    chain.splice(1, 1);

    const result = verifyLedgerChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenSequence).toBe(3);
    expect(result.reason).toBe("sequence_gap");
    expect(result.entriesVerified).toBe(1);
  });
});

describe("Fee split and paise calculation", () => {
  it("calculates monthly plan charity share correctly", () => {
    // ₹499 monthly fee, 20% charity = 99.8
    expect(calculatePaymentCharityShare("monthly", 20)).toBe(99.8);
    // ₹499 monthly fee, 10% charity = 49.9
    expect(calculatePaymentCharityShare("monthly", 10)).toBe(49.9);
    // ₹499 monthly fee, 50% charity = 249.5
    expect(calculatePaymentCharityShare("monthly", 50)).toBe(249.5);
  });

  it("calculates yearly plan charity share correctly", () => {
    // ₹4999 yearly fee, 20% charity = 999.8
    expect(calculatePaymentCharityShare("yearly", 20)).toBe(999.8);
  });

  it("converts rupees to whole paise accurately", () => {
    expect(inPaise(99.8)).toBe(9980);
    expect(inPaise(49.9)).toBe(4990);
    expect(inPaise(999.8)).toBe(99980);
  });
});
