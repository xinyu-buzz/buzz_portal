import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { Breadcrumb } from "./index";

const mockBreadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Bookings", href: "/bookings" },
  { label: "Details" },
];

vi.mock("@refinedev/core", () => ({
  useBreadcrumb: () => ({ breadcrumbs: mockBreadcrumbs }),
}));

// Mock react-router's Link since it needs its own router context
vi.mock("react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("Breadcrumb", () => {
  it("renders all breadcrumb items", () => {
    render(<Breadcrumb />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Bookings")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("renders breadcrumbs with href as links", () => {
    render(<Breadcrumb />);

    const homeLink = screen.getByText("Home");
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");

    const bookingsLink = screen.getByText("Bookings");
    expect(bookingsLink.closest("a")).toHaveAttribute("href", "/bookings");
  });

  it("renders breadcrumbs without href as spans", () => {
    render(<Breadcrumb />);

    const details = screen.getByText("Details");
    expect(details.tagName).toBe("SPAN");
    expect(details.closest("a")).toBeNull();
  });

  it("renders as a list", () => {
    render(<Breadcrumb />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
