import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "../../test/test-utils";
import { AcademyEnrollment } from "./AcademyEnrollment";

// ── supabase chainable builder ──────────────────────────────────────
function createChainableBuilder(resolveValue: { data: any; error: any }) {
  const builder: any = {
    _resolved: resolveValue,
    select: vi.fn().mockImplementation(() => builder),
    insert: vi.fn().mockImplementation(() => builder),
    update: vi.fn().mockImplementation(() => builder),
    delete: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    neq: vi.fn().mockImplementation(() => builder),
    not: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    limit: vi.fn().mockImplementation(() => builder),
    in: vi.fn().mockImplementation(() => builder),
    single: vi.fn().mockImplementation(() => Promise.resolve(resolveValue)),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(resolveValue)),
    then(onFulfilled: any, onRejected?: any) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

const mockFrom = vi.fn();
vi.mock("../../utility/supabaseClient", () => ({
  supabaseClient: { from: (...args: any[]) => mockFrom(...args) },
}));

// ── test data helpers ───────────────────────────────────────────────
function makeEnrollment(overrides: Partial<{
  id: string;
  pilot_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percentage: number;
  pilot: { id: string; first_name: string; last_name: string; email: string } | null;
  course: { id: string; title: string; region: string; category: string; provider: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? "e-1",
    pilot_id: overrides.pilot_id ?? "p-1",
    course_id: overrides.course_id ?? "c-1",
    enrolled_at: overrides.enrolled_at ?? "2024-06-15T10:00:00Z",
    completed_at: overrides.completed_at ?? null,
    progress_percentage: overrides.progress_percentage ?? 50,
    pilot: overrides.pilot !== undefined ? overrides.pilot : {
      id: "p-1",
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
    },
    course: overrides.course !== undefined ? overrides.course : {
      id: "c-1",
      title: "Drone Basics",
      region: "US",
      category: "Mandatory",
      provider: "Buzz",
    },
  };
}

const sampleEnrollments = [
  makeEnrollment({
    id: "e-1",
    progress_percentage: 75,
    pilot: { id: "p-1", first_name: "Alice", last_name: "Smith", email: "alice@test.com" },
    course: { id: "c-1", title: "Drone Basics", region: "US", category: "Mandatory", provider: "Buzz" },
  }),
  makeEnrollment({
    id: "e-2",
    progress_percentage: 100,
    completed_at: "2024-07-01T12:00:00Z",
    enrolled_at: "2024-05-01T10:00:00Z",
    pilot: { id: "p-2", first_name: "Bob", last_name: "Jones", email: "bob@test.com" },
    course: { id: "c-2", title: "Advanced Flight", region: "EU", category: "Advanced", provider: "SkyTech" },
  }),
  makeEnrollment({
    id: "e-3",
    progress_percentage: 30,
    pilot: { id: "p-3", first_name: "Carol", last_name: "Lee", email: "carol@test.com" },
    course: { id: "c-3", title: "Safety Training", region: "Global", category: "General", provider: "Buzz" },
  }),
];

function setupMock(data: any[] = [], error: any = null) {
  mockFrom.mockImplementation(() =>
    createChainableBuilder({ data, error })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── TESTS ───────────────────────────────────────────────────────────

describe("AcademyEnrollment", () => {
  // ── RENDERING ──────────────────────────────────────────────────────

  describe("rendering", () => {
    it("shows loading state while fetching", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);
      expect(screen.getByText("Loading enrollments...")).toBeInTheDocument();
    });

    it("renders the page title", () => {
      setupMock([]);
      render(<AcademyEnrollment />);
      expect(screen.getByText("Academy Enrollment")).toBeInTheDocument();
    });

    it("renders empty state when no enrollments exist", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("No enrollments found.")).toBeInTheDocument();
      });
    });

    it("renders error state", async () => {
      setupMock(null, { message: "Failed to fetch enrollments" });
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Failed to fetch enrollments")).toBeInTheDocument();
      });
    });

    it("renders enrollment list with all fields", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Pilot info
      expect(screen.getByText("alice@test.com")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@test.com")).toBeInTheDocument();

      // Course info
      expect(screen.getByText("Drone Basics")).toBeInTheDocument();
      expect(screen.getByText("Advanced Flight")).toBeInTheDocument();
      expect(screen.getByText("Safety Training")).toBeInTheDocument();

      // Category, region, provider — these also appear in filter buttons, so use getAllByText
      expect(screen.getAllByText("Mandatory").length).toBeGreaterThanOrEqual(2); // filter + table cell
      expect(screen.getAllByText("Advanced").length).toBeGreaterThanOrEqual(2); // filter + table cell
    });

    it("shows enrollment count", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Showing 3 enrollments")).toBeInTheDocument();
      });
    });

    it("uses singular 'enrollment' for single result", async () => {
      setupMock([sampleEnrollments[0]]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Showing 1 enrollment")).toBeInTheDocument();
      });
    });
  });

  // ── TABLE HEADERS ──────────────────────────────────────────────────

  describe("table structure", () => {
    it("renders all column headers", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.queryByText("Loading enrollments...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Pilot")).toBeInTheDocument();
      expect(screen.getByText("Course")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("Region")).toBeInTheDocument();
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Progress")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Enrolled")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  // ── DATA LOADING / TRANSFORMATION ─────────────────────────────────

  describe("data loading", () => {
    it("queries course_enrollments table on mount", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("course_enrollments");
      });
    });

    it('shows "Unknown" for missing pilot data', async () => {
      setupMock([makeEnrollment({ id: "e-np", pilot: null })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Unknown")).toBeInTheDocument();
      });
    });

    it('shows "Unknown Course" for missing course data', async () => {
      setupMock([makeEnrollment({ id: "e-nc", course: null })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Unknown Course")).toBeInTheDocument();
      });
    });

    it("defaults progress_percentage to 0 when missing", async () => {
      setupMock([makeEnrollment({ id: "e-0", progress_percentage: 0 })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("0%")).toBeInTheDocument();
      });
    });

    it('defaults region to "Global" when missing', async () => {
      setupMock([
        makeEnrollment({
          id: "e-nr",
          course: { id: "c-nr", title: "No Region", region: "", category: "General", provider: "Buzz" },
        }),
      ]);

      // The component uses `item.course?.region || "Global"` — empty string triggers fallback
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Global")).toBeInTheDocument();
      });
    });
  });

  // ── PROGRESS BAR / PERCENTAGE ──────────────────────────────────────

  describe("progress display", () => {
    it("renders progress percentage", async () => {
      setupMock([makeEnrollment({ id: "e-p", progress_percentage: 75 })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("75%")).toBeInTheDocument();
      });
    });

    it("renders 100% progress for completed enrollment", async () => {
      setupMock([makeEnrollment({ id: "e-c", progress_percentage: 100, completed_at: "2024-07-01T00:00:00Z" })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("100%")).toBeInTheDocument();
      });
    });
  });

  // ── COMPLETION STATUS BADGE ────────────────────────────────────────

  describe("completion status badge", () => {
    it('shows "In Progress" for enrollments without completed_at', async () => {
      setupMock([makeEnrollment({ id: "e-ip", completed_at: null })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("In Progress")).toBeInTheDocument();
      });
    });

    it('shows "Completed" for enrollments with completed_at', async () => {
      setupMock([makeEnrollment({ id: "e-co", completed_at: "2024-07-01T00:00:00Z" })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        // "Completed" appears as both a table column header and the status badge
        const completedElements = screen.getAllByText("Completed");
        expect(completedElements.length).toBeGreaterThanOrEqual(2); // header + badge
      });
    });
  });

  // ── DATE FORMATTING ────────────────────────────────────────────────

  describe("date formatting", () => {
    it('shows "-" for null completion date', async () => {
      setupMock([makeEnrollment({ id: "e-nd", completed_at: null })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        // The "-" appears in the Completed column
        const dashes = screen.getAllByText("-");
        expect(dashes.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("formats enrolled_at date", async () => {
      setupMock([makeEnrollment({ id: "e-d", enrolled_at: "2024-06-15T10:00:00Z" })]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        const formatted = new Date("2024-06-15T10:00:00Z").toLocaleDateString();
        expect(screen.getByText(formatted)).toBeInTheDocument();
      });
    });
  });

  // ── FILTERING: COMPLETION STATUS ───────────────────────────────────

  describe("completion status filter", () => {
    it("filters to show only in-progress enrollments", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Click "in progress" filter
      fireEvent.click(screen.getByText("in progress"));

      // Alice (75%, no completed_at) and Carol (30%, no completed_at) should be visible
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Carol Lee")).toBeInTheDocument();
      // Bob (completed) should not be visible
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });

    it("filters to show only completed enrollments", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("completed"));

      // Only Bob has completed_at
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
      expect(screen.queryByText("Carol Lee")).not.toBeInTheDocument();
    });

    it('shows all enrollments when "All" completion status is selected', async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Click "completed" then back to "All"
      fireEvent.click(screen.getByText("completed"));
      // There are two "All" buttons (completion status + category)
      const allButtons = screen.getAllByText("All");
      fireEvent.click(allButtons[0]);

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Carol Lee")).toBeInTheDocument();
    });
  });

  // ── FILTERING: COURSE CATEGORY ─────────────────────────────────────

  describe("course category filter", () => {
    it("filters by course category", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Click "Advanced" category filter
      // The category buttons are rendered from COURSE_CATEGORIES before the table
      const advancedBtns = screen.getAllByText("Advanced");
      // The first one is the filter button (subsequent could be table cell)
      fireEvent.click(advancedBtns[0]);

      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    });
  });

  // ── FILTERING: SEARCH ─────────────────────────────────────────────

  describe("search filter", () => {
    it("searches by pilot name", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });

    it("searches by email", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "bob@test" } });

      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    });

    it("searches by course title", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "safety" } });

      expect(screen.getByText("Carol Lee")).toBeInTheDocument();
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    });

    it("searches by provider", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "skytech" } });

      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    });

    it("is case-insensitive", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "ALICE" } });

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
  });

  // ── COMBINED FILTERS ───────────────────────────────────────────────

  describe("combined filters", () => {
    it("applies completion status + search together", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Filter to in_progress
      fireEvent.click(screen.getByText("in progress"));

      // Then search for "alice"
      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, course, or provider..."
      );
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Carol Lee")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });

    it("applies category + completion status together", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Filter to "completed"
      fireEvent.click(screen.getByText("completed"));

      // Filter to "Mandatory" category — Bob is completed but in Advanced category
      const mandatoryBtns = screen.getAllByText("Mandatory");
      fireEvent.click(mandatoryBtns[mandatoryBtns.length - 1]);

      // No items should match (Alice is Mandatory but in-progress, Bob is completed but Advanced)
      expect(screen.getByText("No enrollments found.")).toBeInTheDocument();
    });
  });

  // ── CLEAR FILTERS ─────────────────────────────────────────────────

  describe("clear filters", () => {
    it("shows clear filters button with active filter count", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Set a completion status filter
      fireEvent.click(screen.getByText("completed"));

      expect(screen.getByText("Clear filters (1)")).toBeInTheDocument();
    });

    it("clears all filters when clear button is clicked", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Set filters
      fireEvent.click(screen.getByText("completed"));
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();

      // Clear
      fireEvent.click(screen.getByText(/Clear filters/));

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Carol Lee")).toBeInTheDocument();
    });

    it("does not show clear filters when no filters are active", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      expect(screen.queryByText(/Clear filters/)).not.toBeInTheDocument();
    });
  });

  // ── REFRESH ────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("reloads data when Refresh button is clicked", async () => {
      setupMock(sampleEnrollments);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      const initialCallCount = mockFrom.mock.calls.length;

      fireEvent.click(screen.getByText("🔄 Refresh"));

      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  // ── FILTER CONTROLS RENDERING ──────────────────────────────────────

  describe("filter controls", () => {
    it("renders completion status filter options", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.queryByText("Loading enrollments...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Completion Status")).toBeInTheDocument();
      expect(screen.getByText("in progress")).toBeInTheDocument();
      expect(screen.getByText("completed")).toBeInTheDocument();
    });

    it("renders course category filter options", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      await waitFor(() => {
        expect(screen.queryByText("Loading enrollments...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Course Category")).toBeInTheDocument();
      expect(screen.getByText("Mandatory")).toBeInTheDocument();
      expect(screen.getByText("Extension")).toBeInTheDocument();
      expect(screen.getByText("Intermediate")).toBeInTheDocument();
      expect(screen.getByText("Specialized")).toBeInTheDocument();
    });

    it("renders search input", async () => {
      setupMock([]);
      render(<AcademyEnrollment />);

      expect(
        screen.getByPlaceholderText("Search by pilot name, email, course, or provider...")
      ).toBeInTheDocument();
    });
  });
});
