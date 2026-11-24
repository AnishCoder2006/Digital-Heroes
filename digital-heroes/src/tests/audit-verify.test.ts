import { describe, expect, it, vi, beforeEach } from "vitest";
import { GENESIS_PREV_HASH } from "@/lib/ledger";

const mockAdminRpc = vi.fn();
const mockAdminSelect = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockAdminRpc,
    from: (table: string) => {
      if (table === "ledger_entries") {
        return {
          select: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mockAdminSelect,
              }),
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

import { GET } from "@/app/api/audit/verify/route";

describe("GET /api/audit/verify (Public Audit Endpoint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok: true and latest entry hash on a healthy chain", async () => {
    const latestHash = "e".repeat(64);
    mockAdminSelect.mockResolvedValueOnce({
      data: { entry_hash: latestHash, sequence_number: 10 },
    });
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, entries_verified: 10 },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.entriesVerified).toBe(10);
    expect(json.latestEntryHash).toBe(latestHash);
  });

  it("returns ok: false and identifies broken sequence when tampering is detected", async () => {
    const latestHash = "f".repeat(64);
    mockAdminSelect.mockResolvedValueOnce({
      data: { entry_hash: latestHash, sequence_number: 5 },
    });
    mockAdminRpc.mockResolvedValueOnce({
      data: {
        ok: false,
        reason: "entry_hash_tampered",
        broken_sequence: 3,
      },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.brokenSequence).toBe(3);
    expect(json.reason).toBe("entry_hash_tampered");
    expect(json.latestEntryHash).toBe(latestHash);
  });

  it("returns default genesis hash when no ledger entries exist yet", async () => {
    mockAdminSelect.mockResolvedValueOnce({
      data: null,
    });
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, entries_verified: 0 },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.entriesVerified).toBe(0);
    expect(json.latestEntryHash).toBe(GENESIS_PREV_HASH);
  });
});
