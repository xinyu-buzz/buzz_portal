import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test/test-utils";
import userEvent from "@testing-library/user-event";
import { PortalLayout } from "./PortalLayout";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../utility", () => ({
  supabaseClient: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

describe("PortalLayout", () => {
  const defaultLinks = [
    { to: "/admin", label: "Dashboard" },
    { to: "/admin/bookings", label: "Bookings" },
    { to: "/admin/pilots", label: "Pilots" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders brand name", () => {
    render(
      <PortalLayout brand="Admin Portal" links={defaultLinks}>
        <div>Content</div>
      </PortalLayout>
    );

    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
  });

  it("renders all visible nav links", () => {
    render(
      <PortalLayout brand="Admin Portal" links={defaultLinks}>
        <div>Content</div>
      </PortalLayout>
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Bookings")).toBeInTheDocument();
    expect(screen.getByText("Pilots")).toBeInTheDocument();
  });

  it("renders children inside page-shell", () => {
    render(
      <PortalLayout brand="Admin Portal" links={defaultLinks}>
        <h2>My Page Content</h2>
      </PortalLayout>
    );

    expect(screen.getByText("My Page Content")).toBeInTheDocument();
  });

  it("hides links marked as hidden", () => {
    const links = [
      { to: "/admin", label: "Dashboard" },
      { to: "/admin/secret", label: "Secret Page", hidden: true },
    ];

    render(
      <PortalLayout brand="Admin Portal" links={links}>
        <div>Content</div>
      </PortalLayout>
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Secret Page")).not.toBeInTheDocument();
  });

  it("renders brand as a link to the first nav link destination", () => {
    render(
      <PortalLayout brand="Pilot Portal" links={[{ to: "/pilot", label: "Home" }]}>
        <div>Content</div>
      </PortalLayout>
    );

    const brandLink = screen.getByText("Pilot Portal");
    expect(brandLink.closest("a")).toHaveAttribute("href", "/pilot");
  });

  it("renders logout button", () => {
    render(
      <PortalLayout brand="Admin Portal" links={defaultLinks}>
        <div>Content</div>
      </PortalLayout>
    );

    expect(
      screen.getByRole("button", { name: "Logout" })
    ).toBeInTheDocument();
  });

  it("calls signOut and navigates to /login on logout click", async () => {
    const user = userEvent.setup();

    render(
      <PortalLayout brand="Admin Portal" links={defaultLinks}>
        <div>Content</div>
      </PortalLayout>
    );

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
