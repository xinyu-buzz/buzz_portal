import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPortalLabel,
  portalBasePath,
  PERMISSION_ERROR_MESSAGE,
} from "./role";

// Mock supabase client used by role.ts (imported via ../../utility)
// vi.hoisted ensures these are available when the hoisted vi.mock factory runs
const { mockFrom, mockAuth } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAuth: {
    getUser: vi.fn(),
  },
}));

vi.mock("../../utility", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: mockAuth,
  },
}));

describe("getPortalLabel", () => {
  it("returns Admin Portal for owner", () => {
    expect(getPortalLabel("owner")).toBe("Admin Portal");
  });

  it("returns Admin Portal for admin", () => {
    expect(getPortalLabel("admin")).toBe("Admin Portal");
  });

  it("returns Pilot Portal for pilot", () => {
    expect(getPortalLabel("pilot")).toBe("Pilot Portal");
  });

  it("returns Editor Portal for editor", () => {
    expect(getPortalLabel("editor")).toBe("Editor Portal");
  });

  it("returns Client Portal for client", () => {
    expect(getPortalLabel("client")).toBe("Client Portal");
  });

  it("returns Buzz Portal for null", () => {
    expect(getPortalLabel(null)).toBe("Buzz Portal");
  });
});

describe("portalBasePath", () => {
  it("returns /admin for owner", () => {
    expect(portalBasePath("owner")).toBe("/admin");
  });

  it("returns /admin for admin", () => {
    expect(portalBasePath("admin")).toBe("/admin");
  });

  it("returns /pilot for pilot", () => {
    expect(portalBasePath("pilot")).toBe("/pilot");
  });

  it("returns /editor for editor", () => {
    expect(portalBasePath("editor")).toBe("/editor");
  });

  it("returns /client for client", () => {
    expect(portalBasePath("client")).toBe("/client");
  });

  it("returns /login for null", () => {
    expect(portalBasePath(null)).toBe("/login");
  });
});

describe("PERMISSION_ERROR_MESSAGE", () => {
  it("is a non-empty string", () => {
    expect(PERMISSION_ERROR_MESSAGE).toBeTruthy();
    expect(typeof PERMISSION_ERROR_MESSAGE).toBe("string");
  });
});

describe("getAvailablePortalRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin role when employee has admin role", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@buzzbuzzin.com" } },
    });

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
    };
    mockFrom.mockReturnValue(queryBuilder);

    const { getAvailablePortalRoles } = await import("./role");
    const roles = await getAvailablePortalRoles();

    expect(roles).toContain("admin");
  });

  it("returns pilot when profile user_type is pilot", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@buzzbuzzin.com" } },
    });

    // First call for employee_profiles, second for profiles
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { user_type: "pilot" } }),
      };
    });

    const { getAvailablePortalRoles } = await import("./role");
    const roles = await getAvailablePortalRoles();

    expect(roles).toContain("pilot");
  });

  it("returns empty array when user has no roles", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@buzzbuzzin.com" } },
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    const { getAvailablePortalRoles } = await import("./role");
    const roles = await getAvailablePortalRoles();

    expect(roles).toEqual([]);
  });

  it("returns empty array on error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuth.getUser.mockRejectedValue(new Error("network error"));

    const { getAvailablePortalRoles } = await import("./role");
    const roles = await getAvailablePortalRoles();

    expect(roles).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe("validatePortalSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("allows owner to enter admin portal", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "owner@buzzbuzzin.com" } },
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: "owner" } }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    });

    const { validatePortalSelection } = await import("./role");
    const result = await validatePortalSelection("admin");

    expect(result.role).toBe("admin");
    expect(result.error).toBeNull();
    expect(localStorage.getItem("buzz_portal_role")).toBe("admin");
  });

  it("returns error for unauthorized role", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "test@buzzbuzzin.com" } },
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    const { validatePortalSelection } = await import("./role");
    const result = await validatePortalSelection("admin");

    expect(result.role).toBeNull();
    expect(result.error).toBe(PERMISSION_ERROR_MESSAGE);
  });
});
