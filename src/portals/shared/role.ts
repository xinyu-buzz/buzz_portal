import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

export type PortalRole = "admin" | "owner" | "pilot" | "editor" | "client";

const rolePriority: PortalRole[] = ["owner", "admin", "editor", "pilot", "client"];

const uniq = (roles: PortalRole[]) => Array.from(new Set(roles));

const sortByPriority = (roles: PortalRole[]) =>
  uniq(roles).sort(
    (a, b) => rolePriority.indexOf(a) - rolePriority.indexOf(b)
  );

const normalizeEmail = (email?: string | null) => email?.toLowerCase() || null;

export const getPortalLabel = (role: PortalRole | null) => {
  if (role === "owner" || role === "admin") return "Admin Portal";
  if (role === "pilot") return "Pilot Portal";
  if (role === "editor") return "Editor Portal";
  if (role === "client") return "Client Portal";
  return "Buzz Portal";
};

export const portalBasePath = (role: PortalRole | null) => {
  if (role === "owner" || role === "admin") return "/admin";
  if (role === "pilot") return "/pilot";
  if (role === "editor") return "/editor";
  if (role === "client") return "/client";
  return "/login";
};

/**
 * Fetch all portal roles a user is eligible for.
 * Admin/editor roles come from employee_profiles; pilot/client from profiles.user_type.
 */
export const getAvailablePortalRoles = async (): Promise<PortalRole[]> => {
  const available: PortalRole[] = [];

  try {
    const { data } = await supabaseClient.auth.getUser();
    const userId = data?.user?.id;
    const email = normalizeEmail(data?.user?.email);

    if (email) {
      const { data: emp } = await supabaseClient
        .from("employee_profiles")
        .select("role")
        .eq("email", email)
        .maybeSingle();

      if (emp?.role === "owner" || emp?.role === "admin" || emp?.role === "editor") {
        available.push(emp.role as PortalRole);
      }
    }

    if (userId) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("user_type")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.user_type === "pilot") {
        available.push("pilot");
      }
      if (profile?.user_type === "customer") {
        available.push("client");
      }
    }
  } catch (err) {
    console.error("Failed to load available roles", err);
  }

  return sortByPriority(available);
};

/**
 * Resolve the user's active portal role, honoring a preferred role when valid.
 * Preference order:
 * 1) Preferred role (e.g., chosen at login) if user is eligible.
 * 2) Previously stored role if still eligible.
 * 3) First eligible role by priority.
 */
export const resolveUserRole = async (
  preferredRole?: PortalRole | null
): Promise<PortalRole | null> => {
  const stored = localStorage.getItem("buzz_portal_role") as PortalRole | null;
  const desired = preferredRole ?? stored ?? null;

  const available = await getAvailablePortalRoles();

  const resolved =
    (desired && available.includes(desired) && desired) ||
    available[0] ||
    null;

  if (resolved) {
    localStorage.setItem("buzz_portal_role", resolved);
  }

  return resolved;
};

export const useResolvedRole = () => {
  const [role, setRole] = useState<PortalRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const resolved = await resolveUserRole();
      if (!mounted) return;
      setRole(resolved);
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    const resolved = await resolveUserRole();
    setRole(resolved);
    setLoading(false);
    return resolved;
  };

  return { role, loading, refresh };
};

