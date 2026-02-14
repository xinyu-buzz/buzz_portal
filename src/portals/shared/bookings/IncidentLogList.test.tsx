import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../test/test-utils";
import { IncidentLogList } from "./IncidentLogList";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "booking-789" }),
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
  },
}));

const sampleLogs = [
  {
    id: "il1",
    booking_id: "booking-789",
    pilot_id: "pilot-1",
    name: "John Doe",
    phone_number: "555-0100",
    date_of_incident: "2025-07-10T15:30:00Z",
    date_of_report: "2025-07-10T18:00:00Z",
    job_title: "Lead Pilot",
    operation_name: "Survey Op Alpha",
    organization: "Buzz Aviation",
    pic: "John Doe",
    region: "Northeast",
    airspace_class: "G",
    reported_to_police: false,
    reported_to_atc: true,
    location_of_incident: "Central Park, NY",
    description_of_incident: "Minor drone malfunction during flight",
    name_of_witness: "Jane Smith",
    signature_data: "data:image/png;base64,abc123",
    signature_date: "2025-07-10T18:30:00Z",
    created_at: "2025-07-10T18:30:00Z",
    is_locked: true,
    profiles: { email: "john@example.com", call_sign: "EAGLE1" },
  },
  {
    id: "il2",
    booking_id: "booking-789",
    pilot_id: "pilot-2",
    name: "Jane Smith",
    phone_number: "555-0200",
    date_of_incident: "2025-07-12T09:00:00Z",
    date_of_report: "2025-07-12T11:00:00Z",
    job_title: null,
    operation_name: null,
    organization: null,
    pic: null,
    region: null,
    airspace_class: null,
    reported_to_police: true,
    reported_to_atc: false,
    location_of_incident: "Brooklyn Bridge",
    description_of_incident: "Near-miss with a bird during ascent",
    name_of_witness: null,
    signature_data: "data:image/png;base64,def456",
    signature_date: "2025-07-12T11:30:00Z",
    created_at: "2025-07-12T11:30:00Z",
    is_locked: false,
    profiles: { email: "jane@example.com", call_sign: "HAWK2" },
  },
];

describe("IncidentLogList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Incident Logs heading", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Incident Logs" })
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no incident logs exist", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No incident logs have been submitted for this booking."
        )
      ).toBeInTheDocument();
    });
  });

  it("renders Back to Booking button", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(screen.getByText(/Back to Booking/)).toBeInTheDocument();
    });
  });

  it("renders incident log cards with pilot names", async () => {
    const transformedLogs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(
      createMockChain({ data: transformedLogs, error: null })
    );

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(
        screen.getByText(/Incident Report by EAGLE1/)
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Incident Report by HAWK2/)).toBeInTheDocument();
  });

  it("displays incident location for each log", async () => {
    const logs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: logs, error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(screen.getByText(/Central Park, NY/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Brooklyn Bridge/)).toBeInTheDocument();
  });

  it("displays incident descriptions", async () => {
    const logs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: logs, error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(
        screen.getByText("Minor drone malfunction during flight")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Near-miss with a bird during ascent")
    ).toBeInTheDocument();
  });

  it("displays Locked status badge for locked logs", async () => {
    const logs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: logs, error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(screen.getByText("Locked")).toBeInTheDocument();
    });
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders View Details button for each log", async () => {
    const logs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: logs, error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      const buttons = screen.getAllByText("View Details");
      expect(buttons).toHaveLength(2);
    });
  });

  it("shows error message when fetch fails", async () => {
    mockFrom.mockReturnValue(
      createMockChain({ data: null, error: { message: "Fetch failed" } })
    );

    render(<IncidentLogList />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load incident logs.")
      ).toBeInTheDocument();
    });
  });

  it("displays incident date for each log", async () => {
    const logs = sampleLogs.map((log) => ({
      ...log,
      pilot_email: log.profiles?.email,
      pilot_call_sign: log.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: logs, error: null }));

    render(<IncidentLogList />);

    await waitFor(() => {
      const incidentDateLabels = screen.getAllByText(/Incident Date:/);
      expect(incidentDateLabels).toHaveLength(2);
    });
  });
});
