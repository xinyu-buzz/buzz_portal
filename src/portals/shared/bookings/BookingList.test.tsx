import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../test/test-utils";
import { BookingList } from "./BookingList";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Helper: creates a chainable Supabase query builder mock that resolves via await. */
function createMockChain(resolvedValue: { data: unknown; error: unknown } = { data: [], error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "eq", "neq", "in", "order", "limit",
    "insert", "update", "delete", "single", "maybeSingle",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockImplementation(() => chain);
  });
  // Make the chain thenable so `await chain` resolves to `resolvedValue`.
  chain.then = vi.fn().mockImplementation((resolve?: (v: unknown) => void) => {
    if (resolve) resolve(resolvedValue);
    return Promise.resolve(resolvedValue);
  });
  return chain;
}

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../../utility", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

describe("BookingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));
  });

  it("renders the Bookings heading", async () => {
    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bookings" })).toBeInTheDocument();
    });
  });

  it("renders table column headers", async () => {
    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("Location")).toBeInTheDocument();
    });
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("shows '+ New booking' button for admin role", async () => {
    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("+ New booking")).toBeInTheDocument();
    });
  });

  it("shows '+ New booking' button for owner role", async () => {
    render(<BookingList basePath="/admin" role="owner" />);

    await waitFor(() => {
      expect(screen.getByText("+ New booking")).toBeInTheDocument();
    });
  });

  it("does not show '+ New booking' for pilot role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "pilot-1" } },
      error: null,
    });

    render(<BookingList basePath="/pilot" role="pilot" />);

    await waitFor(() => {
      expect(screen.getByText("Bookings")).toBeInTheDocument();
    });
    expect(screen.queryByText("+ New booking")).not.toBeInTheDocument();
  });

  it("shows pilot-specific helper text for pilot role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "pilot-1" } },
      error: null,
    });

    render(<BookingList basePath="/pilot" role="pilot" />);

    await waitFor(() => {
      expect(
        screen.getByText("Click booking to upload your drone videos.")
      ).toBeInTheDocument();
    });
  });

  it("shows admin helper text for admin role", async () => {
    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(
        screen.getByText("Assign editors and manage media per booking.")
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no bookings", async () => {
    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getAllByText("No bookings yet.").length).toBeGreaterThan(0);
    });
  });

  it("renders booking rows with data", async () => {
    const mockBookings = [
      {
        id: "b1",
        location_name: "Downtown Rooftop",
        status: "available",
        scheduled_date: "2025-06-15T10:00:00Z",
        created_at: "2025-06-01T08:00:00Z",
        description: "Test booking",
      },
      {
        id: "b2",
        location_name: "City Park",
        status: "accepted",
        scheduled_date: null,
        created_at: "2025-06-02T09:00:00Z",
        description: "Another booking",
      },
    ];

    mockFrom.mockReturnValue(
      createMockChain({ data: mockBookings, error: null })
    );

    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getAllByText("Downtown Rooftop").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("City Park").length).toBeGreaterThan(0);
    expect(screen.getAllByText("available").length).toBeGreaterThan(0);
    expect(screen.getAllByText("accepted").length).toBeGreaterThan(0);
  });

  it("shows dash for null scheduled_date", async () => {
    const mockBookings = [
      {
        id: "b1",
        location_name: "Test Location",
        status: "available",
        scheduled_date: null,
        created_at: "2025-06-01T08:00:00Z",
        description: "Test",
      },
    ];

    mockFrom.mockReturnValue(
      createMockChain({ data: mockBookings, error: null })
    );

    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  it("renders an Open button for each booking", async () => {
    const mockBookings = [
      {
        id: "b1",
        location_name: "Place A",
        status: "available",
        scheduled_date: null,
        created_at: "2025-06-01T08:00:00Z",
        description: "Test",
      },
      {
        id: "b2",
        location_name: "Place B",
        status: "completed",
        scheduled_date: null,
        created_at: "2025-06-02T08:00:00Z",
        description: "Test",
      },
    ];

    mockFrom.mockReturnValue(
      createMockChain({ data: mockBookings, error: null })
    );

    render(<BookingList basePath="/admin" role="admin" />);

    await waitFor(() => {
      const openButtons = screen.getAllByText("Open");
      expect(openButtons).toHaveLength(2);
    });
  });

  it("loads pilot bookings using auth user id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "pilot-uuid-123" } },
      error: null,
    });

    const pilotBookings = [
      {
        id: "pb1",
        location_name: "Pilot Mission Site",
        status: "accepted",
        scheduled_date: "2025-07-01T14:00:00Z",
        created_at: "2025-06-20T08:00:00Z",
        description: "Pilot assignment",
      },
    ];

    mockFrom.mockReturnValue(
      createMockChain({ data: pilotBookings, error: null })
    );

    render(<BookingList basePath="/pilot" role="pilot" />);

    await waitFor(() => {
      expect(screen.getAllByText("Pilot Mission Site").length).toBeGreaterThan(0);
    });
  });
});
