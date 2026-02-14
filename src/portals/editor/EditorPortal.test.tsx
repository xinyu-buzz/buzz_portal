import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { EditorPortal } from "./EditorPortal";

vi.mock("../shared/role", () => ({
  getPortalLabel: (role: string) => {
    if (role === "editor") return "Editor Portal";
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

describe("EditorPortal", () => {
  it("renders with Editor Portal brand", () => {
    render(<EditorPortal />, { initialEntries: ["/editor"] });

    expect(screen.getByTestId("brand")).toHaveTextContent("Editor Portal");
  });

  it("renders Bookings navigation link", () => {
    render(<EditorPortal />, { initialEntries: ["/editor"] });

    expect(screen.getByText("Bookings")).toBeInTheDocument();
  });

  it("has link pointing to /editor/bookings", () => {
    render(<EditorPortal />, { initialEntries: ["/editor"] });

    const bookingsLink = screen.getByText("Bookings");
    expect(bookingsLink).toHaveAttribute("href", "/editor/bookings");
  });

  it("renders the portal layout", () => {
    render(<EditorPortal />, { initialEntries: ["/editor"] });

    expect(screen.getByTestId("portal-layout")).toBeInTheDocument();
  });
});
