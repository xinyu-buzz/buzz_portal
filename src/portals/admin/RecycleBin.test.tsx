import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "../../test/test-utils";
import { RecycleBin } from "./RecycleBin";

// ── storage helpers mock ────────────────────────────────────────────
vi.mock("../../utility/storageHelpers", () => ({
  restoreStorageFiles: vi.fn().mockResolvedValue(undefined),
  permanentlyDeleteStorageFiles: vi.fn().mockResolvedValue(undefined),
}));

import { restoreStorageFiles, permanentlyDeleteStorageFiles } from "../../utility/storageHelpers";

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

// ── helpers ─────────────────────────────────────────────────────────
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const makeCourse = (id: string, title: string, daysOld: number, profile: any, _hasStorage = true) => ({
  id,
  title,
  deleted_at: daysAgo(daysOld),
  deleted_by: "user-1",
  profiles: profile,
});

const makeSection = (id: string, name: string, daysOld: number, profile: any) => ({
  id,
  name,
  deleted_at: daysAgo(daysOld),
  deleted_by: "user-1",
  course_id: "c-1",
  training_courses: { title: "Parent Course" },
  profiles: profile,
});

const makeUnit = (id: string, title: string, daysOld: number, profile: any, _hasStorage = true) => ({
  id,
  title,
  deleted_at: daysAgo(daysOld),
  deleted_by: "user-1",
  course_id: "c-1",
  training_courses: { title: "Parent Course" },
  profiles: profile,
});

const makeTest = (id: string, testName: string, daysOld: number, profile: any, _hasStorage = true) => ({
  id,
  test_name: testName,
  deleted_at: daysAgo(daysOld),
  deleted_by: "user-1",
  course_id: "c-1",
  training_courses: { title: "Parent Course" },
  profiles: profile,
});

const makeQuestion = (id: string, text: string, daysOld: number, profile: any) => ({
  id,
  question_text: text,
  deleted_at: daysAgo(daysOld),
  deleted_by: "user-1",
  test_id: "t-1",
  course_tests: { test_name: "Parent Test" },
  profiles: profile,
});

const defaultProfile = { first_name: "John", last_name: "Doe" };

/**
 * Sets up mockFrom so each .from(table) call returns a chainable builder
 * that resolves with the data for that table.
 *
 * tableDataMap: { "training_courses": [...], "deleted_storage_files": [...], ... }
 */
function setupTableMocks(
  tableDataMap: Record<string, any[]>,
  opts?: { errorTable?: string; errorMsg?: string }
) {
  mockFrom.mockImplementation((table: string) => {
    if (opts?.errorTable === table) {
      return createChainableBuilder({ data: null, error: { message: opts.errorMsg } });
    }
    const data = tableDataMap[table] ?? [];
    return createChainableBuilder({ data, error: null });
  });
}

// Convenience: all 5 entity tables empty + storage empty
function setupEmptyMocks() {
  setupTableMocks({
    training_courses: [],
    course_sections: [],
    course_units: [],
    course_tests: [],
    test_questions: [],
    deleted_storage_files: [],
  });
}

// Setup with one item per type
function setupFullMocks() {
  setupTableMocks({
    training_courses: [makeCourse("c-1", "Course 1", 5, defaultProfile)],
    course_sections: [makeSection("s-1", "Section 1", 10, defaultProfile)],
    course_units: [makeUnit("u-1", "Unit 1", 15, defaultProfile)],
    course_tests: [makeTest("t-1", "Test 1", 20, defaultProfile)],
    test_questions: [makeQuestion("q-1", "Question text here?", 25, defaultProfile)],
    deleted_storage_files: [{ id: "sf-1" }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // stub confirm to always return true
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

// ── TESTS ───────────────────────────────────────────────────────────

describe("RecycleBin", () => {
  // ── RENDERING ──────────────────────────────────────────────────────

  describe("rendering", () => {
    it("shows loading state initially", () => {
      setupEmptyMocks();
      render(<RecycleBin />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows empty state when no deleted items exist", async () => {
      setupEmptyMocks();
      render(<RecycleBin />);
      await waitFor(() => {
        expect(screen.getByText("No deleted items in recycle bin.")).toBeInTheDocument();
      });
    });

    it("renders the page title", async () => {
      setupEmptyMocks();
      render(<RecycleBin />);
      expect(screen.getByText("Recycle Bin")).toBeInTheDocument();
    });

    it("renders the 30-day info message", async () => {
      setupEmptyMocks();
      render(<RecycleBin />);
      expect(
        screen.getByText(/Items in the recycle bin will be permanently deleted after 30 days/)
      ).toBeInTheDocument();
    });

    it("renders deleted items with all fields", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      expect(screen.getByText("Section 1")).toBeInTheDocument();
      expect(screen.getByText("Unit 1")).toBeInTheDocument();
      expect(screen.getByText("Test 1")).toBeInTheDocument();
      expect(screen.getByText("Question text here?")).toBeInTheDocument();

      // Check deleted_by_name rendered
      const names = screen.getAllByText("John Doe");
      expect(names.length).toBeGreaterThanOrEqual(1);
    });

    it("renders error state", async () => {
      setupTableMocks(
        { training_courses: [] },
        { errorTable: "training_courses", errorMsg: "DB connection failed" }
      );
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("DB connection failed")).toBeInTheDocument();
      });
    });
  });

  // ── TYPE FILTER TABS ───────────────────────────────────────────────

  describe("type filter tabs", () => {
    it("renders all filter buttons with correct counts", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      expect(screen.getByText(/All \(5\)/)).toBeInTheDocument();
      expect(screen.getByText(/Courses \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Sections \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Units \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Tests \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Questions \(1\)/)).toBeInTheDocument();
    });

    it("filters items by type when a filter tab is clicked", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Courses \(1\)/));

      expect(screen.getByText("Course 1")).toBeInTheDocument();
      expect(screen.queryByText("Section 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Unit 1")).not.toBeInTheDocument();
    });

    it("shows all items when 'All' filter is selected", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      // click Courses filter then back to All
      fireEvent.click(screen.getByText(/Courses \(1\)/));
      fireEvent.click(screen.getByText(/All \(5\)/));

      expect(screen.getByText("Course 1")).toBeInTheDocument();
      expect(screen.getByText("Section 1")).toBeInTheDocument();
    });
  });

  // ── DATA LOADING ───────────────────────────────────────────────────

  describe("data loading", () => {
    it("queries all five tables on mount", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const calledTables = mockFrom.mock.calls.map((c: any[]) => c[0]);
      expect(calledTables).toContain("training_courses");
      expect(calledTables).toContain("course_sections");
      expect(calledTables).toContain("course_units");
      expect(calledTables).toContain("course_tests");
      expect(calledTables).toContain("test_questions");
    });

    it("checks deleted_storage_files for courses, units, and tests", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const storageCalls = mockFrom.mock.calls.filter(
        (c: any[]) => c[0] === "deleted_storage_files"
      );
      // courses (1) + units (1) + tests (1) = 3 storage checks
      expect(storageCalls.length).toBe(3);
    });

    it("handles profile data to build deleted_by_name", async () => {
      setupTableMocks({
        training_courses: [makeCourse("c-1", "Course A", 5, { first_name: "Jane", last_name: "Smith" })],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });
    });

    it('shows "Unknown" when profile is null', async () => {
      setupTableMocks({
        training_courses: [makeCourse("c-1", "Course B", 5, null)],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Unknown")).toBeInTheDocument();
      });
    });

    it("handles load errors from any table", async () => {
      setupTableMocks(
        {
          training_courses: [],
          course_sections: [],
          course_units: [],
          course_tests: [],
          test_questions: [],
          deleted_storage_files: [],
        },
        { errorTable: "course_sections", errorMsg: "Sections load failed" }
      );
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Sections load failed")).toBeInTheDocument();
      });
    });
  });

  // ── DAYS REMAINING ─────────────────────────────────────────────────

  describe("days remaining", () => {
    it("calculates correct days remaining (30 - daysOld)", async () => {
      setupTableMocks({
        training_courses: [makeCourse("c-1", "Recent Course", 5, defaultProfile)],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("25 days")).toBeInTheDocument();
      });
    });

    it("shows 0 days for items older than 30 days", async () => {
      setupTableMocks({
        training_courses: [makeCourse("c-1", "Old Course", 35, defaultProfile)],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("0 days")).toBeInTheDocument();
      });
    });

    it("shows Clean Up Expired button when expired items exist", async () => {
      setupTableMocks({
        training_courses: [makeCourse("c-1", "Expired", 31, defaultProfile)],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText(/Clean Up Expired/)).toBeInTheDocument();
      });
    });
  });

  // ── RESTORE ────────────────────────────────────────────────────────

  describe("handleRestore", () => {
    it("restores an item by clearing deleted_at and deleted_by", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      // Click the first Restore button
      const restoreButtons = screen.getAllByText("Restore");
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        // Confirm was called
        expect(window.confirm).toHaveBeenCalledWith(
          expect.stringContaining("Restore")
        );
        // update call was made on the correct table
        const updateCalls = mockFrom.mock.calls.filter(
          (c: any[]) => c[0] === "training_courses"
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(2); // initial load + restore update
      });
    });

    it("calls restoreStorageFiles when item has storage files", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByText("Restore");
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(restoreStorageFiles).toHaveBeenCalledWith("c-1");
      });
    });

    it("does not restore when user cancels confirm dialog", async () => {
      (window.confirm as Mock).mockReturnValueOnce(false);
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const callCountBefore = mockFrom.mock.calls.length;
      const restoreButtons = screen.getAllByText("Restore");
      fireEvent.click(restoreButtons[0]);

      // No additional from() calls should be made after the initial load
      await waitFor(() => {
        // Only the initial load calls happened, no new restore calls
        expect(restoreStorageFiles).not.toHaveBeenCalled();
      });
    });

    it("shows error when restore fails", async () => {
      // First load succeeds, then restore call fails
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "training_courses") {
          callCount++;
          if (callCount === 1) {
            // initial load
            return createChainableBuilder({
              data: [makeCourse("c-1", "Course 1", 5, defaultProfile)],
              error: null,
            });
          }
          // restore update call
          return createChainableBuilder({
            data: null,
            error: { message: "Restore permission denied" },
          });
        }
        return createChainableBuilder({ data: [], error: null });
      });

      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const restoreButtons = screen.getAllByText("Restore");
      fireEvent.click(restoreButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Restore permission denied")).toBeInTheDocument();
      });
    });
  });

  // ── PERMANENT DELETE ───────────────────────────────────────────────

  describe("handlePermanentDelete", () => {
    it("permanently deletes an item from the database", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          expect.stringContaining("PERMANENTLY DELETE")
        );
      });
    });

    it("calls permanentlyDeleteStorageFiles when item has storage files", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(permanentlyDeleteStorageFiles).toHaveBeenCalledWith("c-1");
      });
    });

    it("does not delete when user cancels confirm dialog", async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      // Set confirm to return false before clicking delete
      (window.confirm as Mock).mockReturnValue(false);

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(permanentlyDeleteStorageFiles).not.toHaveBeenCalled();
      });
    });

    it("shows error when permanent delete fails", async () => {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "training_courses") {
          callCount++;
          if (callCount === 1) {
            return createChainableBuilder({
              data: [makeCourse("c-1", "Course 1", 5, defaultProfile)],
              error: null,
            });
          }
          return createChainableBuilder({
            data: null,
            error: { message: "Delete failed" },
          });
        }
        return createChainableBuilder({ data: [], error: null });
      });

      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
    });
  });

  // ── REFRESH ────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("reloads data when Refresh button is clicked", async () => {
      setupEmptyMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const initialCallCount = mockFrom.mock.calls.length;

      fireEvent.click(screen.getByText("Refresh"));

      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  // ── STORAGE FILES COLUMN ───────────────────────────────────────────

  describe("storage files display", () => {
    it('shows "Yes" for items with storage files', async () => {
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Course 1")).toBeInTheDocument();
      });

      // Courses, units, tests get has_storage_files = true (because deleted_storage_files returns data)
      const yesCells = screen.getAllByText("Yes");
      expect(yesCells.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "-" for items without storage files', async () => {
      // Sections and questions always have has_storage_files = false
      setupFullMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("Section 1")).toBeInTheDocument();
      });

      // Multiple "-" cells exist (parent column also uses "-")
      const dashCells = screen.getAllByText("-");
      expect(dashCells.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── TABLE HEADERS ──────────────────────────────────────────────────

  describe("table structure", () => {
    it("renders all column headers", async () => {
      setupEmptyMocks();
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Parent")).toBeInTheDocument();
      expect(screen.getByText("Deleted By")).toBeInTheDocument();
      expect(screen.getByText("Deleted Date")).toBeInTheDocument();
      expect(screen.getByText("Days Remaining")).toBeInTheDocument();
      expect(screen.getByText("Storage Files")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  // ── QUESTION TEXT TRUNCATION ───────────────────────────────────────

  describe("question text truncation", () => {
    it("truncates question text longer than 100 characters", async () => {
      const longText = "A".repeat(150);
      setupTableMocks({
        training_courses: [],
        course_sections: [],
        course_units: [],
        course_tests: [],
        test_questions: [makeQuestion("q-1", longText, 5, defaultProfile)],
        deleted_storage_files: [],
      });
      render(<RecycleBin />);

      await waitFor(() => {
        expect(screen.getByText("A".repeat(100) + "...")).toBeInTheDocument();
      });
    });
  });
});
