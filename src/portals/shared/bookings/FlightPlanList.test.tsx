import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../test/test-utils";
import { FlightPlanList } from "./FlightPlanList";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "booking-456" }),
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
const mockStorageFrom = vi.fn().mockReturnValue({
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-pdf" },
    error: null,
  }),
});

vi.mock("../../../utility", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

const sampleFlightPlans = [
  {
    id: "fp1",
    booking_id: "booking-456",
    pilot_id: "pilot-1",
    pilot_name: "John Doe",
    pilot_license_number: "FAA-12345",
    call_sign: "EAGLE1",
    drone_manufacturer: "DJI",
    drone_model: "Mavic 3",
    drone_serial_number: "SN-001",
    drone_registration_number: "REG-001",
    takeoff_date_time: "2025-07-15T14:00:00Z",
    location: "Central Park, NY",
    latitude: 40.7829,
    longitude: -73.9654,
    regulatory_authority: "FAA",
    max_altitude_feet: 400,
    airspace_class: "G",
    laanc_grid_ceiling: null,
    laanc_authorization_status: "Auto-Approved",
    flight_over_people: false,
    flight_over_people_explanation: null,
    vlos_type: "VLOS",
    part107_compliant: true,
    part107_non_compliance_explanation: null,
    requires_waiver: false,
    waiver_safety_mitigations: null,
    waiver_operational_procedures: null,
    waiver_risk_analysis: null,
    certification_regulation: "14 CFR Part 107",
    signature_date: "2025-07-10T08:00:00Z",
    pdf_url: "flight-plans/fp1.pdf",
    generated_at: "2025-07-10T08:00:00Z",
    created_at: "2025-07-10T08:00:00Z",
    profiles: { email: "john@example.com", call_sign: "EAGLE1" },
  },
  {
    id: "fp2",
    booking_id: "booking-456",
    pilot_id: "pilot-2",
    pilot_name: "Jane Smith",
    pilot_license_number: null,
    call_sign: "HAWK2",
    drone_manufacturer: null,
    drone_model: null,
    drone_serial_number: null,
    drone_registration_number: null,
    takeoff_date_time: "2025-07-16T10:00:00Z",
    location: "Brooklyn Bridge",
    latitude: 40.7061,
    longitude: -73.9969,
    regulatory_authority: "FAA",
    max_altitude_feet: 200,
    airspace_class: "B",
    laanc_grid_ceiling: 200,
    laanc_authorization_status: "Pending",
    flight_over_people: true,
    flight_over_people_explanation: "Authorized for flyover",
    vlos_type: "BVLOS",
    part107_compliant: false,
    part107_non_compliance_explanation: "Requires waiver for BVLOS",
    requires_waiver: true,
    waiver_safety_mitigations: "Safety plan in place",
    waiver_operational_procedures: "Standard ops",
    waiver_risk_analysis: "Low risk assessment",
    certification_regulation: "14 CFR Part 107",
    signature_date: null,
    pdf_url: "flight-plans/fp2.pdf",
    generated_at: "2025-07-11T09:00:00Z",
    created_at: "2025-07-11T09:00:00Z",
    profiles: { email: "jane@example.com", call_sign: "HAWK2" },
  },
];

describe("FlightPlanList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Flight Plans heading", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Flight Plans" })
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no flight plans exist", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No flight plans have been created for this booking."
        )
      ).toBeInTheDocument();
    });
  });

  it("renders Back to Booking button", async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(
        screen.getByText(/Back to Booking/)
      ).toBeInTheDocument();
    });
  });

  it("renders flight plan cards with pilot names", async () => {
    const transformedPlans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(
      createMockChain({ data: transformedPlans, error: null })
    );

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(
        screen.getByText(/Flight Plan - John Doe/)
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Flight Plan - Jane Smith/)).toBeInTheDocument();
  });

  it("displays takeoff time for each flight plan", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      // The component formats takeoff_date_time with toLocaleString()
      // Look for the "Takeoff:" label which precedes the formatted time
      const takeoffElements = screen.getAllByText(/Takeoff:/);
      expect(takeoffElements).toHaveLength(2);
    });
  });

  it("displays location for each flight plan", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(screen.getByText(/Central Park, NY/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Brooklyn Bridge/)).toBeInTheDocument();
  });

  it("displays max altitude for each flight plan", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(screen.getByText(/400 ft AGL/)).toBeInTheDocument();
    });
    expect(screen.getByText(/200 ft AGL/)).toBeInTheDocument();
  });

  it("displays LAANC authorization status", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(screen.getByText("Auto-Approved")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders View Details button for each plan", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      const buttons = screen.getAllByText("View Details");
      expect(buttons).toHaveLength(2);
    });
  });

  it("displays VLOS type and airspace class", async () => {
    const plans = sampleFlightPlans.map((p) => ({
      ...p,
      pilot_email: p.profiles?.email,
      pilot_call_sign: p.profiles?.call_sign,
    }));

    mockFrom.mockReturnValue(createMockChain({ data: plans, error: null }));

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(screen.getByText(/VLOS.*Class G/)).toBeInTheDocument();
    });
    expect(screen.getByText(/BVLOS.*Class B/)).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockFrom.mockReturnValue(
      createMockChain({ data: null, error: { message: "Fetch failed" } })
    );

    render(<FlightPlanList />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load flight plans.")
      ).toBeInTheDocument();
    });
  });
});
