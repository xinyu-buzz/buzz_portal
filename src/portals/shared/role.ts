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

export const PERMISSION_ERROR_MESSAGE =
  "You do not have the permission to enter the portal you have chosen. Please choose the correct portal.";

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

export type RoleValidationResult = {
  role: PortalRole | null;
  available: PortalRole[];
  error: string | null;
};

/**
 * Validate a specific portal selection. Does not silently fall back.
 * Stores the chosen role only when eligible.
 *
 * NOTE: The localStorage role ("buzz_portal_role") is used for UI routing only.
 * Supabase RLS policies are the actual security boundary for all data access.
 */
export const validatePortalSelection = async (
  selected: PortalRole | null
): Promise<RoleValidationResult> => {
  const available = await getAvailablePortalRoles();

  // Owners can enter the admin portal; treat their owner role as eligible for admin.
  if (selected === "admin" && available.includes("owner")) {
    localStorage.setItem("buzz_portal_role", "admin");
    return { role: "admin", available, error: null };
  }

  if (selected && available.includes(selected)) {
    localStorage.setItem("buzz_portal_role", selected);
    return { role: selected, available, error: null };
  }

  if (selected) {
    localStorage.removeItem("buzz_portal_role");
    return { role: null, available, error: PERMISSION_ERROR_MESSAGE };
  }

  const error =
    available.length === 0
      ? PERMISSION_ERROR_MESSAGE
      : null;

  return { role: null, available, error };
};

/**
 * Resolve the user's active portal role with optional fallback.
 * - If preferred/stored role is eligible, use it.
 * - Optionally fall back to first eligible role by priority.
 */
export const resolveUserRole = async (
  preferredRole?: PortalRole | null,
  options: { fallbackToFirst?: boolean } = { fallbackToFirst: true }
): Promise<PortalRole | null> => {
  const stored = localStorage.getItem("buzz_portal_role") as PortalRole | null;
  const desired = preferredRole ?? stored ?? null;

  const { role, available } = await validatePortalSelection(desired);
  if (role) {
    return role;
  }

  if (options.fallbackToFirst && available[0]) {
    localStorage.setItem("buzz_portal_role", available[0]);
    return available[0];
  }

  return null;
};

export const useResolvedRole = (
  options: { fallbackToFirst?: boolean } = { fallbackToFirst: true }
) => {
  const fallbackToFirst = options?.fallbackToFirst ?? true;
  const [role, setRole] = useState<PortalRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const resolved = await resolveUserRole(undefined, {
        fallbackToFirst,
      });
      if (!mounted) return;
      setRole(resolved);
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fallbackToFirst]);

  const refresh = async () => {
    setLoading(true);
    const resolved = await resolveUserRole(undefined, { fallbackToFirst });
    setRole(resolved);
    setLoading(false);
    return resolved;
  };

  return { role, loading, refresh };
};

