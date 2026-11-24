import { describe, expect, it, vi, beforeEach } from "vitest";
import { encryptDonorData, generateSearchToken, type DonorData } from "@/lib/encryption";

const mockAuthorizeApiRole = vi.fn();
const mockIndexSelect = vi.fn();
const mockContribSelect = vi.fn();
const mockEncSelect = vi.fn();

vi.mock("@/lib/auth", () => ({
  authorizeApiRole: (roles: string[]) => mockAuthorizeApiRole(roles),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "donation_search_index") {
        return {
          select: () => ({
            in: mockIndexSelect,
          }),
        };
      }
      if (table === "charity_contributions") {
        return {
          select: () => ({
            in: () => ({
              order: mockContribSelect,
            }),
          }),
        };
      }
      if (table === "donation_records_enc") {
        return {
          select: () => ({
            in: mockEncSelect,
          }),
        };
      }
      return {};
    },
  })),
}));

import { GET } from "@/app/api/admin/donations/search/route";
import { NextResponse } from "next/server";

describe("Searchable Encrypted Donations API (GET /api/admin/donations/search)", () => {
  const sampleDonor: DonorData = {
    fullName: "Priya Sharma",
    email: "priya@example.com",
  };
  const encPayload = encryptDonorData(sampleDonor);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when caller is unauthenticated", async () => {
    mockAuthorizeApiRole.mockResolvedValue({
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Please log in first." }, { status: 401 }),
    });

    const req = new Request("http://localhost:3000/api/admin/donations/search?q=priya");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Please log in first.");
  });

  it("returns 403 when caller is a subscriber", async () => {
    mockAuthorizeApiRole.mockResolvedValue({
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Forbidden: insufficient permissions." }, { status: 403 }),
    });

    const req = new Request("http://localhost:3000/api/admin/donations/search?q=priya");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden: insufficient permissions.");
  });

  it("returns 400 when search query parameter 'q' is missing", async () => {
    mockAuthorizeApiRole.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { id: "admin-1", role: "admin" },
      response: null,
    });

    const req = new Request("http://localhost:3000/api/admin/donations/search");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("parameter is required");
  });

  it("successfully finds and decrypts matching records for an auditor", async () => {
    mockAuthorizeApiRole.mockResolvedValue({
      user: { id: "auditor-1" },
      profile: { id: "auditor-1", role: "auditor" },
      response: null,
    });

    // 1. Index match
    mockIndexSelect.mockResolvedValue({
      data: [{ contribution_id: "contrib-100" }],
      error: null,
    });

    // 2. Contributions match
    mockContribSelect.mockResolvedValue({
      data: [
        {
          id: "contrib-100",
          amount: 49.90,
          created_at: "2026-11-24T12:00:00.000Z",
          charities: { name: "Bright Slates Foundation" },
        },
      ],
      error: null,
    });

    // 3. Encrypted records match
    mockEncSelect.mockResolvedValue({
      data: [
        {
          contribution_id: "contrib-100",
          ciphertext: encPayload.ciphertext,
          nonce: encPayload.nonce,
        },
      ],
      error: null,
    });

    const req = new Request("http://localhost:3000/api/admin/donations/search?q=priya");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.query).toBe("priya");
    expect(json.count).toBe(1);
    expect(json.results).toHaveLength(1);

    const record = json.results[0];
    expect(record.contributionId).toBe("contrib-100");
    expect(record.donorName).toBe("Priya Sharma");
    expect(record.donorEmail).toBe("priya@example.com");
    expect(record.charity).toBe("Bright Slates Foundation");
    expect(record.amount).toBe(4990); // 49.90 INR in whole paise
    expect(record.date).toBe("2026-11-24T12:00:00.000Z");
  });

  it("gracefully flags tampered ciphertext without crashing the endpoint", async () => {
    mockAuthorizeApiRole.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { id: "admin-1", role: "admin" },
      response: null,
    });

    mockIndexSelect.mockResolvedValue({
      data: [{ contribution_id: "contrib-tampered" }],
      error: null,
    });

    mockContribSelect.mockResolvedValue({
      data: [
        {
          id: "contrib-tampered",
          amount: 50.00,
          created_at: "2026-11-24T12:00:00.000Z",
          charities: [{ name: "Open Doors Shelter" }],
        },
      ],
      error: null,
    });

    // Tampered ciphertext
    mockEncSelect.mockResolvedValue({
      data: [
        {
          contribution_id: "contrib-tampered",
          ciphertext: "deadbeef" + encPayload.ciphertext.slice(8),
          nonce: encPayload.nonce,
        },
      ],
      error: null,
    });

    const req = new Request("http://localhost:3000/api/admin/donations/search?q=open");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.results[0].donorName).toBe("[Decryption Failed - Tampered]");
  });
});
