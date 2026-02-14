import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../test/test-utils";
import { BookingShow } from "./BookingShow";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "booking-123" }),
  };
});

vi.mock("../../../components/BookingMediaManager", () => ({
  BookingMediaManager: ({ uploaderRole }: { uploaderRole: string }) => (
    <div data-testid="media-manager">Media Manager ({uploaderRole})</div>
  ),
}));

/** Helper: creates a chainable Supabase query builder mock that resolves via await. */
function createMockChain(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "eq", "neq", "in", "order", "limit",
    "insert", "update", "delete", "single", "maybeSingle",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockImplementation(() => chain);
  });
  chain.then = vi.fn().mockImplementation((resolve?: (v: unknown) => void) => {
    if (resolve) resolve(resolvedValue);
    return Promise.resolve(resolvedValue);
  });
  return chain;
}

const mockFrom = vi.fn();

vi.mock("../../../utility", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  },
}));

const sampleBooking = {
  id: "booking-123",
  customer_id: "cust-1",
  location_name: "Downtown Rooftop",
  description: "Aerial photography of the downtown area",
  status: "accepted",
  scheduled_date: "2025-07-15T14:00:00Z",
  created_at: "2025-06-01T08:00:00Z",
  pilot_id: "pilot-1",
  location_lat: 40.7128,
  location_lng: -74.006,
  payment_amount: 500,
  specialization: "real_estate",
  estimated_flight_hours: 2,
  required_minimum_rank: 1,
  is_internal_test: false,
};

describe("BookingShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: first call returns booking, rest return empty arrays
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: sampleBooking, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValue(createMockChain({ data: [], error: null }));
  });

  it("renders booking heading and location name", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Booking" })).toBeInTheDocument();
    });
    expect(screen.getByText("Downtown Rooftop")).toBeInTheDocument();
  });

  it("renders booking status", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("accepted")).toBeInTheDocument();
    });
  });

  it("renders booking description", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(
        screen.getByText("Aerial photography of the downtown area")
      ).toBeInTheDocument();
    });
  });

  it("renders specialization", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("real_estate")).toBeInTheDocument();
    });
  });

  it("renders internal test status as No", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("No")).toBeInTheDocument();
    });
  });

  it("renders BookingMediaManager with correct uploader role", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByTestId("media-manager")).toBeInTheDocument();
    });
    expect(screen.getByText("Media Manager (system)")).toBeInTheDocument();
  });

  it("renders pilot uploader role for pilot", async () => {
    render(<BookingShow basePath="/pilot" role="pilot" />);

    await waitFor(() => {
      expect(screen.getByText("Media Manager (pilot)")).toBeInTheDocument();
    });
  });

  it("renders editor uploader role for editor", async () => {
    render(<BookingShow basePath="/editor" role="editor" />);

    await waitFor(() => {
      expect(screen.getByText("Media Manager (editor)")).toBeInTheDocument();
    });
  });

  it("shows admin action buttons for admin role on admin basePath", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("Flight Plans")).toBeInTheDocument();
    });
    expect(screen.getByText("Incident Logs")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("does not show admin action buttons for pilot role", async () => {
    render(<BookingShow basePath="/pilot" role="pilot" />);

    await waitFor(() => {
      expect(screen.getByText("Downtown Rooftop")).toBeInTheDocument();
    });
    expect(screen.queryByText("Flight Plans")).not.toBeInTheDocument();
    expect(screen.queryByText("Incident Logs")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("renders Pilots section heading", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("Pilots")).toBeInTheDocument();
    });
  });

  it("renders Editors section heading", async () => {
    render(<BookingShow basePath="/admin" role="admin" />);

    await waitFor(() => {
      expect(screen.getByText("Editors")).toBeInTheDocument();
    });
  });
});
