import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../test/test-utils";
import { Menu } from "./index";

const mockLogout = vi.fn();
const mockMenuItems = [
  { key: "dashboard", route: "/dashboard", label: "Dashboard" },
  { key: "bookings", route: "/bookings", label: "Bookings" },
];

vi.mock("@refinedev/core", () => ({
  useLogout: () => ({ mutate: mockLogout }),
  useMenu: () => ({ menuItems: mockMenuItems }),
}));

// Mock react-router's NavLink since it needs its own router context
vi.mock("react-router", () => ({
  NavLink: ({
    to,
    children,
  }: {
    to: string;
    children: React.ReactNode;
  }) => <a href={to}>{children}</a>,
}));

describe("Menu", () => {
  it("renders navigation menu items", () => {
    render(<Menu />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Bookings")).toBeInTheDocument();
  });

  it("renders menu items as links with correct routes", () => {
    render(<Menu />);

    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink.closest("a")).toHaveAttribute("href", "/dashboard");

    const bookingsLink = screen.getByText("Bookings");
    expect(bookingsLink.closest("a")).toHaveAttribute("href", "/bookings");
  });

  it("renders logout button", () => {
    render(<Menu />);

    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("calls logout when logout button is clicked", () => {
    render(<Menu />);

    fireEvent.click(screen.getByText("Logout"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("renders as a nav element", () => {
    render(<Menu />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
