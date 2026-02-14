import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { ClientPortal } from "./ClientPortal";

vi.mock("../shared/role", () => ({
  getPortalLabel: (role: string) => {
    if (role === "client") return "Client Portal";
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

describe("ClientPortal", () => {
  it("renders with Client Portal brand", () => {
    render(<ClientPortal />, { initialEntries: ["/client"] });

    expect(screen.getByTestId("brand")).toHaveTextContent("Client Portal");
  });

  it("renders Bookings navigation link", () => {
    render(<ClientPortal />, { initialEntries: ["/client"] });

    expect(screen.getByText("Bookings")).toBeInTheDocument();
  });

  it("has link pointing to /client/bookings", () => {
    render(<ClientPortal />, { initialEntries: ["/client"] });

    const bookingsLink = screen.getByText("Bookings");
    expect(bookingsLink).toHaveAttribute("href", "/client/bookings");
  });

  it("renders the portal layout", () => {
    render(<ClientPortal />, { initialEntries: ["/client"] });

    expect(screen.getByTestId("portal-layout")).toBeInTheDocument();
  });
});
