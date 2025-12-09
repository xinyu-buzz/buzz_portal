import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { AdminDashboard } from "./AdminDashboard";
import { AdminCenter } from "./AdminCenter";
import { NewAccountsList } from "./NewAccountsList";
import { getPortalLabel, useResolvedRole } from "../shared/role";
import type { PortalRole } from "../shared/role";

export const AdminPortal = () => {
  const { role } = useResolvedRole();
  const effectiveRole: PortalRole = role ?? "admin";
  const brand = getPortalLabel(effectiveRole);

  return (
    <PortalLayout
      brand={brand}
      links={[
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/profiles", label: "New Accounts" },
        { to: "/admin/bookings", label: "Bookings" },
        { to: "/admin/admin-center", label: "Admin Center" },
      ]}
    >
      <Routes>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard role={effectiveRole} />} />
        <Route path="profiles" element={<NewAccountsList />} />
        <Route
          path="bookings"
          element={<BookingList basePath="/admin" role={effectiveRole} />}
        />
        <Route
          path="bookings/:id"
          element={<BookingShow basePath="/admin" role={effectiveRole} />}
        />
        <Route path="admin-center" element={<AdminCenter />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </PortalLayout>
  );
};


