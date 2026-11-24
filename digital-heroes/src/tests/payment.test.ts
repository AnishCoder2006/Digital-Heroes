import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "crypto";

// We will mock dependencies before importing the route
const mockGetUser = vi.fn();
const mockAdminRpc = vi.fn();
const mockAdminUpsert = vi.fn();
const mockAdminSelect = vi.fn();
const mockRazorpayFetch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockAdminRpc,
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockAdminSelect,
            }),
          }),
        };
      }
      if (table === "subscriptions" || table === "donation_records_enc" || table === "donation_search_index") {
        return {
          upsert: mockAdminUpsert,
        };
      }
      return {
        upsert: mockAdminUpsert,
      };
    },
  })),
}));

vi.mock("@/lib/razorpay", () => ({
  getRazorpay: vi.fn(() => ({
    orders: {
      fetch: mockRazorpayFetch,
    },
  })),
}));

vi.mock("@/lib/subscription", () => ({
  getSubscription: vi.fn(async (_sb, _userId) => null),
  addPeriod: vi.fn((base, _plan) => new Date(base.getTime() + 30 * 86400000)),
}));

import { POST } from "@/app/api/razorpay/verify/route";

describe("Payment verification and ledger idempotency (POST /api/razorpay/verify)", () => {
  const secret = "test_razorpay_secret_123";
  const orderId = "order_xyz123";
  const paymentId = "pay_abc789";
  const userId = "user-uuid-1111";
  const charityId = "charity-uuid-2222";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET = secret;
    process.env.LEDGER_SALT = "salt_for_tests";

    mockGetUser.mockResolvedValue({
      data: { user: { id: userId, email: "donor@test.com" } },
    });

    mockAdminSelect.mockResolvedValue({
      data: { charity_id: charityId, charity_percent: 20 },
    });

    mockRazorpayFetch.mockResolvedValue({
      id: orderId,
      amount: 49900,
      notes: { user_id: userId, plan: "monthly" },
    });

    mockAdminRpc.mockResolvedValue({
      data: {
        ok: true,
        already_processed: false,
        contribution_id: "contrib-1",
        ledger_id: "ledger-1",
        sequence_number: 1,
        entry_hash: "hash1",
        prev_hash: "0".repeat(64),
      },
      error: null,
    });

    mockAdminUpsert.mockResolvedValue({ error: null });
  });

  function makeSignature(oId: string, pId: string, s: string) {
    return crypto.createHmac("sha256", s).update(`${oId}|${pId}`).digest("hex");
  }

  it("returns 401 when user is not logged in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: "any",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Please log in first.");
  });

  it("returns 400 when HMAC signature does not match", async () => {
    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: "bad_signature_value",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Payment could not be verified.");
  });

  it("returns 403 when order notes do not match logged in user", async () => {
    mockRazorpayFetch.mockResolvedValueOnce({
      id: orderId,
      notes: { user_id: "different-user", plan: "monthly" },
    });

    const sig = makeSignature(orderId, paymentId, secret);
    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Order mismatch.");
  });

  it("atomically records contribution + ledger entry and activates subscription on valid payment", async () => {
    const sig = makeSignature(orderId, paymentId, secret);
    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.contributionId).toBe("contrib-1");
    expect(json.sequenceNumber).toBe(1);

    // Verify RPC was invoked with exact charity fee split (499 * 20% = 99.80)
    expect(mockAdminRpc).toHaveBeenCalledWith("record_charity_contribution_and_ledger", {
      p_payment_id: paymentId,
      p_order_id: orderId,
      p_charity_id: charityId,
      p_user_id: userId,
      p_amount: 99.8,
      p_user_id_hash: expect.any(String),
    });

    // Verify subscription upsert was called
    expect(mockAdminUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        plan: "monthly",
        status: "active",
        razorpay_subscription_id: orderId,
      }),
      { onConflict: "user_id" },
    );
  });

  it("enforces idempotency when payment was already recorded", async () => {
    mockAdminRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        already_processed: true,
        contribution_id: "contrib-1",
        ledger_id: "ledger-1",
        sequence_number: 1,
        entry_hash: "hash1",
      },
      error: null,
    });

    const sig = makeSignature(orderId, paymentId, secret);
    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
