import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { IncidentLogList } from "../shared/bookings/IncidentLogList";
import { FlightPlanList } from "../shared/bookings/FlightPlanList";
import { AdminDashboard } from "./AdminDashboard";
import { AdminCenter } from "./AdminCenter";
import { NewAccountsList } from "./NewAccountsList";
import { Newsletter } from "./Newsletter";
import { AcademyCourses } from "./AcademyCourses";
import { AcademyTestResults } from "./AcademyTestResults";
import { AcademyEnrollment } from "./AcademyEnrollment";
import { AcademyManager } from "./AcademyManager";
import { CourseUnitsManager } from "./CourseUnitsManager";
import { RecycleBin } from "./RecycleBin";
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
        { to: "/admin/academy-courses", label: "Academy Courses" },
        { to: "/admin/academy-manager", label: "Academy Manager" },
        { to: "/admin/newsletter", label: "Newsletter" },
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
        <Route
          path="bookings/:id/incident-logs"
          element={<IncidentLogList />}
        />
        <Route
          path="bookings/:id/flight-plans"
          element={<FlightPlanList />}
        />
        <Route path="admin-center" element={<AdminCenter />} />
        <Route path="academy-courses" element={<AcademyCourses />} />
        <Route path="academy-courses/:courseId/units" element={<CourseUnitsManager />} />
        <Route path="academy-manager" element={<AcademyManager />} />
        <Route path="academy-enrollment" element={<AcademyEnrollment />} />
        <Route path="academy-test-results" element={<AcademyTestResults />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
        <Route path="newsletter" element={<Newsletter />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </PortalLayout>
  );
};




