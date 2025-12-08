import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

export type PortalRole = "admin" | "owner" | "pilot" | "editor" | "client";

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

export const resolveUserRole = async (): Promise<PortalRole | null> => {
  const stored = localStorage.getItem("buzz_portal_role") as PortalRole | null;
  let resolved: PortalRole | null = stored;

  try {
    const { data } = await supabaseClient.auth.getUser();
    const email = data?.user?.email?.toLowerCase();
    if (email) {
      const { data: emp } = await supabaseClient
        .from("employee_profiles")
        .select("role")
        .eq("email", email)
        .maybeSingle();
      if (emp?.role) {
        resolved = emp.role as PortalRole;
        localStorage.setItem("buzz_portal_role", emp.role);
      }
    }
  } catch (err) {
    console.error("Failed to resolve role", err);
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

