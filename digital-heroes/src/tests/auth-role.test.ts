import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockAdminSelect = vi.fn();
const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockAdminSelect,
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockAdminSelect,
        }),
      }),
    }),
  })),
}));

import { requireRole, requireAdmin, authorizeApiRole, authenticateApiUser } from "@/lib/auth";

describe("Workstream 3: Role and Auditor Authorization Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Action / Component requireRole guard", () => {
    it("redirects to /login if user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      await requireRole("auditor");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to /dashboard if subscriber attempts to access auditor role", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "user-1", role: "subscriber" } });

      await requireRole("auditor");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("allows auditor when auditor role is required", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "auditor-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "auditor-1", role: "auditor" } });

      const result = await requireRole("auditor");
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result.profile.role).toBe("auditor");
    });

    it("allows either admin or auditor when array of roles is passed", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "auditor-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "auditor-1", role: "auditor" } });

      const result = await requireRole(["admin", "auditor"]);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(result.profile.role).toBe("auditor");
    });

    it("requireAdmin restricts access strictly to admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "auditor-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "auditor-1", role: "auditor" } });

      await requireAdmin();
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("API Route authorization helper (authorizeApiRole)", () => {
    it("returns 401 when no session exists", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const auth = await authorizeApiRole(["admin", "auditor"]);
      expect(auth.response).not.toBeNull();
      expect(auth.response?.status).toBe(401);
      const json = await auth.response?.json();
      expect(json.error).toBe("Please log in first.");
    });

    it("returns 403 when user is a subscriber", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-sub" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "user-sub", role: "subscriber" } });

      const auth = await authorizeApiRole(["admin", "auditor"]);
      expect(auth.response).not.toBeNull();
      expect(auth.response?.status).toBe(403);
      const json = await auth.response?.json();
      expect(json.error).toBe("Forbidden: insufficient permissions.");
    });

    it("allows access for admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "admin-1", role: "admin" } });

      const auth = await authorizeApiRole(["admin", "auditor"]);
      expect(auth.response).toBeNull();
      expect(auth.profile?.role).toBe("admin");
    });

    it("allows access for auditor", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "auditor-1" } } });
      mockAdminSelect.mockResolvedValue({ data: { id: "auditor-1", role: "auditor" } });

      const auth = await authorizeApiRole(["admin", "auditor"]);
      expect(auth.response).toBeNull();
      expect(auth.profile?.role).toBe("auditor");
    });
  });
});
