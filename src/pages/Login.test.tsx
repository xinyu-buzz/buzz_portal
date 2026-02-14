import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../test/test-utils";
import { LoginPage } from "./Login";

// Mock supabaseClient
const mockSignInWithPassword = vi.fn().mockResolvedValue({
  data: { user: null, session: null },
  error: null,
});

vi.mock("../utility/supabaseClient", () => ({
  supabaseClient: {
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
    },
  },
}));

// Mock role utilities
const mockValidatePortalSelection = vi.fn().mockResolvedValue({
  role: "pilot",
  available: ["pilot"],
  error: null,
});

vi.mock("../portals/shared/role", () => ({
  PERMISSION_ERROR_MESSAGE: "You do not have the permission to enter the portal you have chosen.",
  portalBasePath: (role: string) => {
    if (role === "admin" || role === "owner") return "/admin";
    if (role === "pilot") return "/pilot";
    if (role === "editor") return "/editor";
    if (role === "client") return "/client";
    return "/login";
  },
  validatePortalSelection: (...args: unknown[]) =>
    mockValidatePortalSelection(...args),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: "/login", search: "", hash: "", key: "default" }),
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders role selection radio buttons", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/admin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pilot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/editor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
  });

  it("defaults to pilot role selected", () => {
    render(<LoginPage />);

    const pilotRadio = screen.getByRole("radio", { name: /pilot/i });
    expect(pilotRadio).toBeChecked();
  });

  it("allows typing in email and password fields", async () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    expect(emailInput).toHaveValue("test@example.com");
    expect(passwordInput).toHaveValue("password123");
  });

  it("allows selecting different roles", () => {
    render(<LoginPage />);

    const adminRadio = screen.getByRole("radio", { name: /admin/i });
    fireEvent.click(adminRadio);

    expect(adminRadio).toBeChecked();
  });

  it("shows the correct portal label and subhead for pilot", () => {
    render(<LoginPage />);

    expect(screen.getByText("Pilot Portal")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your pilot account")).toBeInTheDocument();
  });

  it("updates portal label when role changes", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
    expect(screen.getByText("Sign in to the admin portal")).toBeInTheDocument();
  });

  it("renders remember me checkbox and forgot password link", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it("submits form and calls signInWithPassword", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "123" }, session: {} },
      error: null,
    });
    mockValidatePortalSelection.mockResolvedValueOnce({
      role: "pilot",
      available: ["pilot"],
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("shows error when sign in fails", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });

  it("navigates to portal on successful login", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "123" }, session: {} },
      error: null,
    });
    mockValidatePortalSelection.mockResolvedValueOnce({
      role: "pilot",
      available: ["pilot"],
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/pilot");
    });
  });

  it("restores saved email from localStorage", () => {
    localStorage.setItem("buzz_portal_email", "saved@example.com");

    render(<LoginPage />);

    expect(screen.getByLabelText(/email address/i)).toHaveValue("saved@example.com");
  });

  it("shows 'Signing in...' while loading", async () => {
    // Make signIn hang to check loading state
    mockSignInWithPassword.mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });
  });
});
