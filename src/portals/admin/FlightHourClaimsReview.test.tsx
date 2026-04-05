import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../test/test-utils";
import { FlightHourClaimsReview } from "./FlightHourClaimsReview";

const mockNavigate = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createMockChain(resolvedValue: any) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "single",
    "maybeSingle",
  ];

  methods.forEach((method) => {
    chain[method] = vi.fn().mockImplementation(() => chain);
  });

  chain.then = vi.fn().mockImplementation((resolve?: (value: unknown) => void) => {
    if (resolve) resolve(resolvedValue);
    return Promise.resolve(resolvedValue);
  });

  return chain;
}

vi.mock("../../utility", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/evidence.pdf" },
        }),
      }),
    },
  },
}));

const pendingClaimRow = {
  id: "claim-1",
  pilot_id: "pilot-1",
  claimed_flights: 3,
  claimed_hours: 5,
  notes: "Recent work",
  evidence_files: null,
  status: "pending",
  submitted_at: "2026-03-01T10:00:00.000Z",
  reviewed_at: null,
  reviewed_by: null,
  reviewer_notes: null,
  pilot: {
    id: "pilot-1",
    first_name: "Avery",
    last_name: "Stone",
    email: "avery@example.com",
  },
};

describe("FlightHourClaimsReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "reviewer-1" } },
    });
  });

  it("surfaces rollback failure when stats update fails after approval", async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: [pendingClaimRow], error: null }))
      .mockReturnValueOnce(createMockChain({ data: [{ id: "claim-1" }], error: null }))
      .mockReturnValueOnce(
        createMockChain({
          data: {
            pilot_id: "pilot-1",
            total_flight_hours: 10,
            completed_bookings: 2,
            tier: 0,
          },
          error: null,
        })
      )
      .mockReturnValueOnce(createMockChain({ data: null, error: { message: "pilot stats update failed" } }))
      .mockReturnValueOnce(createMockChain({ data: null, error: { message: "rollback denied" } }));

    render(<FlightHourClaimsReview />);

    await waitFor(() => {
      expect(screen.getByText("Avery Stone")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Review"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Approve"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to update pilot stats, and rollback did not complete. Claim may still be approved: pilot stats update failed. Rollback error: rollback denied"
      );
    });
  });
});
