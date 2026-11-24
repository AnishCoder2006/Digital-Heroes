import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAdminSelect = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      select: () => {
        if (table === "charities") {
          return {
            order: () => mockAdminSelect(table),
          };
        }
        return mockAdminSelect(table);
      },
    }),
  })),
}));

import { GET } from "@/app/api/audit/charities/route";

describe("Public Charity Audit Endpoint (GET /api/audit/charities)", () => {
  const charity1 = { id: "charity-1", name: "Bright Slates Foundation" };
  const charity2 = { id: "charity-2", name: "Green Roots Trust" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status 'ok' when ledger totals and contribution totals match exactly", async () => {
    mockAdminSelect.mockImplementation((table: string) => {
      if (table === "charities") {
        return Promise.resolve({ data: [charity1, charity2], error: null });
      }
      if (table === "charity_contributions") {
        return Promise.resolve({
          data: [
            { charity_id: "charity-1", amount: 49.90 },
            { charity_id: "charity-1", amount: 49.90 },
            { charity_id: "charity-2", amount: 100.00 },
          ],
          error: null,
        });
      }
      if (table === "ledger_entries") {
        return Promise.resolve({
          data: [
            { charity_id: "charity-1", amount: 49.90 },
            { charity_id: "charity-1", amount: 49.90 },
            { charity_id: "charity-2", amount: 100.00 },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.charities).toHaveLength(2);

    const c1 = json.charities.find((c: any) => c.id === "charity-1");
    expect(c1.name).toBe("Bright Slates Foundation");
    expect(c1.ledgerTotal).toBe(9980);       // (49.90 + 49.90) * 100 paise = 9980 paise
    expect(c1.contributionTotal).toBe(9980);
    expect(c1.status).toBe("ok");

    const c2 = json.charities.find((c: any) => c.id === "charity-2");
    expect(c2.ledgerTotal).toBe(10000);      // 100 * 100 paise
    expect(c2.contributionTotal).toBe(10000);
    expect(c2.status).toBe("ok");
  });

  it("flags status as 'mismatch' if ledger and contribution amounts diverge", async () => {
    mockAdminSelect.mockImplementation((table: string) => {
      if (table === "charities") {
        return Promise.resolve({ data: [charity1], error: null });
      }
      if (table === "charity_contributions") {
        return Promise.resolve({
          data: [{ charity_id: "charity-1", amount: 150.00 }],
          error: null,
        });
      }
      if (table === "ledger_entries") {
        // Discrepancy: ledger only records 100.00
        return Promise.resolve({
          data: [{ charity_id: "charity-1", amount: 100.00 }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.charities).toHaveLength(1);
    const c1 = json.charities[0];
    expect(c1.contributionTotal).toBe(15000);
    expect(c1.ledgerTotal).toBe(10000);
    expect(c1.status).toBe("mismatch");
  });

  it("handles empty tables gracefully with 0 paise totals", async () => {
    mockAdminSelect.mockImplementation((table: string) => {
      if (table === "charities") {
        return Promise.resolve({ data: [charity1], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.charities[0].ledgerTotal).toBe(0);
    expect(json.charities[0].contributionTotal).toBe(0);
    expect(json.charities[0].status).toBe("ok");
  });
});
