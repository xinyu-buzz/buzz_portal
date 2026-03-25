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
import { AppAnalytics } from "./AppAnalytics";
import { WebTraffic } from "./WebTraffic";
import { AcademyTraffic } from "./AcademyTraffic";
import { ExpressPromotions } from "./ExpressPromotions";
import { PilotManagement } from "./PilotManagement";
import { PilotAccounts } from "./PilotAccounts";
import { LicenseApprovalReview } from "./LicenseApprovalReview";
import { TicketManagement } from "./TicketManagement";
import { FlightHourClaimsReview } from "./FlightHourClaimsReview";
import { DisputeManagement } from "./DisputeManagement";
import { AdminInbox } from "./AdminInbox";
import { OutreachDashboard } from "./OutreachDashboard";
import { OutreachImport } from "./OutreachImport";
import { OutreachPilotDetail } from "./OutreachPilotDetail";
import { OutreachMessageReview } from "./OutreachMessageReview";
import { OutreachTemplates } from "./OutreachTemplates";
import { getPortalLabel, useResolvedRole } from "../shared/role";
import type { PortalRole } from "../shared/role";

export const AdminPortal = () => {
  const { role } = useResolvedRole();
  const effectiveRole: PortalRole = role ?? "admin";
  const brand = getPortalLabel(effectiveRole);

  return (
    <PortalLayout
      brand={brand}
      links={[{ to: "/admin/dashboard", label: "Dashboard" }]}
      dashboardLink={{ to: "/admin/dashboard", label: "Dashboard" }}
      rightSlot={<AdminInbox />}
      sections={[
        {
          label: "Operations",
          links: [
            { to: "/admin/profiles", label: "New Accounts" },
            { to: "/admin/bookings", label: "Bookings" },
          ],
        },
        {
          label: "Academy",
          links: [
            { to: "/admin/academy-courses", label: "Academy Courses" },
            { to: "/admin/academy-manager", label: "Academy Manager" },
          ],
        },
        {
          label: "Pilots",
          links: [
            { to: "/admin/pilot-management", label: "Pilot Management" },
            { to: "/admin/pilot-accounts", label: "Pilot Accounts" },
          ],
        },
        {
          label: "Communications",
          links: [
            { to: "/admin/newsletter", label: "Newsletter" },
          ],
        },
        {
          label: "Support",
          links: [
            { to: "/admin/tickets", label: "Bug Reports" },
            { to: "/admin/safety-reports", label: "Safety Reports" },
            { to: "/admin/disputes", label: "Dispute Reports" },
          ],
        },
        {
          label: "Growth",
          links: [
            { to: "/admin/outreach", label: "Outreach Dashboard" },
            { to: "/admin/outreach/import", label: "Import FAA Data" },
            { to: "/admin/outreach/messages", label: "Message Review" },
            { to: "/admin/outreach/templates", label: "Templates" },
          ],
        },
        {
          label: "System",
          links: [
            { to: "/admin/admin-center", label: "Admin Center" },
            { to: "/admin/app-analytics", label: "App Analytics" },
            { to: "/admin/web-traffic", label: "Web Traffic" },
            { to: "/admin/academy-traffic", label: "Academy Traffic" },
          ],
        },
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
        <Route path="pilot-management" element={<PilotManagement />} />
        <Route path="pilot-accounts" element={<PilotAccounts />} />
        <Route path="express-promotions" element={<ExpressPromotions />} />
        <Route path="flight-reviewer-applications" element={<LicenseApprovalReview roleType="flight_reviewer" />} />
        <Route path="roc-a-examiner-applications" element={<LicenseApprovalReview roleType="roc_a_examiner" />} />
        <Route path="flight-hour-claims" element={<FlightHourClaimsReview />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
        <Route path="newsletter" element={<Newsletter />} />
        <Route path="app-analytics" element={<AppAnalytics />} />
        <Route path="web-traffic" element={<WebTraffic />} />
        <Route path="academy-traffic" element={<AcademyTraffic />} />
        <Route path="tickets" element={<TicketManagement ticketType="bug" />} />
        <Route path="safety-reports" element={<TicketManagement ticketType="safety" />} />
        <Route path="disputes" element={<DisputeManagement />} />
        <Route path="outreach" element={<OutreachDashboard />} />
        <Route path="outreach/import" element={<OutreachImport />} />
        <Route path="outreach/pilots/:id" element={<OutreachPilotDetail />} />
        <Route path="outreach/messages" element={<OutreachMessageReview />} />
        <Route path="outreach/templates" element={<OutreachTemplates />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </PortalLayout>
  );
};


