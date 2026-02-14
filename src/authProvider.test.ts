import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignInWithOAuth = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockDbFrom = vi.fn();

vi.mock("./utility", () => ({
  supabaseClient: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
    from: (...args: unknown[]) => mockDbFrom(...args),
  },
}));

import authProvider from "./authProvider";

describe("authProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("login", () => {
    it("signs in with OAuth provider", async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: { url: "https://oauth.example.com" },
        error: null,
      });

      const result = await authProvider.login({
        email: "",
        password: "",
        providerName: "google",
      });

      expect(result.success).toBe(true);
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: "google" });
    });

    it("returns error on OAuth failure", async () => {
      const error = { message: "OAuth failed", name: "OAuthError" };
      mockSignInWithOAuth.mockResolvedValue({ data: null, error });

      const result = await authProvider.login({
        email: "",
        password: "",
        providerName: "google",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it("signs in with email/password for buzz email", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { email: "user@buzzbuzzin.com" } },
        error: null,
      });

      mockDbFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
          }),
        }),
      });

      const result = await authProvider.login({
        email: "user@buzzbuzzin.com",
        password: "password",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/");
      expect(localStorage.getItem("buzz_portal_role")).toBe("admin");
    });

    it("rejects non-buzz email on password login", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { email: "user@gmail.com" } },
        error: null,
      });
      mockSignOut.mockResolvedValue({ error: null });

      const result = await authProvider.login({
        email: "user@gmail.com",
        password: "password",
      });

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("Invalid email domain");
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("returns error on signInWithPassword failure", async () => {
      const error = { message: "Invalid credentials", name: "AuthError" };
      mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error });

      const result = await authProvider.login({
        email: "user@buzzbuzzin.com",
        password: "wrong",
      });

      expect(result.success).toBe(false);
    });

    it("handles exception in login", async () => {
      mockSignInWithPassword.mockRejectedValue(new Error("network error"));

      const result = await authProvider.login({
        email: "user@buzzbuzzin.com",
        password: "pass",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("register", () => {
    it("rejects non-buzz email", async () => {
      const result = await authProvider.register!({
        email: "user@gmail.com",
        password: "pass",
      });

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("Invalid email domain");
    });

    it("registers with buzz email", async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { email: "user@buzzbuzzin.com" } },
        error: null,
      });

      const result = await authProvider.register!({
        email: "user@buzzbuzzin.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
    });

    it("returns error on signUp failure", async () => {
      const error = { message: "Already exists", name: "SignUpError" };
      mockSignUp.mockResolvedValue({ data: null, error });

      const result = await authProvider.register!({
        email: "user@buzzbuzzin.com",
        password: "pass",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("logout", () => {
    it("signs out successfully", async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const result = await authProvider.logout({});

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/");
    });

    it("returns error on sign out failure", async () => {
      const error = { message: "sign out failed", name: "Error" };
      mockSignOut.mockResolvedValue({ error });

      const result = await authProvider.logout({});

      expect(result.success).toBe(false);
    });
  });

  describe("check", () => {
    it("returns authenticated for buzz email session", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { email: "admin@buzzbuzzin.com" },
          },
        },
      });

      const result = await authProvider.check();

      expect(result.authenticated).toBe(true);
    });

    it("returns unauthenticated when no session", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      const result = await authProvider.check();

      expect(result.authenticated).toBe(false);
      expect(result.redirectTo).toBe("/login");
    });

    it("rejects non-buzz email in session", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { email: "user@gmail.com" },
          },
        },
      });
      mockSignOut.mockResolvedValue({ error: null });

      const result = await authProvider.check();

      expect(result.authenticated).toBe(false);
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("handles exception in check", async () => {
      mockGetSession.mockRejectedValue(new Error("network"));

      const result = await authProvider.check();

      expect(result.authenticated).toBe(false);
    });
  });

  describe("getPermissions", () => {
    it("returns user role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { role: "authenticated" } },
      });

      const result = await authProvider.getPermissions!();

      expect(result).toBe("authenticated");
    });

    it("returns null when no user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await authProvider.getPermissions!();

      expect(result).toBeUndefined();
    });
  });

  describe("getIdentity", () => {
    it("returns user identity with name set to email", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            email: "admin@buzzbuzzin.com",
            role: "authenticated",
          },
        },
      });

      const result = await authProvider.getIdentity!();

      expect(result).toMatchObject({
        email: "admin@buzzbuzzin.com",
        name: "admin@buzzbuzzin.com",
      });
    });

    it("returns null when no user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await authProvider.getIdentity!();

      expect(result).toBeNull();
    });
  });

  describe("onError", () => {
    it("returns the error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("something went wrong");

      const result = await authProvider.onError!(error);

      expect(result.error).toBe(error);
      consoleSpy.mockRestore();
    });
  });

  describe("forgotPassword", () => {
    it("sends reset email successfully", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const result = await authProvider.forgotPassword!({
        email: "user@buzzbuzzin.com",
      });

      expect(result.success).toBe(true);
    });

    it("returns error on failure", async () => {
      const error = { message: "not found", name: "Error" };
      mockResetPasswordForEmail.mockResolvedValue({ data: null, error });

      const result = await authProvider.forgotPassword!({
        email: "user@buzzbuzzin.com",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updatePassword", () => {
    it("updates password successfully", async () => {
      mockUpdateUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      const result = await authProvider.updatePassword!({
        password: "newpass123",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/");
    });

    it("returns error on failure", async () => {
      const error = { message: "weak password", name: "Error" };
      mockUpdateUser.mockResolvedValue({ data: null, error });

      const result = await authProvider.updatePassword!({
        password: "weak",
      });

      expect(result.success).toBe(false);
    });
  });
});
