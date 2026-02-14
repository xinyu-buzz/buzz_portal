import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { AdminPortal } from "./AdminPortal";

// Mock role utilities
vi.mock("../shared/role", () => ({
  getPortalLabel: (role: string) => {
    if (role === "admin" || role === "owner") return "Admin Portal";
    return "Buzz Portal";
  },
  useResolvedRole: () => ({
    role: "admin",
    loading: false,
    refresh: vi.fn(),
  }),
}));

// Mock PortalLayout to just render children with brand
vi.mock("../shared/PortalLayout", () => ({
  PortalLayout: ({ brand, links, children }: any) => (
    <div data-testid="portal-layout">
      <span data-testid="brand">{brand}</span>
      <nav>
        {links.map((l: any) => (
          <a key={l.to} href={l.to}>
            {l.label}
          </a>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  ),
}));

// Mock all child route components
vi.mock("./AdminDashboard", () => ({
  AdminDashboard: () => <div data-testid="admin-dashboard">Dashboard</div>,
}));
vi.mock("./AdminCenter", () => ({
  AdminCenter: () => <div>Admin Center</div>,
}));
vi.mock("./NewAccountsList", () => ({
  NewAccountsList: () => <div>New Accounts</div>,
}));
vi.mock("./Newsletter", () => ({
  Newsletter: () => <div>Newsletter</div>,
}));
vi.mock("./AcademyCourses", () => ({
  AcademyCourses: () => <div>Academy Courses</div>,
}));
vi.mock("./AcademyTestResults", () => ({
  AcademyTestResults: () => <div>Test Results</div>,
}));
vi.mock("./AcademyEnrollment", () => ({
  AcademyEnrollment: () => <div>Enrollment</div>,
}));
vi.mock("./AcademyManager", () => ({
  AcademyManager: () => <div>Academy Manager</div>,
}));
vi.mock("./CourseUnitsManager", () => ({
  CourseUnitsManager: () => <div>Course Units</div>,
}));
vi.mock("./RecycleBin", () => ({
  RecycleBin: () => <div>Recycle Bin</div>,
}));
vi.mock("../shared/bookings/BookingList", () => ({
  BookingList: () => <div>Booking List</div>,
}));
vi.mock("../shared/bookings/BookingShow", () => ({
  BookingShow: () => <div>Booking Show</div>,
}));
vi.mock("../shared/bookings/IncidentLogList", () => ({
  IncidentLogList: () => <div>Incident Logs</div>,
}));
vi.mock("../shared/bookings/FlightPlanList", () => ({
  FlightPlanList: () => <div>Flight Plans</div>,
}));

describe("AdminPortal", () => {
  it("renders with Admin Portal brand", () => {
    render(<AdminPortal />, { initialEntries: ["/admin"] });

    expect(screen.getByTestId("brand")).toHaveTextContent("Admin Portal");
  });

  it("renders navigation links", () => {
    render(<AdminPortal />, { initialEntries: ["/admin"] });

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("New Accounts")).toBeInTheDocument();
    expect(screen.getByText("Bookings")).toBeInTheDocument();
    expect(screen.getByText("Admin Center")).toBeInTheDocument();
    expect(screen.getByText("Academy Courses")).toBeInTheDocument();
    expect(screen.getByText("Academy Manager")).toBeInTheDocument();
    expect(screen.getByText("Newsletter")).toBeInTheDocument();
  });

  it("has dashboard link pointing to /admin/dashboard", () => {
    render(<AdminPortal />, { initialEntries: ["/admin"] });

    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink).toHaveAttribute("href", "/admin/dashboard");
  });

  it("renders the portal layout wrapper", () => {
    render(<AdminPortal />, { initialEntries: ["/admin"] });

    expect(screen.getByTestId("portal-layout")).toBeInTheDocument();
  });
});
