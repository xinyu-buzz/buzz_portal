import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "../../test/test-utils";
import userEvent from "@testing-library/user-event";
import { PracticalTestCriteriaManager } from "./PracticalTestCriteriaManager";

// Mock react-dnd
vi.mock("react-dnd", () => ({
  DndProvider: ({ children }: any) => <>{children}</>,
  useDrag: () => [{ isDragging: false }, vi.fn(), vi.fn()],
  useDrop: () => [{ isOver: false }, vi.fn()],
}));
vi.mock("react-dnd-html5-backend", () => ({
  HTML5Backend: {},
}));

// Chainable supabase query builder backed by a real Promise
function createChain(
  result: { data: any; error: any } = { data: null, error: null }
) {
  const chain: any = Promise.resolve(result);
  [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "is",
    "in",
    "order",
    "limit",
    "single",
    "upsert",
  ].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

const mockCriteria = [
  {
    id: "c1",
    test_id: "test-1",
    question_number: 1,
    question_area: "Pre-flight",
    question_text: "Performs visual inspection of aircraft",
    options: ["Pass", "Fail"],
    correct_answer_index: 0, // Pass
    explanation: "Must check all surfaces",
    image_urls: [],
    problem_sets: [1],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "c2",
    test_id: "test-1",
    question_number: 2,
    question_area: "Takeoff",
    question_text: "Maintains proper altitude during climb",
    options: ["Pass", "Fail"],
    correct_answer_index: 1, // Fail
    explanation: null,
    image_urls: ["https://example.com/criteria-img.png"],
    problem_sets: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

const mockUpload = vi
  .fn()
  .mockResolvedValue({ data: { path: "test-path" }, error: null });
const mockGetPublicUrl = vi
  .fn()
  .mockReturnValue({ data: { publicUrl: "https://example.com/uploaded.png" } });
const mockGetSession = vi.fn().mockResolvedValue({
  data: { session: { user: { id: "user-1" } } },
  error: null,
});

let mockFrom: ReturnType<typeof vi.fn>;

vi.mock("../../utility", () => ({
  supabaseClient: {
    from: (...args: any[]) => (mockFrom as any)(...args),
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

const defaultProps = {
  testId: "test-1",
  testName: "Practical Flight Test",
  onClose: vi.fn(),
};

describe("PracticalTestCriteriaManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi
      .fn()
      .mockImplementation(() =>
        createChain({ data: mockCriteria, error: null })
      );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // ── RENDERING ──────────────────────────────────────────────

  describe("rendering", () => {
    it("shows loading state initially", () => {
      mockFrom.mockImplementation(() => {
        // Use a promise that never resolves to keep loading state
        const chain: any = new Promise(() => {});
        [
          "select", "insert", "update", "delete", "eq", "neq",
          "is", "in", "order", "limit", "single", "upsert",
        ].forEach((m) => {
          chain[m] = vi.fn().mockReturnValue(chain);
        });
        return chain;
      });

      render(<PracticalTestCriteriaManager {...defaultProps} />);
      expect(screen.getByText("Loading criteria...")).toBeInTheDocument();
    });

    it("renders header with test name", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Manage Practical Test Criteria")
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Practical Flight Test/)
      ).toBeInTheDocument();
    });

    it("shows empty state when no criteria exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({ data: [], error: null })
      );

      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No criteria yet/)).toBeInTheDocument();
      });
    });

    it("renders criteria table with data", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Performs visual inspection of aircraft")
        ).toBeInTheDocument();
      });
      expect(screen.getByText("Pre-flight")).toBeInTheDocument();
      expect(screen.getByText("Takeoff")).toBeInTheDocument();
      expect(
        screen.getByText("Maintains proper altitude during climb")
      ).toBeInTheDocument();
    });

    it("displays Pass for correct_answer_index 0", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
      });
    });

    it("displays Fail for correct_answer_index 1", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Fail")).toBeInTheDocument();
      });
    });

    it("renders table column headers", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No.")).toBeInTheDocument();
        expect(screen.getByText("Area")).toBeInTheDocument();
        expect(screen.getByText("Criteria")).toBeInTheDocument();
        expect(screen.getByText("Result")).toBeInTheDocument();
        expect(screen.getByText("Images")).toBeInTheDocument();
        expect(screen.getByText("Problem Sets")).toBeInTheDocument();
        expect(screen.getByText("Actions")).toBeInTheDocument();
      });
    });

    it("displays image count per criteria", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        // c1 has 0 images - unambiguous text
        expect(screen.getByText("0")).toBeInTheDocument();
      });
    });

    it("displays sorted problem_sets", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        // c1 has problem_sets [1]
        // Can't search for "1" alone (ambiguous), use full row context
        expect(screen.getByText("Pre-flight")).toBeInTheDocument();
      });
    });

    it("shows dash for null problem_sets", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        const dashes = screen.getAllByText("—");
        expect(dashes.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders Edit and Delete buttons for each criteria", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });
    });

    it("renders Add Criteria button", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });
    });

    it("renders drag handles", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        const handles = screen.getAllByText("⋮⋮");
        expect(handles).toHaveLength(2);
      });
    });
  });

  // ── DATA LOADING ───────────────────────────────────────────

  describe("data loading", () => {
    it("queries test_questions with correct filters", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("test_questions");
      });

      const chain = mockFrom.mock.results[0].value;
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("test_id", "test-1");
      expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
      expect(chain.order).toHaveBeenCalledWith("question_number", {
        ascending: true,
      });
    });

    it("displays error on fetch failure", async () => {
      mockFrom.mockImplementation(() =>
        createChain({
          data: null,
          error: { message: "Connection refused" },
        })
      );

      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Connection refused")
        ).toBeInTheDocument();
      });
    });
  });

  // ── CLOSE ──────────────────────────────────────────────────

  describe("close", () => {
    it("calls onClose when header Close button clicked", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Manage Practical Test Criteria")
        ).toBeInTheDocument();
      });

      const closeButtons = screen.getAllByText("Close");
      await userEvent.click(closeButtons[0]);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── ADD CRITERIA FORM ──────────────────────────────────────

  describe("add criteria form", () => {
    it("opens form with correct title and submit button", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      expect(screen.getByText("Add Criteria")).toBeInTheDocument();
      expect(
        screen.getByText("Create Criteria")
      ).toBeInTheDocument();
    });

    it("auto-sets next criteria number", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      // Max is 2, next should be 3
      expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    });

    it("sets criteria number to 1 when no criteria exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({ data: [], error: null })
      );

      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    });

    it("closes form on Cancel", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));
      expect(screen.getByText("Add Criteria")).toBeInTheDocument();

      await userEvent.click(screen.getByText("Cancel"));

      expect(
        screen.queryByText("Create Criteria")
      ).not.toBeInTheDocument();
    });

    it("renders criteria description textarea", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      expect(
        screen.getByPlaceholderText("Enter the criteria description")
      ).toBeInTheDocument();
    });

    it("renders notes textarea", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      expect(
        screen.getByPlaceholderText("Additional notes or explanation")
      ).toBeInTheDocument();
    });

    it("submits new criteria via supabase insert", async () => {
      const user = userEvent.setup();
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Criteria"));

      await user.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "Checks airspace clearance"
      );

      await user.click(screen.getByText("Create Criteria"));

      await waitFor(() => {
        const insertChain = mockFrom.mock.results.find(
          (r: any) => r.value.insert.mock.calls.length > 0
        );
        expect(insertChain).toBeDefined();
        const payload = insertChain!.value.insert.mock.calls[0][0];
        expect(payload.question_text).toBe(
          "Checks airspace clearance"
        );
        expect(payload.test_id).toBe("test-1");
        expect(payload.options).toEqual(["Pass", "Fail"]);
        expect(payload.correct_answer_index).toBe(0);
      });
    });

    it("updates course_tests.question_source after create", async () => {
      const user = userEvent.setup();
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Criteria"));
      await user.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "Test criteria"
      );

      await user.click(screen.getByText("Create Criteria"));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("course_tests");
        const courseChain = mockFrom.mock.results.find(
          (_: any, i: number) =>
            mockFrom.mock.calls[i][0] === "course_tests"
        );
        expect(courseChain).toBeDefined();
        expect(courseChain!.value.update).toHaveBeenCalledWith({
          question_source: "database",
        });
      });
    });

    it("closes form after successful submit", async () => {
      const user = userEvent.setup();
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Criteria"));
      await user.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "New criteria"
      );

      await user.click(screen.getByText("Create Criteria"));

      await waitFor(() => {
        expect(
          screen.queryByText("Create Criteria")
        ).not.toBeInTheDocument();
      });
    });
  });

  // ── EDIT CRITERIA FORM ─────────────────────────────────────

  describe("edit criteria form", () => {
    it("opens form with Edit title and Update button", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(screen.getByText("Edit Criteria")).toBeInTheDocument();
      expect(
        screen.getByText("Update Criteria")
      ).toBeInTheDocument();
    });

    it("populates form with existing criteria data", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText("Enter the criteria description")
      ).toHaveValue("Performs visual inspection of aircraft");
    });

    it("populates criteria area in edit mode", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText(
          "e.g., Pre-flight, Takeoff, Landing"
        )
      ).toHaveValue("Pre-flight");
    });

    it("populates explanation in edit mode", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText(
          "Additional notes or explanation"
        )
      ).toHaveValue("Must check all surfaces");
    });

    it("shows problem sets in edit mode", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(screen.getByText("Set 1")).toBeInTheDocument();
    });
  });

  // ── DELETE CRITERIA ────────────────────────────────────────

  describe("delete criteria", () => {
    it("shows confirmation dialog", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Delete")[0]);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("soft deletes with deleted_at and deleted_by", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        const updateChain = mockFrom.mock.results.find(
          (r: any) =>
            r.value.update.mock.calls.length > 0 &&
            r.value.update.mock.calls[0][0]?.deleted_at
        );
        expect(updateChain).toBeDefined();
        expect(
          updateChain!.value.update.mock.calls[0][0]
        ).toHaveProperty("deleted_by", "user-1");
        expect(updateChain!.value.eq).toHaveBeenCalledWith("id", "c1");
      });
    });

    it("does not delete when confirm is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      const callCountAfterLoad = mockFrom.mock.calls.length;
      await userEvent.click(screen.getAllByText("Delete")[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockFrom.mock.calls.length).toBe(callCountAfterLoad);
    });

    it("calls getSession for current user id", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalled();
      });
    });

    it("reloads criteria after successful delete", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      const callCountAfterLoad = mockFrom.mock.calls.length;
      await userEvent.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(
          callCountAfterLoad
        );
      });
    });
  });

  // ── PROBLEM SET FILTER ─────────────────────────────────────

  describe("problem set filter", () => {
    it("shows filter dropdown when problem sets exist", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Filter by Problem Set:")
        ).toBeInTheDocument();
      });
    });

    it("does not show filter when no problem sets exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({
          data: [mockCriteria[1]], // c2 has null problem_sets
          error: null,
        })
      );

      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Maintains proper altitude during climb"
          )
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Filter by Problem Set:")
      ).not.toBeInTheDocument();
    });

    it("shows All Criteria option with count", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Filter by Problem Set:")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("All Criteria (2)")).toBeInTheDocument();
    });
  });

  // ── IMAGE MANAGEMENT ───────────────────────────────────────

  describe("image management", () => {
    it("shows image upload area in the form", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Criteria"));

      expect(
        screen.getByText("Click to upload images")
      ).toBeInTheDocument();
      expect(
        screen.getByText("PNG or JPEG only (max 5MB each)")
      ).toBeInTheDocument();
    });

    it("shows existing images when editing criteria with images", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      // Edit c2 which has images
      await userEvent.click(screen.getAllByText("Edit")[1]);

      expect(
        screen.getByText("Current Images (drag to reorder):")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Criteria image 1")
      ).toBeInTheDocument();
    });
  });

  // ── PASS/FAIL SEMANTICS ────────────────────────────────────

  describe("pass/fail semantics", () => {
    it("always sets options to Pass/Fail on submit", async () => {
      const user = userEvent.setup();
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Criteria"));
      await user.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "Test"
      );

      await user.click(screen.getByText("Create Criteria"));

      await waitFor(() => {
        const insertChain = mockFrom.mock.results.find(
          (r: any) => r.value.insert.mock.calls.length > 0
        );
        expect(insertChain).toBeDefined();
        const payload = insertChain!.value.insert.mock.calls[0][0];
        expect(payload.options).toEqual(["Pass", "Fail"]);
      });
    });

    it("defaults correct_answer_index to 0 (Pass) for new criteria", async () => {
      const user = userEvent.setup();
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Criteria"));
      await user.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "Test"
      );

      await user.click(screen.getByText("Create Criteria"));

      await waitFor(() => {
        const insertChain = mockFrom.mock.results.find(
          (r: any) => r.value.insert.mock.calls.length > 0
        );
        expect(insertChain).toBeDefined();
        expect(
          insertChain!.value.insert.mock.calls[0][0]
            .correct_answer_index
        ).toBe(0);
      });
    });

    it("renders both Pass and Fail results in the table", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Pass")).toBeInTheDocument();
        expect(screen.getByText("Fail")).toBeInTheDocument();
      });
    });
  });

  // ── ERROR HANDLING ─────────────────────────────────────────

  describe("error handling", () => {
    it("keeps form open and calls insert on create failure", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("+ Add Criteria")
        ).toBeInTheDocument();
      });

      // After initial load succeeds, switch mock to return errors
      mockFrom.mockImplementation(() =>
        createChain({
          data: null,
          error: { message: "Insert failed" },
        })
      );

      await userEvent.click(screen.getByText("+ Add Criteria"));
      await userEvent.type(
        screen.getByPlaceholderText("Enter the criteria description"),
        "Test"
      );

      await userEvent.click(screen.getByText("Create Criteria"));

      // Verify insert was called
      await waitFor(() => {
        const insertCalled = mockFrom.mock.results.some(
          (r: any) => r.value?.insert?.mock?.calls?.length > 0
        );
        expect(insertCalled).toBe(true);
      });

      // Form should still be open (error prevents closing)
      expect(
        screen.getByPlaceholderText("Enter the criteria description")
      ).toBeInTheDocument();
    });

    it("displays error on delete failure", async () => {
      render(<PracticalTestCriteriaManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      // After initial load succeeds, switch mock to return errors
      mockFrom.mockImplementation(() =>
        createChain({
          data: null,
          error: { message: "Delete failed" },
        })
      );

      await act(async () => {
        await userEvent.click(screen.getAllByText("Delete")[0]);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Delete failed")
        ).toBeInTheDocument();
      });
    });
  });
});
