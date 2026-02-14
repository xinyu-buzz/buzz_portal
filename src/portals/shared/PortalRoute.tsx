import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { PortalRole } from "./role";
import { PERMISSION_ERROR_MESSAGE, useResolvedRole } from "./role";

type PortalRouteProps = {
  allowed: PortalRole[];
  children: ReactNode;
  redirectTo?: string;
  busyFallback?: ReactNode;
};

/**
 * Client-side route guard — controls UI access only.
 * useResolvedRole validates the role against the server, but actual data-level
 * authorization is enforced by Supabase RLS policies, not this component.
 */
export const PortalRoute = ({
  allowed,
  children,
  redirectTo = "/login",
  busyFallback,
}: PortalRouteProps) => {
  const { role, loading } = useResolvedRole({ fallbackToFirst: false });

  if (loading) {
    return (
      busyFallback ?? (
        <div className="page-shell">
          <p>Loading portal...</p>
        </div>
      )
    );
  }

  if (!role || !allowed.includes(role)) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ error: PERMISSION_ERROR_MESSAGE }}
      />
    );
  }

  return <>{children}</>;
};


