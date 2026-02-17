import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "../../test/test-utils";
import userEvent from "@testing-library/user-event";
import { TestQuestionsManager } from "./TestQuestionsManager";

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

const mockQuestions = [
  {
    id: "q1",
    test_id: "test-1",
    question_number: 1,
    question_area: "Safety",
    question_text: "What is the minimum safe altitude?",
    options: ["100ft", "200ft", "400ft", "500ft"],
    correct_answer_index: 2,
    explanation: "FAA regulations specify 400ft",
    image_urls: ["https://example.com/img1.png"],
    problem_sets: [1, 2],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "q2",
    test_id: "test-1",
    question_number: 2,
    question_area: null,
    question_text: "When should you check weather?",
    options: ["Before flight", "Never"],
    correct_answer_index: 0,
    explanation: null,
    image_urls: [],
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
  testName: "Part 107 Exam",
  onClose: vi.fn(),
};

describe("TestQuestionsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = vi
      .fn()
      .mockImplementation(() =>
        createChain({ data: mockQuestions, error: null })
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

      render(<TestQuestionsManager {...defaultProps} />);
      expect(screen.getByText("Loading questions...")).toBeInTheDocument();
    });

    it("renders header with test name after loading", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Manage Questions")).toBeInTheDocument();
      });
      expect(screen.getByText(/Part 107 Exam/)).toBeInTheDocument();
    });

    it("shows empty state when no questions exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({ data: [], error: null })
      );

      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No questions yet/)).toBeInTheDocument();
      });
    });

    it("renders questions in a table", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("What is the minimum safe altitude?")
        ).toBeInTheDocument();
      });
      expect(screen.getByText("Safety")).toBeInTheDocument();
      expect(
        screen.getByText("When should you check weather?")
      ).toBeInTheDocument();
    });

    it("displays options count per question", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("4")).toBeInTheDocument();
      });
    });

    it("displays image count per question", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        // q2 has 0 images - unambiguous text
        expect(screen.getByText("0")).toBeInTheDocument();
      });
    });

    it("displays sorted problem_sets", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("1, 2")).toBeInTheDocument();
      });
    });

    it("shows dash for null area and problem_sets", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        const dashes = screen.getAllByText("—");
        expect(dashes.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("renders Edit and Delete buttons for each question", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });
    });

    it("renders Add Question and CSV buttons", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
        expect(screen.getByText("Import from CSV")).toBeInTheDocument();
        expect(screen.getByText("Export to CSV")).toBeInTheDocument();
      });
    });

    it("renders table column headers", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No.")).toBeInTheDocument();
        expect(screen.getByText("Area")).toBeInTheDocument();
        expect(screen.getByText("Question")).toBeInTheDocument();
        expect(screen.getByText("Options")).toBeInTheDocument();
        expect(screen.getByText("Images")).toBeInTheDocument();
        expect(screen.getByText("Problem Sets")).toBeInTheDocument();
        expect(screen.getByText("Actions")).toBeInTheDocument();
      });
    });

    it("renders drag handles for questions", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        const handles = screen.getAllByText("⋮⋮");
        expect(handles).toHaveLength(2);
      });
    });
  });

  // ── DATA LOADING ───────────────────────────────────────────

  describe("data loading", () => {
    it("queries test_questions with correct filters and ordering", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

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

    it("displays error message on fetch failure", async () => {
      mockFrom.mockImplementation(() =>
        createChain({
          data: null,
          error: { message: "Failed to fetch questions" },
        })
      );

      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to fetch questions")
        ).toBeInTheDocument();
      });
    });
  });

  // ── CLOSE ──────────────────────────────────────────────────

  describe("close", () => {
    it("calls onClose when header Close button clicked", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Manage Questions")).toBeInTheDocument();
      });

      const closeButtons = screen.getAllByText("Close");
      await userEvent.click(closeButtons[0]);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── ADD QUESTION FORM ──────────────────────────────────────

  describe("add question form", () => {
    it("opens form with correct title and submit button", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));

      expect(screen.getByText("Add Question")).toBeInTheDocument();
      expect(screen.getByText("Create Question")).toBeInTheDocument();
    });

    it("auto-sets next question number", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));

      expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    });

    it("sets question number to 1 when no questions exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({ data: [], error: null })
      );

      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));

      expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    });

    it("closes form on Cancel", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));
      expect(screen.getByText("Add Question")).toBeInTheDocument();

      await userEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByText("Create Question")).not.toBeInTheDocument();
    });

    it("renders four default option inputs", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));

      expect(screen.getAllByPlaceholderText(/^Option \d+$/)).toHaveLength(4);
    });

    it("submits new question via supabase insert", async () => {
      const user = userEvent.setup();
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));

      await user.type(
        screen.getByPlaceholderText("Enter the question text"),
        "New question?"
      );

      const optionInputs = screen.getAllByPlaceholderText(/^Option \d+$/);
      await user.type(optionInputs[0], "A");
      await user.type(optionInputs[1], "B");
      await user.type(optionInputs[2], "C");
      await user.type(optionInputs[3], "D");

      await user.click(screen.getByText("Create Question"));

      await waitFor(() => {
        const insertChain = mockFrom.mock.results.find(
          (r: any) => r.value.insert.mock.calls.length > 0
        );
        expect(insertChain).toBeDefined();
        const payload = insertChain!.value.insert.mock.calls[0][0];
        expect(payload.question_text).toBe("New question?");
        expect(payload.test_id).toBe("test-1");
        expect(payload.options).toEqual(["A", "B", "C", "D"]);
      });
    });

    it("updates course_tests.question_source after create", async () => {
      const user = userEvent.setup();
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));
      await user.type(
        screen.getByPlaceholderText("Enter the question text"),
        "Q?"
      );
      const opts = screen.getAllByPlaceholderText(/^Option \d+$/);
      await user.type(opts[0], "A");
      await user.type(opts[1], "B");
      await user.type(opts[2], "C");
      await user.type(opts[3], "D");

      await user.click(screen.getByText("Create Question"));

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
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));
      await user.type(
        screen.getByPlaceholderText("Enter the question text"),
        "Q?"
      );
      const opts = screen.getAllByPlaceholderText(/^Option \d+$/);
      await user.type(opts[0], "A");
      await user.type(opts[1], "B");
      await user.type(opts[2], "C");
      await user.type(opts[3], "D");

      await user.click(screen.getByText("Create Question"));

      await waitFor(() => {
        expect(screen.queryByText("Create Question")).not.toBeInTheDocument();
      });
    });
  });

  // ── EDIT QUESTION FORM ─────────────────────────────────────

  describe("edit question form", () => {
    it("opens form with Edit title and Update button", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(screen.getByText("Edit Question")).toBeInTheDocument();
      expect(screen.getByText("Update Question")).toBeInTheDocument();
    });

    it("populates form with existing question data", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText("Enter the question text")
      ).toHaveValue("What is the minimum safe altitude?");
    });

    it("populates question area in edit mode", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText(
          "e.g., Regulations, Safety, Operations"
        )
      ).toHaveValue("Safety");
    });

    it("populates explanation in edit mode", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByPlaceholderText(
          "Provide an explanation for the correct answer"
        )
      ).toHaveValue("FAA regulations specify 400ft");
    });

    it("loads existing options into the form", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(screen.getByDisplayValue("100ft")).toBeInTheDocument();
      expect(screen.getByDisplayValue("200ft")).toBeInTheDocument();
      expect(screen.getByDisplayValue("400ft")).toBeInTheDocument();
      expect(screen.getByDisplayValue("500ft")).toBeInTheDocument();
    });

    it("shows problem sets in edit mode", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(screen.getByText("Set 1")).toBeInTheDocument();
      expect(screen.getByText("Set 2")).toBeInTheDocument();
    });
  });

  // ── DELETE QUESTION ────────────────────────────────────────

  describe("delete question", () => {
    it("shows confirmation dialog", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Delete")[0]);

      expect(window.confirm).toHaveBeenCalled();
    });

    it("soft deletes with deleted_at and deleted_by", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

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
        expect(updateChain!.value.eq).toHaveBeenCalledWith("id", "q1");
      });
    });

    it("does not delete when confirm is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      const callCountAfterLoad = mockFrom.mock.calls.length;
      await userEvent.click(screen.getAllByText("Delete")[0]);

      expect(window.confirm).toHaveBeenCalled();
      // No additional supabase calls
      expect(mockFrom.mock.calls.length).toBe(callCountAfterLoad);
    });

    it("calls getSession for current user id", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalled();
      });
    });

    it("reloads questions after successful delete", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(2);
      });

      const callCountAfterLoad = mockFrom.mock.calls.length;
      await userEvent.click(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        // After delete: update call + reload call = at least 2 more from() calls
        expect(mockFrom.mock.calls.length).toBeGreaterThan(
          callCountAfterLoad
        );
      });
    });
  });

  // ── OPTIONS MANAGEMENT ─────────────────────────────────────

  describe("options management", () => {
    it("adds a new option", async () => {
      const user = userEvent.setup();
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));
      expect(screen.getAllByPlaceholderText(/^Option \d+$/)).toHaveLength(
        4
      );

      await user.click(screen.getByText("+ Add Option"));
      expect(screen.getAllByPlaceholderText(/^Option \d+$/)).toHaveLength(
        5
      );
    });

    it("removes an option", async () => {
      const user = userEvent.setup();
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));
      await user.click(screen.getAllByText("Remove")[0]);

      expect(screen.getAllByPlaceholderText(/^Option \d+$/)).toHaveLength(
        3
      );
    });

    it("hides Remove buttons when only 2 options remain", async () => {
      const user = userEvent.setup();
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await user.click(screen.getByText("+ Add Question"));

      // Remove 2 options: 4 → 3 → 2
      await user.click(screen.getAllByText("Remove")[0]);
      await user.click(screen.getAllByText("Remove")[0]);

      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });
  });

  // ── PROBLEM SET FILTER ─────────────────────────────────────

  describe("problem set filter", () => {
    it("shows filter dropdown when problem sets exist", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Filter by Problem Set:")
        ).toBeInTheDocument();
      });
    });

    it("does not show filter when no problem sets exist", async () => {
      mockFrom.mockImplementation(() =>
        createChain({
          data: [mockQuestions[1]], // only q2, no problem_sets
          error: null,
        })
      );

      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("When should you check weather?")
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Filter by Problem Set:")
      ).not.toBeInTheDocument();
    });

    it("shows All Questions option with total count", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Filter by Problem Set:")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("All Questions (2)")).toBeInTheDocument();
    });
  });

  // ── IMAGE MANAGEMENT ───────────────────────────────────────

  describe("image management", () => {
    it("shows image upload area in the form", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("+ Add Question"));

      expect(screen.getByText("Click to upload images")).toBeInTheDocument();
      expect(
        screen.getByText("PNG or JPEG only (max 5MB each)")
      ).toBeInTheDocument();
    });

    it("shows existing images when editing a question with images", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText("Edit")).toHaveLength(2);
      });

      await userEvent.click(screen.getAllByText("Edit")[0]);

      expect(
        screen.getByText("Current Images (drag to reorder):")
      ).toBeInTheDocument();
      expect(
        screen.getByAltText("Question image 1")
      ).toBeInTheDocument();
    });
  });

  // ── ERROR HANDLING ─────────────────────────────────────────

  describe("error handling", () => {
    it("keeps form open and calls insert on create failure", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("+ Add Question")).toBeInTheDocument();
      });

      // After initial load succeeds, switch mock to return errors
      mockFrom.mockImplementation(() =>
        createChain({
          data: null,
          error: { message: "Insert failed" },
        })
      );

      await userEvent.click(screen.getByText("+ Add Question"));
      await userEvent.type(
        screen.getByPlaceholderText("Enter the question text"),
        "Q?"
      );
      const opts = screen.getAllByPlaceholderText(/^Option \d+$/);
      for (const opt of opts) {
        await userEvent.type(opt, "X");
      }

      await userEvent.click(screen.getByText("Create Question"));

      // Verify insert was called
      await waitFor(() => {
        const insertCalled = mockFrom.mock.results.some(
          (r: any) => r.value?.insert?.mock?.calls?.length > 0
        );
        expect(insertCalled).toBe(true);
      });

      // Form should still be open (error prevents closing)
      expect(
        screen.getByPlaceholderText("Enter the question text")
      ).toBeInTheDocument();
    });

    it("displays error on delete failure", async () => {
      render(<TestQuestionsManager {...defaultProps} />);

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
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
    });
  });
});
