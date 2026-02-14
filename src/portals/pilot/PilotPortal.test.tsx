import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { PilotPortal } from "./PilotPortal";

vi.mock("../shared/role", () => ({
  getPortalLabel: (role: string) => {
    if (role === "pilot") return "Pilot Portal";
    return "Buzz Portal";
  },
}));

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

vi.mock("../shared/bookings/BookingList", () => ({
  BookingList: ({ basePath, role }: any) => (
    <div data-testid="booking-list" data-role={role} data-base={basePath}>
      Booking List
    </div>
  ),
}));

vi.mock("../shared/bookings/BookingShow", () => ({
  BookingShow: () => <div>Booking Show</div>,
}));

describe("PilotPortal", () => {
  it("renders with Pilot Portal brand", () => {
    render(<PilotPortal />, { initialEntries: ["/pilot"] });

    expect(screen.getByTestId("brand")).toHaveTextContent("Pilot Portal");
  });

  it("renders Bookings navigation link", () => {
    render(<PilotPortal />, { initialEntries: ["/pilot"] });

    expect(screen.getByText("Bookings")).toBeInTheDocument();
  });

  it("has link pointing to /pilot/bookings", () => {
    render(<PilotPortal />, { initialEntries: ["/pilot"] });

    const bookingsLink = screen.getByText("Bookings");
    expect(bookingsLink).toHaveAttribute("href", "/pilot/bookings");
  });

  it("renders the portal layout", () => {
    render(<PilotPortal />, { initialEntries: ["/pilot"] });

    expect(screen.getByTestId("portal-layout")).toBeInTheDocument();
  });
});
