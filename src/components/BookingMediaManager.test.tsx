import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../test/test-utils";
import { BookingMediaManager } from "./BookingMediaManager";

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

const createChain = () => {
  const chain = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return chain;
};

const mockFrom = vi.fn().mockReturnValue(createChain());

vi.mock("../utility/supabaseClient", () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/file" }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
  },
}));

describe("BookingMediaManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFrom.mockReturnValue(createChain());
  });

  it("renders the media heading", async () => {
    render(<BookingMediaManager bookingId="booking-1" />);

    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("renders the kind selector with options", () => {
    render(<BookingMediaManager bookingId="booking-1" />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("raw");
  });

  it("renders the upload button", () => {
    render(<BookingMediaManager bookingId="booking-1" />);

    expect(screen.getByText("Upload file")).toBeInTheDocument();
  });

  it("shows 'No media uploaded.' when no files exist", async () => {
    render(<BookingMediaManager bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByText("No media uploaded.")).toBeInTheDocument();
    });
  });

  it("renders table headers", async () => {
    render(<BookingMediaManager bookingId="booking-1" />);

    await waitFor(() => {
      expect(screen.getByText("Kind")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
      expect(screen.getByText("Uploaded By")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Size")).toBeInTheDocument();
      expect(screen.getByText("Uploaded")).toBeInTheDocument();
    });
  });
});
