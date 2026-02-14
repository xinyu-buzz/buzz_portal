import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test/test-utils";
import { PortalRoute } from "./PortalRoute";

const mockUseResolvedRole = vi.fn();

vi.mock("./role", () => ({
  useResolvedRole: (...args: unknown[]) => mockUseResolvedRole(...args),
  PERMISSION_ERROR_MESSAGE:
    "You do not have the permission to enter the portal you have chosen. Please choose the correct portal.",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to, state }: { to: string; state?: unknown }) => (
      <div
        data-testid="navigate"
        data-to={to}
        data-state={JSON.stringify(state)}
      />
    ),
  };
});

describe("PortalRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows default loading fallback while role is resolving", () => {
    mockUseResolvedRole.mockReturnValue({ role: null, loading: true });

    render(
      <PortalRoute allowed={["admin"]}>
        <div>Admin content</div>
      </PortalRoute>
    );

    expect(screen.getByText("Loading portal...")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  it("shows custom busy fallback when provided", () => {
    mockUseResolvedRole.mockReturnValue({ role: null, loading: true });

    render(
      <PortalRoute allowed={["admin"]} busyFallback={<p>Please wait...</p>}>
        <div>Admin content</div>
      </PortalRoute>
    );

    expect(screen.getByText("Please wait...")).toBeInTheDocument();
    expect(screen.queryByText("Loading portal...")).not.toBeInTheDocument();
  });

  it("renders children when role is in the allowed list", () => {
    mockUseResolvedRole.mockReturnValue({ role: "admin", loading: false });

    render(
      <PortalRoute allowed={["admin", "owner"]}>
        <div>Admin content</div>
      </PortalRoute>
    );

    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });

  it("redirects to /login when role is not allowed", () => {
    mockUseResolvedRole.mockReturnValue({ role: "pilot", loading: false });

    render(
      <PortalRoute allowed={["admin"]}>
        <div>Admin content</div>
      </PortalRoute>
    );

    const nav = screen.getByTestId("navigate");
    expect(nav).toHaveAttribute("data-to", "/login");
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  it("redirects to custom path via redirectTo prop", () => {
    mockUseResolvedRole.mockReturnValue({ role: "pilot", loading: false });

    render(
      <PortalRoute allowed={["admin"]} redirectTo="/unauthorized">
        <div>Admin content</div>
      </PortalRoute>
    );

    const nav = screen.getByTestId("navigate");
    expect(nav).toHaveAttribute("data-to", "/unauthorized");
  });

  it("redirects when role is null (unauthenticated)", () => {
    mockUseResolvedRole.mockReturnValue({ role: null, loading: false });

    render(
      <PortalRoute allowed={["admin"]}>
        <div>Admin content</div>
      </PortalRoute>
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
  });

  it("passes permission error message in redirect state", () => {
    mockUseResolvedRole.mockReturnValue({ role: null, loading: false });

    render(
      <PortalRoute allowed={["admin"]}>
        <div>Admin content</div>
      </PortalRoute>
    );

    const nav = screen.getByTestId("navigate");
    const state = JSON.parse(nav.getAttribute("data-state") || "{}");
    expect(state.error).toContain("You do not have the permission");
  });
});
