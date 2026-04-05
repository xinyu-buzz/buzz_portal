import { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "./utility";

const isBuzzEmail = (email?: string | null) =>
  typeof email === "string" && email.toLowerCase().endsWith("@buzzbuzzin.com");

const VALID_PORTAL_ROLES = ["admin", "owner", "pilot", "editor", "client"] as const;

const mapProfileUserTypeToRole = (userType?: string | null) => {
  if (userType === "pilot") return "pilot";
  if (userType === "customer") return "client";
  return null;
};

const authProvider: AuthProvider = {
  login: async ({ email, password, providerName }) => {
    // sign in with oauth
    try {
      if (providerName) {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
          provider: providerName,
        });

        if (error) {
          return {
            success: false,
            error,
          };
        }
        // OAuth will be validated in check(); proceed to redirect
        if (data?.url) {
          return {
            success: true,
            redirectTo: "/",
          };
        }
      }

      // sign in with email and password
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data?.user) {
        // Fetch employee role to persist locally (used by UI routing/labels)
        if (isBuzzEmail(data.user.email)) {
          const { data: emp } = await supabaseClient
            .from("employee_profiles")
            .select("role")
            .eq("email", data.user.email?.toLowerCase() || "")
            .maybeSingle();
          if (emp?.role) {
            localStorage.setItem("buzz_portal_role", emp.role);
          }
        }

        return {
          success: true,
          redirectTo: "/",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: false,
      error: {
        message: "Login failed",
        name: "Invalid email or password",
      },
    };
  },
  register: async ({ email, password }) => {
    try {
      if (!isBuzzEmail(email)) {
        return {
          success: false,
          error: {
            message: "Registration restricted to @buzzbuzzin.com accounts.",
            name: "Invalid email domain",
          },
        };
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data) {
        return {
          success: true,
          redirectTo: "/",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: false,
      error: {
        message: "Register failed",
        name: "Invalid email or password",
      },
    };
  },
  forgotPassword: async ({ email }) => {
    try {
      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/update-password`,
        }
      );

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data) {
        return {
          success: true,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: false,
      error: {
        message: "Forgot password failed",
        name: "Invalid email",
      },
    };
  },
  updatePassword: async ({ password }) => {
    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data) {
        return {
          success: true,
          redirectTo: "/",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error,
      };
    }
    return {
      success: false,
      error: {
        message: "Update password failed",
        name: "Invalid password",
      },
    };
  },
  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      redirectTo: "/",
    };
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
  check: async () => {
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const { session } = sessionData;

      if (!session) {
        return {
          authenticated: false,
          error: {
            message: "Check failed",
            name: "Session not found",
          },
          logout: true,
          redirectTo: "/login",
        };
      }

      const userEmail = session.user.email;

      // Non-buzzbuzzin emails are allowed if the user has a valid portal role
      // (e.g. pilots or clients using personal email addresses).
      // The buzzbuzzin.com restriction only applies to users with no portal role.
      if (!isBuzzEmail(userEmail)) {
        // Validate role against the database — never trust localStorage alone.
        const userId = session.user.id;

        // Check employee_profiles first (admin/owner/editor roles)
        const { data: emp } = await supabaseClient
          .from("employee_profiles")
          .select("role")
          .eq("email", userEmail?.toLowerCase() || "")
          .maybeSingle();

        // Then check profiles for pilot/client roles
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("user_type")
          .eq("id", userId)
          .maybeSingle();

        const dbRole = emp?.role || mapProfileUserTypeToRole(profile?.user_type);

        if (!dbRole || !VALID_PORTAL_ROLES.includes(dbRole)) {
          await supabaseClient.auth.signOut();
          localStorage.removeItem("buzz_portal_role");
          return {
            authenticated: false,
            error: {
              message: "Access restricted. Please sign in with the correct portal role.",
              name: "Invalid email domain",
            },
            logout: true,
            redirectTo: "/login",
          };
        }

        // Keep localStorage in sync for UI routing, but DB is the source of truth
        localStorage.setItem("buzz_portal_role", dbRole);
      }
    } catch (error: any) {
      return {
        authenticated: false,
        error: error || {
          message: "Check failed",
          name: "Not authenticated",
        },
        logout: true,
        redirectTo: "/login",
      };
    }

    return {
      authenticated: true,
    };
  },
  getPermissions: async () => {
    const user = await supabaseClient.auth.getUser();

    if (user) {
      return user.data.user?.role;
    }

    return null;
  },
  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser();

    if (data?.user) {
      return {
        ...data.user,
        name: data.user.email,
      };
    }

    return null;
  },
};

export default authProvider;
