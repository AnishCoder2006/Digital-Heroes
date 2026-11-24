import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockContributionsSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === "charity_contributions") {
        return {
          select: () => ({
            eq: () => ({
              order: mockContributionsSelect,
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

import { GET } from "@/app/api/me/contributions/route";

describe("GET /api/me/contributions (User's Contributions Endpoint)", () => {
  const userId = "user-uuid-1111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the caller is unauthenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Please log in first.");
  });

  it("returns user contributions formatted in whole paise with charity and ledger hash", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: userId, email: "donor@test.com" } },
    });

    mockContributionsSelect.mockResolvedValueOnce({
      data: [
        {
          id: "contrib-uuid-1",
          amount: 99.8,
          created_at: "2026-11-24T12:00:00.000Z",
          razorpay_payment_id: "pay_123",
          charities: { name: "Bright Slates Foundation" },
          ledger_entries: {
            entry_hash: "a".repeat(64),
            sequence_number: 1,
          },
        },
        {
          id: "contrib-uuid-2",
          amount: 249.5,
          created_at: "2026-10-24T12:00:00.000Z",
          razorpay_payment_id: "pay_456",
          charities: { name: "Green Roots Trust" },
          ledger_entries: {
            entry_hash: "b".repeat(64),
            sequence_number: 2,
          },
        },
      ],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.contributions).toHaveLength(2);
    // 99.80 INR -> 9980 paise
    expect(json.contributions[0]).toEqual({
      id: "contrib-uuid-1",
      charity: "Bright Slates Foundation",
      amount: 9980,
      date: "2026-11-24T12:00:00.000Z",
      entryHash: "a".repeat(64),
      sequenceNumber: 1,
    });
    // 249.50 INR -> 24950 paise
    expect(json.contributions[1]).toEqual({
      id: "contrib-uuid-2",
      charity: "Green Roots Trust",
      amount: 24950,
      date: "2026-10-24T12:00:00.000Z",
      entryHash: "b".repeat(64),
      sequenceNumber: 2,
    });
  });

  it("handles empty contributions array cleanly", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: userId, email: "donor@test.com" } },
    });

    mockContributionsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contributions).toEqual([]);
  });
});
