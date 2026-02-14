import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../test/test-utils";
import { AcademyTestResults } from "./AcademyTestResults";

// ── Chainable query builder ───────────────────────────────────────────
function createQueryBuilder(resolvedValue = { data: [], error: null }) {
  const builder: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  // Every method returns the builder itself (chainable)
  for (const key of Object.keys(builder)) {
    builder[key].mockReturnValue(builder);
  }

  // Make the builder thenable so `await query` resolves
  builder.then = (resolve: any) => resolve(resolvedValue);

  return builder;
}

// ── Mock supabaseClient ───────────────────────────────────────────────
const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("../../utility", () => ({
  supabaseClient: {
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1", email: "admin@test.com" } } },
        error: null,
      }),
    },
    storage: {
      from: (...args: any[]) => mockStorageFrom(...args),
    },
  },
}));

// ── Test data ─────────────────────────────────────────────────────────
const makePilot = (overrides = {}) => ({
  id: "pilot-1",
  first_name: "John",
  last_name: "Doe",
  email: "john@test.com",
  ...overrides,
});

const makeTest = (overrides = {}) => ({
  id: "test-1",
  test_name: "Flight Theory Exam",
  test_type: "practical",
  ...overrides,
});

const makeCourse = (overrides = {}) => ({
  id: "course-abc-1234",
  title: "PPL Ground School",
  ...overrides,
});

const makeRawResult = (overrides = {}) => ({
  id: "result-1",
  pilot_id: "pilot-1",
  test_id: "test-1",
  course_id: "course-abc-1234",
  score: 85,
  passed: true,
  answers: [],
  attempt_number: 1,
  completed_at: "2024-06-01T10:00:00Z",
  result_file_urls: ["https://storage.example.com/course-test-results/path/file.pdf"],
  upload_status: "pending",
  uploaded_at: "2024-06-02T10:00:00Z",
  reviewed_at: null,
  reviewer_notes: null,
  reviewed_by: null,
  pilot: makePilot(),
  test: makeTest(),
  course: makeCourse(),
  ...overrides,
});

// ── Helpers ───────────────────────────────────────────────────────────
function setupSelectBuilder(data: any[], error: any = null) {
  const builder = createQueryBuilder({ data, error });
  return builder;
}

function setupDefaultMocks(results: any[] = [makeRawResult()]) {
  const selectBuilder = setupSelectBuilder(results);
  const updateBuilder = createQueryBuilder({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    // All from() calls get a builder; select vs update is determined by usage
    // We return the selectBuilder for the initial load, updateBuilder for updates
    return selectBuilder;
  });

  mockGetUser.mockResolvedValue({
    data: { user: { id: "admin-user-1" } },
    error: null,
  });

  return { selectBuilder, updateBuilder };
}

// Reset everything between tests
beforeEach(() => {
  vi.clearAllMocks();
  // Suppress console.error for expected errors
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Default: mock window.confirm to return true
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

// ══════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════

describe("AcademyTestResults", () => {
  // ── Rendering & loading states ────────────────────────────────────
  describe("rendering states", () => {
    it("shows loading text while fetching", () => {
      // Builder that never resolves to keep loading state
      const builder: any = {};
      for (const key of [
        "select", "insert", "update", "delete", "eq", "neq",
        "in", "order", "limit", "single", "maybeSingle",
      ]) {
        builder[key] = vi.fn().mockReturnValue(builder);
      }
      builder.then = () => {}; // never resolves
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);
      expect(screen.getByText("Loading test results...")).toBeInTheDocument();
    });

    it("shows error alert on fetch failure", async () => {
      const builder = createQueryBuilder({
        data: null,
        error: { message: "Database connection failed" },
      });
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Database connection failed")).toBeInTheDocument();
      });
    });

    it("shows empty message when no results", async () => {
      setupDefaultMocks([]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("No test results found.")).toBeInTheDocument();
      });
      expect(screen.getByText("Showing 0 test results")).toBeInTheDocument();
    });

    it("renders page header and refresh button", async () => {
      setupDefaultMocks([]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Academy Test Results")).toBeInTheDocument();
      });
      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    });
  });

  // ── Data loading & transformation ─────────────────────────────────
  describe("data loading and transformation", () => {
    it("renders test result rows with all fields", async () => {
      setupDefaultMocks([makeRawResult()]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
      expect(screen.getByText("john@test.com")).toBeInTheDocument();
      expect(screen.getByText("Flight Theory Exam")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("✓ Yes")).toBeInTheDocument();
    });

    it("builds pilot name from first and last name", async () => {
      setupDefaultMocks([
        makeRawResult({
          pilot: makePilot({ first_name: "Jane", last_name: "Smith" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });
    });

    it("shows 'Unknown' when pilot data is missing", async () => {
      setupDefaultMocks([makeRawResult({ pilot: null })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Unknown")).toBeInTheDocument();
      });
    });

    it("shows 'Unknown Test' when test data is missing", async () => {
      setupDefaultMocks([makeRawResult({ test: null })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Unknown Test")).toBeInTheDocument();
      });
    });

    it("shows 'Unknown Course' when course data is missing", async () => {
      setupDefaultMocks([makeRawResult({ course: null })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText(/Unknown Course/)).toBeInTheDocument();
      });
    });

    it("shows pilot with only first name when last name is empty", async () => {
      setupDefaultMocks([
        makeRawResult({
          pilot: makePilot({ first_name: "Alice", last_name: "" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });
    });

    it("displays failed result indicator", async () => {
      setupDefaultMocks([makeRawResult({ passed: false })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("✗ No")).toBeInTheDocument();
      });
    });

    it("displays count of results", async () => {
      setupDefaultMocks([makeRawResult(), makeRawResult({ id: "result-2" })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 2 test results")).toBeInTheDocument();
      });
    });

    it("uses singular form for single result", async () => {
      setupDefaultMocks([makeRawResult()]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
      });
    });

    it("defaults null result_file_urls to empty array", async () => {
      setupDefaultMocks([makeRawResult({ result_file_urls: null })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
      // No "View" button when no files
      expect(screen.queryByText(/View/)).not.toBeInTheDocument();
    });

    it("shows date formatted for uploaded_at and reviewed_at", async () => {
      setupDefaultMocks([
        makeRawResult({
          uploaded_at: "2024-06-02T10:00:00Z",
          reviewed_at: null,
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
      // reviewed_at null shows "-"
      const cells = screen.getAllByText("-");
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });

    it("passes upload_status filter in query .eq() call", async () => {
      const builder = setupSelectBuilder([]);
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(builder.eq).toHaveBeenCalledWith("upload_status", "pending");
      });
    });
  });

  // ── Filter controls ───────────────────────────────────────────────
  describe("filtering", () => {
    it("renders upload status filter buttons", async () => {
      setupDefaultMocks([]);
      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 0 test results")).toBeInTheDocument();
      });

      // "All" button plus 4 status buttons
      const allButtons = screen.getAllByText("All");
      expect(allButtons.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("not submitted")).toBeInTheDocument();
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("approved")).toBeInTheDocument();
      expect(screen.getByText("rejected")).toBeInTheDocument();
    });

    it("renders test type filter buttons", async () => {
      setupDefaultMocks([]);
      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 0 test results")).toBeInTheDocument();
      });

      expect(screen.getByText("multiple choice")).toBeInTheDocument();
      expect(screen.getByText("practical")).toBeInTheDocument();
      expect(screen.getByText("written")).toBeInTheDocument();
      expect(screen.getByText("oral")).toBeInTheDocument();
    });

    it("filters by test type client-side", async () => {
      setupDefaultMocks([
        makeRawResult({ id: "r1", test: makeTest({ test_type: "practical" }) }),
        makeRawResult({
          id: "r2",
          test: makeTest({ test_type: "oral", test_name: "Oral Exam" }),
          pilot: makePilot({ first_name: "Bob", last_name: "Jones" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 2 test results")).toBeInTheDocument();
      });

      // Click the "oral" filter button (there are multiple "oral" texts, pick the button)
      const oralButtons = screen.getAllByText("oral");
      // The filter button is the one in the filter section, click it
      fireEvent.click(oralButtons[0]);

      expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });

    it("filters by search query client-side on pilot name", async () => {
      setupDefaultMocks([
        makeRawResult({ id: "r1" }),
        makeRawResult({
          id: "r2",
          pilot: makePilot({ first_name: "Alice", last_name: "Wonder", email: "alice@test.com" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 2 test results")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, test, or course..."
      );
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
      expect(screen.getByText("Alice Wonder")).toBeInTheDocument();
    });

    it("filters by search query on test name", async () => {
      setupDefaultMocks([
        makeRawResult({ id: "r1" }),
        makeRawResult({
          id: "r2",
          test: makeTest({ test_name: "Navigation Quiz" }),
          pilot: makePilot({ first_name: "Bob", last_name: "B" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 2 test results")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, test, or course..."
      );
      fireEvent.change(searchInput, { target: { value: "navigation" } });

      expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
      expect(screen.getByText("Navigation Quiz")).toBeInTheDocument();
    });

    it("applies combined test type and search filters", async () => {
      setupDefaultMocks([
        makeRawResult({ id: "r1", test: makeTest({ test_type: "oral", test_name: "Oral 1" }) }),
        makeRawResult({
          id: "r2",
          test: makeTest({ test_type: "oral", test_name: "Oral 2" }),
          pilot: makePilot({ first_name: "Zara", last_name: "Z" }),
        }),
        makeRawResult({
          id: "r3",
          test: makeTest({ test_type: "written", test_name: "Written 1" }),
          pilot: makePilot({ first_name: "Zara", last_name: "Z" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 3 test results")).toBeInTheDocument();
      });

      // Filter by oral type - use getAllByText since "oral" appears in filter and table
      const oralButtons = screen.getAllByText("oral");
      fireEvent.click(oralButtons[0]);
      expect(screen.getByText("Showing 2 test results")).toBeInTheDocument();

      // Then also search for Zara
      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, test, or course..."
      );
      fireEvent.change(searchInput, { target: { value: "zara" } });

      expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
    });

    it("changes upload status filter and reloads data", async () => {
      const builder = setupSelectBuilder([]);
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      // Wait for initial load (pending default)
      await waitFor(() => {
        expect(builder.eq).toHaveBeenCalledWith("upload_status", "pending");
      });

      mockFrom.mockClear();
      builder.eq.mockClear();
      mockFrom.mockReturnValue(builder);

      // Click "approved" status filter
      fireEvent.click(screen.getByText("approved"));

      await waitFor(() => {
        expect(builder.eq).toHaveBeenCalledWith("upload_status", "approved");
      });
    });

    it("clears all filters", async () => {
      setupDefaultMocks([
        makeRawResult({ id: "r1", test: makeTest({ test_type: "oral" }) }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 1 test result")).toBeInTheDocument();
      });

      // Activate test type filter
      fireEvent.click(screen.getByText("written"));
      expect(screen.getByText("Showing 0 test results")).toBeInTheDocument();

      // The clear filters button should appear (default has uploadStatus=pending as active)
      const clearBtn = screen.getByText(/Clear filters/);
      fireEvent.click(clearBtn);

      // After clearing, all filters reset
      await waitFor(() => {
        expect(
          screen.queryByText(/Clear filters/)
        ).not.toBeInTheDocument();
      });
    });

    it("shows active filter count", async () => {
      setupDefaultMocks([]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Showing 0 test results")).toBeInTheDocument();
      });

      // Default has uploadStatus=pending, so count = 1
      expect(screen.getByText("Clear filters (1)")).toBeInTheDocument();

      // Add search query for count = 2
      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, test, or course..."
      );
      fireEvent.change(searchInput, { target: { value: "something" } });
      expect(screen.getByText("Clear filters (2)")).toBeInTheDocument();
    });

    it("reloads when refresh button clicked", async () => {
      const builder = setupSelectBuilder([]);
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByText(/Refresh/));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ── Review workflow ───────────────────────────────────────────────
  describe("review workflow", () => {
    it("shows review button for pending non-multiple_choice results", async () => {
      setupDefaultMocks([
        makeRawResult({ upload_status: "pending", test: makeTest({ test_type: "practical" }) }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Review")).toBeInTheDocument();
      });
    });

    it("does NOT show review button for multiple_choice results", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "multiple_choice" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
      expect(screen.queryByText("Review")).not.toBeInTheDocument();
    });

    it("does NOT show review button for non-pending results", async () => {
      setupDefaultMocks([
        makeRawResult({ upload_status: "approved", test: makeTest({ test_type: "practical" }) }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
      expect(screen.queryByText("Review")).not.toBeInTheDocument();
    });

    it("opens review modal with result details", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Review")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Review"));

      expect(screen.getByText("Review Test Result")).toBeInTheDocument();
      // John Doe appears in both table and modal; just check at least 2 exist
      expect(screen.getAllByText(/John Doe/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/Flight Theory Exam/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/85%/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("✓ Approve & Pass")).toBeInTheDocument();
      expect(screen.getByText("✗ Reject & Fail")).toBeInTheDocument();
    });

    it("shows submitted files in review modal", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
          result_file_urls: [
            "https://storage.example.com/course-test-results/a/file1.pdf",
            "https://storage.example.com/course-test-results/b/file2.pdf",
          ],
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      expect(screen.getByText("Submitted Files:")).toBeInTheDocument();
      expect(screen.getByText(/File 1/)).toBeInTheDocument();
      expect(screen.getByText(/File 2/)).toBeInTheDocument();
    });

    it("populates reviewer notes from existing result", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
          reviewer_notes: "Previously noted",
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      const textarea = screen.getByPlaceholderText(
        "Add notes about this review (required for rejection)..."
      );
      expect(textarea).toHaveValue("Previously noted");
    });

    it("closes review modal on Close button", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });
      expect(screen.getByText("Review Test Result")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Close"));
      expect(screen.queryByText("Review Test Result")).not.toBeInTheDocument();
    });

    it("closes review modal on Cancel button", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Review Test Result")).not.toBeInTheDocument();
    });

    it("approves a test result successfully", async () => {
      // For the initial load, return the pending result
      const selectBuilder = setupSelectBuilder([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);
      const updateBuilder = createQueryBuilder({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        // First call: initial load (select), third call: reload after approve (select)
        // Second call: update
        if (callCount === 2) return updateBuilder;
        return selectBuilder;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-user-1" } },
        error: null,
      });

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      // Type review notes
      const textarea = screen.getByPlaceholderText(
        "Add notes about this review (required for rejection)..."
      );
      fireEvent.change(textarea, { target: { value: "Looks good" } });

      fireEvent.click(screen.getByText("✓ Approve & Pass"));

      await waitFor(() => {
        expect(updateBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            upload_status: "approved",
            passed: true,
            reviewer_notes: "Looks good",
            reviewed_by: "admin-user-1",
          })
        );
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Review Test Result")).not.toBeInTheDocument();
      });
    });

    it("rejects a test result with notes", async () => {
      const selectBuilder = setupSelectBuilder([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "written" }),
        }),
      ]);
      const updateBuilder = createQueryBuilder({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return updateBuilder;
        return selectBuilder;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-user-1" } },
        error: null,
      });

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      const textarea = screen.getByPlaceholderText(
        "Add notes about this review (required for rejection)..."
      );
      fireEvent.change(textarea, { target: { value: "Incomplete answers" } });

      fireEvent.click(screen.getByText("✗ Reject & Fail"));

      await waitFor(() => {
        expect(updateBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            upload_status: "rejected",
            passed: false,
            reviewer_notes: "Incomplete answers",
            reviewed_by: "admin-user-1",
          })
        );
      });
    });

    it("rejects requires notes - shows error if empty", async () => {
      setupDefaultMocks([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      // Leave notes empty and try to reject
      fireEvent.click(screen.getByText("✗ Reject & Fail"));

      expect(
        screen.getByText("Please provide a reason for rejection")
      ).toBeInTheDocument();
    });

    it("shows error when approve fails", async () => {
      const selectBuilder = setupSelectBuilder([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);
      const updateBuilder = createQueryBuilder({
        data: null,
        error: { message: "Update failed" },
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return updateBuilder;
        return selectBuilder;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-user-1" } },
        error: null,
      });

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      fireEvent.click(screen.getByText("✓ Approve & Pass"));

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });

      // Modal stays open on error
      expect(screen.getByText("Review Test Result")).toBeInTheDocument();
    });

    it("shows error when reject fails", async () => {
      const selectBuilder = setupSelectBuilder([
        makeRawResult({
          upload_status: "pending",
          test: makeTest({ test_type: "practical" }),
        }),
      ]);
      const updateBuilder = createQueryBuilder({
        data: null,
        error: { message: "Reject failed" },
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return updateBuilder;
        return selectBuilder;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-user-1" } },
        error: null,
      });

      render(<AcademyTestResults />);

      await waitFor(() => {
        fireEvent.click(screen.getByText("Review"));
      });

      const textarea = screen.getByPlaceholderText(
        "Add notes about this review (required for rejection)..."
      );
      fireEvent.change(textarea, { target: { value: "Bad submission" } });
      fireEvent.click(screen.getByText("✗ Reject & Fail"));

      await waitFor(() => {
        expect(screen.getByText("Reject failed")).toBeInTheDocument();
      });

      // Modal stays open
      expect(screen.getByText("Review Test Result")).toBeInTheDocument();
    });
  });

  // ── Override (multiple choice Pass/Fail) ──────────────────────────
  describe("multiple choice override", () => {
    it("shows Pass/Fail buttons for multiple_choice results", async () => {
      setupDefaultMocks([
        makeRawResult({
          test: makeTest({ test_type: "multiple_choice" }),
          passed: false,
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
        expect(screen.getByText("Fail")).toBeInTheDocument();
      });
    });

    it("disables Pass button when already passed", async () => {
      setupDefaultMocks([
        makeRawResult({
          test: makeTest({ test_type: "multiple_choice" }),
          passed: true,
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeDisabled();
        expect(screen.getByText("Fail")).not.toBeDisabled();
      });
    });

    it("disables Fail button when already failed", async () => {
      setupDefaultMocks([
        makeRawResult({
          test: makeTest({ test_type: "multiple_choice" }),
          passed: false,
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).not.toBeDisabled();
        expect(screen.getByText("Fail")).toBeDisabled();
      });
    });

    it("calls override with confirm dialog", async () => {
      const selectBuilder = setupSelectBuilder([
        makeRawResult({
          test: makeTest({ test_type: "multiple_choice" }),
          passed: false,
        }),
      ]);
      const updateBuilder = createQueryBuilder({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return updateBuilder;
        return selectBuilder;
      });

      mockGetUser.mockResolvedValue({
        data: { user: { id: "admin-user-1" } },
        error: null,
      });
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Pass"));

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining("PASSED")
      );

      await waitFor(() => {
        expect(updateBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            passed: true,
            reviewer_notes: "Manual override by admin",
          })
        );
      });
    });

    it("cancels override when confirm is declined", async () => {
      setupDefaultMocks([
        makeRawResult({
          test: makeTest({ test_type: "multiple_choice" }),
          passed: false,
        }),
      ]);

      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Pass"));

      // from() should only have been called once (initial load), not for update
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  // ── File viewing ──────────────────────────────────────────────────
  describe("file viewing", () => {
    it("shows View button when result has file URLs", async () => {
      setupDefaultMocks([
        makeRawResult({
          result_file_urls: ["https://storage.example.com/course-test-results/path/file.pdf"],
        }),
      ]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText(/View/)).toBeInTheDocument();
      });
    });

    it("does not show View button when result has no files", async () => {
      setupDefaultMocks([makeRawResult({ result_file_urls: [] })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      expect(screen.queryByText(/View/)).not.toBeInTheDocument();
    });
  });

  // ── Status badges ─────────────────────────────────────────────────
  describe("status badges", () => {
    it("renders pending status badge", async () => {
      setupDefaultMocks([makeRawResult({ upload_status: "pending" })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("pending")).toBeInTheDocument();
      });
    });

    it("renders approved status badge", async () => {
      setupDefaultMocks([makeRawResult({ upload_status: "approved" })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("approved")).toBeInTheDocument();
      });
    });

    it("renders rejected status badge with replace", async () => {
      setupDefaultMocks([makeRawResult({ upload_status: "rejected" })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("rejected")).toBeInTheDocument();
      });
    });

    it("renders not_submitted as 'not submitted'", async () => {
      setupDefaultMocks([makeRawResult({ upload_status: "not_submitted" })]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("not submitted")).toBeInTheDocument();
      });
    });
  });

  // ── Table structure ───────────────────────────────────────────────
  describe("table structure", () => {
    it("renders all column headers", async () => {
      setupDefaultMocks([]);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(screen.getByText("Pilot")).toBeInTheDocument();
      });

      expect(screen.getByText("Test")).toBeInTheDocument();
      expect(screen.getByText("Course")).toBeInTheDocument();
      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Score")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Passed")).toBeInTheDocument();
      expect(screen.getByText("Uploaded")).toBeInTheDocument();
      expect(screen.getByText("Reviewed")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  // ── Search triggers ───────────────────────────────────────────────
  describe("search interactions", () => {
    it("reloads on Search button click", async () => {
      const builder = setupSelectBuilder([]);
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByText("Search"));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(2);
      });
    });

    it("reloads on Enter key in search input", async () => {
      const builder = setupSelectBuilder([]);
      mockFrom.mockReturnValue(builder);

      render(<AcademyTestResults />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(1);
      });

      const searchInput = screen.getByPlaceholderText(
        "Search by pilot name, email, test, or course..."
      );
      fireEvent.keyDown(searchInput, { key: "Enter" });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledTimes(2);
      });
    });
  });
});
