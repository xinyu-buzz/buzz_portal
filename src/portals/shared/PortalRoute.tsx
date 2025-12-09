import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { PortalRole } from "./role";
import { useResolvedRole } from "./role";

type PortalRouteProps = {
  allowed: PortalRole[];
  children: ReactNode;
  redirectTo?: string;
  busyFallback?: ReactNode;
};

export const PortalRoute = ({
  allowed,
  children,
  redirectTo = "/login",
  busyFallback,
}: PortalRouteProps) => {
  const { role, loading } = useResolvedRole();

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
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};


