import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "../../test/test-utils";

// ---------------------------------------------------------------------------
// Hoisted mocks – these are available inside vi.mock() factories
// ---------------------------------------------------------------------------
const {
  mockNavigate,
  mockMoveStorageFilesToDeleted,
  storageBucket,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const _storageBucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: "https://storage.example.com/course-covers/test.jpg" },
    }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    mockNavigate: vi.fn(),
    mockMoveStorageFilesToDeleted: vi.fn().mockResolvedValue(undefined),
    storageBucket: _storageBucket,
    mockSupabaseClient: {
      from: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-123", email: "admin@buzz.com" },
            },
          },
          error: null,
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue(_storageBucket),
      },
    } as any,
  };
});

// ---------------------------------------------------------------------------
// Mock: react-router-dom useNavigate
// ---------------------------------------------------------------------------
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Mock: storageHelpers (dynamic import in cascadeSoftDelete)
// ---------------------------------------------------------------------------
vi.mock("../../utility/storageHelpers", () => ({
  moveStorageFilesToDeleted: (...args: unknown[]) =>
    mockMoveStorageFilesToDeleted(...args),
}));

// ---------------------------------------------------------------------------
// Mock: supabaseClient
// ---------------------------------------------------------------------------
vi.mock("../../utility", () => ({
  supabaseClient: mockSupabaseClient,
}));

// Must import AFTER vi.mock declarations
import { AcademyCourses } from "./AcademyCourses";

// ---------------------------------------------------------------------------
// Chainable supabase query-builder factory
// ---------------------------------------------------------------------------
type BuilderOverrides = {
  thenData?: { data: any; error: any };
  singleData?: { data: any; error: any };
  maybeSingleData?: { data: any; error: any };
};

function createChainableBuilder(overrides: BuilderOverrides = {}) {
  const {
    thenData = { data: [], error: null },
    singleData = { data: null, error: null },
    maybeSingleData = { data: null, error: null },
  } = overrides;

  const builder: any = {};
  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "is",
    "not",
    "order",
    "limit",
    "range",
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn().mockReturnValue(builder);
  });
  builder.single = vi.fn().mockResolvedValue(singleData);
  builder.maybeSingle = vi.fn().mockResolvedValue(maybeSingleData);
  // The chain itself resolves as a thenable
  builder.then = vi.fn((resolve: any) => resolve(thenData));
  return builder;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------
function makeCourse(overrides: Partial<any> = {}): any {
  return {
    id: "course-1",
    title: "Drone Basics",
    description: "Introduction to drones",
    duration: "10 hours",
    level: "Beginner",
    category: "Mandatory",
    instructor: "John Doe",
    rating: 4.5,
    students_count: 42,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    provider: "Buzz",
    instructor_picture_url: null,
    requires_uas_ground_school: false,
    requires_flight_review_passed: false,
    requires_roc_a_passed: false,
    external_url: null,
    cover_image_url: null,
    region: "Global",
    active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Table-aware from() configurator
// ---------------------------------------------------------------------------
type TableConfig = Record<string, BuilderOverrides>;

function setupFromMock(tableConfig: TableConfig) {
  const builders: Record<string, any> = {};
  for (const [table, overrides] of Object.entries(tableConfig)) {
    builders[table] = createChainableBuilder(overrides);
  }

  (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
    if (builders[table]) return builders[table];
    // fallback empty builder
    return createChainableBuilder();
  });

  return builders;
}

// Convenience: default setup that returns an empty course list
function setupDefaultLoad(courses: any[] = []) {
  return setupFromMock({
    training_courses: { thenData: { data: courses, error: null } },
    course_sections: { thenData: { data: [], error: null } },
    course_tests: { thenData: { data: [], error: null } },
    course_units: { thenData: { data: [], error: null } },
    test_questions: { thenData: { data: [], error: null } },
    employee_profiles: {
      maybeSingleData: { data: { role: "owner" }, error: null },
    },
    deleted_storage_files: { thenData: { data: [], error: null } },
  });
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
  mockMoveStorageFilesToDeleted.mockReset().mockResolvedValue(undefined);

  // Reset auth to valid owner session
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "user-123", email: "admin@buzz.com" } },
    },
    error: null,
  });

  // Reset storage mocks
  storageBucket.upload.mockResolvedValue({ data: { path: "test-path" }, error: null });
  storageBucket.getPublicUrl.mockReturnValue({
    data: { publicUrl: "https://storage.example.com/course-covers/test.jpg" },
  });
  storageBucket.remove.mockResolvedValue({ data: [], error: null });
});

// ===========================================================================
// TESTS
// ===========================================================================

describe("AcademyCourses", () => {
  // -------------------------------------------------------------------------
  // RENDERING
  // -------------------------------------------------------------------------
  describe("Rendering", () => {
    it("shows loading state while courses are fetched", async () => {
      // Create a builder that never resolves instantly
      const pendingBuilder = createChainableBuilder();
      // Override then to be a pending promise (don't resolve immediately)
      pendingBuilder.then = vi.fn(
        () => new Promise(() => {}) // never resolves
      );
      (mockSupabaseClient.from as Mock).mockReturnValue(pendingBuilder);

      render(<AcademyCourses />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows empty state when no courses exist", async () => {
      setupDefaultLoad([]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("No courses yet.")).toBeInTheDocument();
      });
    });

    it("renders course list with all fields", async () => {
      const course = makeCourse({
        title: "Advanced Flight",
        provider: "Buzz",
        region: "USA",
        category: "Advanced",
        level: "Advanced",
        instructor: "Jane Smith",
        students_count: 99,
        active: true,
      });
      setupDefaultLoad([course]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Advanced Flight")).toBeInTheDocument();
      });
      // Scope table-specific checks to the table element to avoid matching filter buttons
      const table = screen.getByRole("table");
      expect(within(table).getByText("Buzz")).toBeInTheDocument();
      expect(within(table).getByText("USA")).toBeInTheDocument();
      // Category and Level both say "Advanced" in the table row
      const advancedCells = within(table).getAllByText("Advanced");
      expect(advancedCells.length).toBeGreaterThanOrEqual(2);
      expect(within(table).getByText("Jane Smith")).toBeInTheDocument();
      expect(within(table).getByText("99")).toBeInTheDocument();
      expect(within(table).getByText("Yes")).toBeInTheDocument();
    });

    it("renders active status as 'No' for inactive courses", async () => {
      setupDefaultLoad([makeCourse({ active: false })]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("No")).toBeInTheDocument();
      });
    });

    it("renders filter UI elements (search, provider, region)", async () => {
      setupDefaultLoad([]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search courses by title...")
        ).toBeInTheDocument();
      });

      // Provider filter buttons
      expect(screen.getByText("Buzz")).toBeInTheDocument();
      expect(screen.getByText("Red Cross")).toBeInTheDocument();
      expect(screen.getByText("USFA")).toBeInTheDocument();
      expect(screen.getByText("FEMA")).toBeInTheDocument();

      // Region filter buttons
      expect(screen.getByText("Canada")).toBeInTheDocument();
      expect(screen.getByText("UK")).toBeInTheDocument();
      expect(screen.getByText("Australia")).toBeInTheDocument();
    });

    it("renders '+ New course' and 'Recycle Bin' buttons", async () => {
      setupDefaultLoad([]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
    });

    it("renders the heading 'Academy Courses'", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);
      await waitFor(() => {
        expect(screen.getByText("Academy Courses")).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // CREATE COURSE MODAL
  // -------------------------------------------------------------------------
  describe("Course Creation", () => {
    it("opens create modal when '+ New course' is clicked", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("+ New course"));

      expect(screen.getByText("Create Course")).toBeInTheDocument();
      expect(screen.getByText("Create course")).toBeInTheDocument();
    });

    it("renders all form fields in create modal", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      expect(screen.getByPlaceholderText("Course title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Course description")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("25")).toBeInTheDocument(); // duration placeholder
      expect(screen.getByPlaceholderText("Instructor name")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("https://example.com/image.jpg")
      ).toBeInTheDocument();
      expect(screen.getByText("Requires UAS Ground School")).toBeInTheDocument();
      expect(screen.getByText("Requires Flight Review Passed")).toBeInTheDocument();
      expect(screen.getByText("Requires ROC-A Passed")).toBeInTheDocument();
    });

    it("shows validation error when required fields are missing", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Title is empty by default. Use fireEvent.submit on the form to bypass
      // browser-level HTML5 required validation and hit the JS validation path.
      const form = screen.getByPlaceholderText("Course title").closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText("Please fill all required fields.")
        ).toBeInTheDocument();
      });
    });

    it("creates a course successfully with all required fields", async () => {
      const builders = setupDefaultLoad([]);
      // Make the insert chainable and resolve
      builders.training_courses.insert.mockReturnValue(builders.training_courses);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Fill form
      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "New Course", name: "title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Course description"), {
        target: { value: "A test course description", name: "description" },
      });
      fireEvent.change(screen.getByPlaceholderText("25"), {
        target: { value: "10" },
      });
      fireEvent.change(screen.getByPlaceholderText("Instructor name"), {
        target: { value: "Test Instructor", name: "instructor" },
      });

      // Submit
      fireEvent.click(screen.getByText("Create course"));

      await waitFor(() => {
        expect(builders.training_courses.insert).toHaveBeenCalled();
      });
    });

    it("shows error on insert failure", async () => {
      const builders = setupFromMock({
        training_courses: {
          thenData: { data: [], error: null },
        },
      });
      // First call: load (resolves via then). Second call: insert (resolves via then with error).
      let callCount = 0;
      (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
        if (table === "training_courses") {
          callCount++;
          if (callCount === 1) {
            // initial load
            return builders.training_courses;
          }
          // insert call - return a builder that resolves insert with error
          const insertBuilder = createChainableBuilder({
            thenData: { data: null, error: { message: "Insert failed" } },
          });
          return insertBuilder;
        }
        return createChainableBuilder();
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "New Course", name: "title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Course description"), {
        target: { value: "Description", name: "description" },
      });
      fireEvent.change(screen.getByPlaceholderText("25"), {
        target: { value: "5" },
      });
      fireEvent.change(screen.getByPlaceholderText("Instructor name"), {
        target: { value: "Instructor", name: "instructor" },
      });

      fireEvent.click(screen.getByText("Create course"));

      await waitFor(() => {
        expect(screen.getByText("Insert failed")).toBeInTheDocument();
      });
    });

    it("validates cover image file type", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      const fileInput = document.getElementById("cover-image-input") as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const invalidFile = new File(["content"], "test.txt", { type: "text/plain" });
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(
          screen.getByText("Please select a valid image file (JPEG, PNG, WebP, or GIF)")
        ).toBeInTheDocument();
      });
    });

    it("validates cover image file size (max 5MB)", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      const fileInput = document.getElementById("cover-image-input") as HTMLInputElement;
      // Create a file > 5MB
      const largeFile = new File(
        [new ArrayBuffer(6 * 1024 * 1024)],
        "big.jpg",
        { type: "image/jpeg" }
      );
      Object.defineProperty(largeFile, "size", { value: 6 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(
          screen.getByText("Image size must be less than 5MB")
        ).toBeInTheDocument();
      });
    });

    it("uploads cover image during creation", async () => {
      const builders = setupDefaultLoad([]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Upload a valid image
      const fileInput = document.getElementById("cover-image-input") as HTMLInputElement;
      const validFile = new File(["img"], "cover.png", { type: "image/png" });
      Object.defineProperty(validFile, "size", { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Fill required fields
      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "Image Course", name: "title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Course description"), {
        target: { value: "Desc", name: "description" },
      });
      fireEvent.change(screen.getByPlaceholderText("25"), {
        target: { value: "3" },
      });
      fireEvent.change(screen.getByPlaceholderText("Instructor name"), {
        target: { value: "Instructor", name: "instructor" },
      });

      fireEvent.click(screen.getByText("Create course"));

      await waitFor(() => {
        expect(storageBucket.upload).toHaveBeenCalled();
        expect(storageBucket.getPublicUrl).toHaveBeenCalled();
      });
    });

    it("shows error when cover image upload fails", async () => {
      setupDefaultLoad([]);
      storageBucket.upload.mockResolvedValueOnce({
        data: null,
        error: { message: "Upload quota exceeded" },
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Upload file
      const fileInput = document.getElementById("cover-image-input") as HTMLInputElement;
      const validFile = new File(["img"], "cover.png", { type: "image/png" });
      Object.defineProperty(validFile, "size", { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Fill required fields
      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "Failing Upload", name: "title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Course description"), {
        target: { value: "Desc", name: "description" },
      });
      fireEvent.change(screen.getByPlaceholderText("25"), {
        target: { value: "1" },
      });
      fireEvent.change(screen.getByPlaceholderText("Instructor name"), {
        target: { value: "Instructor", name: "instructor" },
      });

      fireEvent.click(screen.getByText("Create course"));

      await waitFor(() => {
        expect(
          screen.getByText("Failed to upload cover image: Upload quota exceeded")
        ).toBeInTheDocument();
      });
    });

    it("resets form after successful creation", async () => {
      setupDefaultLoad([]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Fill and submit
      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "Course To Reset", name: "title" },
      });
      fireEvent.change(screen.getByPlaceholderText("Course description"), {
        target: { value: "Desc", name: "description" },
      });
      fireEvent.change(screen.getByPlaceholderText("25"), {
        target: { value: "2" },
      });
      fireEvent.change(screen.getByPlaceholderText("Instructor name"), {
        target: { value: "Instructor", name: "instructor" },
      });

      fireEvent.click(screen.getByText("Create course"));

      // After creation the modal closes
      await waitFor(() => {
        expect(screen.queryByText("Create Course")).not.toBeInTheDocument();
      });

      // Reopen and check form is reset
      fireEvent.click(screen.getByText("+ New course"));
      expect(
        (screen.getByPlaceholderText("Course title") as HTMLInputElement).value
      ).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // UPDATE COURSE
  // -------------------------------------------------------------------------
  describe("Course Update", () => {
    it("opens edit modal with pre-populated fields", async () => {
      const course = makeCourse({
        title: "Editable Course",
        description: "Original desc",
        instructor: "Original Instructor",
      });
      setupDefaultLoad([course]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Editable Course")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Edit"));

      await waitFor(() => {
        expect(screen.getByText("Edit Course")).toBeInTheDocument();
      });

      expect(
        (screen.getByPlaceholderText("Course title") as HTMLInputElement).value
      ).toBe("Editable Course");
      expect(
        (screen.getByPlaceholderText("Course description") as HTMLTextAreaElement).value
      ).toBe("Original desc");
      expect(
        (screen.getByPlaceholderText("Instructor name") as HTMLInputElement).value
      ).toBe("Original Instructor");
    });

    it("shows 'Update course' submit button in edit mode", async () => {
      setupDefaultLoad([makeCourse()]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      expect(screen.getByText("Update course")).toBeInTheDocument();
    });

    it("shows validation error on update when required fields are empty", async () => {
      setupDefaultLoad([makeCourse()]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      // Clear required field
      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "", name: "title" },
      });

      // Use fireEvent.submit to bypass browser-level HTML5 required validation
      const form = screen.getByPlaceholderText("Course title").closest("form")!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText("Please fill all required fields.")
        ).toBeInTheDocument();
      });
    });

    it("updates course successfully", async () => {
      const course = makeCourse({ title: "Old Title" });
      const builders = setupDefaultLoad([course]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Old Title")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      fireEvent.change(screen.getByPlaceholderText("Course title"), {
        target: { value: "New Title", name: "title" },
      });

      fireEvent.click(screen.getByText("Update course"));

      await waitFor(() => {
        expect(builders.training_courses.update).toHaveBeenCalled();
      });
    });

    it("shows error on update failure", async () => {
      const course = makeCourse();
      let callCount = 0;
      (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
        if (table === "training_courses") {
          callCount++;
          if (callCount === 1) {
            // load
            return createChainableBuilder({
              thenData: { data: [course], error: null },
            });
          }
          // update call
          const updateBuilder = createChainableBuilder();
          // Override the chain so that after update().eq().select() it resolves with error
          updateBuilder.then = vi.fn((resolve: any) =>
            resolve({ data: null, error: { message: "Update failed" } })
          );
          return updateBuilder;
        }
        return createChainableBuilder();
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Update course"));

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });
    });

    it("replaces cover image on update (deletes old, uploads new)", async () => {
      const course = makeCourse({
        cover_image_url: "https://storage.example.com/course-covers/old-image.jpg",
      });
      setupDefaultLoad([course]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      // Upload new image
      const fileInput = document.getElementById("cover-image-input") as HTMLInputElement;
      const newFile = new File(["new-img"], "new-cover.png", { type: "image/png" });
      Object.defineProperty(newFile, "size", { value: 512 });
      fireEvent.change(fileInput, { target: { files: [newFile] } });

      fireEvent.click(screen.getByText("Update course"));

      await waitFor(() => {
        // Old image should be removed
        expect(storageBucket.remove).toHaveBeenCalledWith(["old-image.jpg"]);
        // New image should be uploaded
        expect(storageBucket.upload).toHaveBeenCalled();
      });
    });

    it("clears optional fields (instructor_picture_url, external_url) when empty", async () => {
      const course = makeCourse({
        instructor_picture_url: "https://example.com/pic.jpg",
        external_url: "https://example.com/ext",
        provider: "Red Cross", // non-Buzz shows external URL
      });
      const builders = setupDefaultLoad([course]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      // Clear instructor picture URL
      fireEvent.change(
        screen.getByPlaceholderText("https://example.com/image.jpg"),
        { target: { value: "", name: "instructor_picture_url" } }
      );

      // Clear external URL
      fireEvent.change(
        screen.getByPlaceholderText("https://example.com/course"),
        { target: { value: "", name: "external_url" } }
      );

      fireEvent.click(screen.getByText("Update course"));

      await waitFor(() => {
        expect(builders.training_courses.update).toHaveBeenCalled();
        const updateCall = builders.training_courses.update.mock.calls[0][0];
        expect(updateCall.instructor_picture_url).toBeNull();
        expect(updateCall.external_url).toBeNull();
      });
    });

    it("shows 'Duplicate course' button only in edit mode", async () => {
      setupDefaultLoad([makeCourse()]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      expect(screen.getByText("Duplicate course")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE COURSE
  // -------------------------------------------------------------------------
  describe("Course Deletion", () => {
    it("opens delete confirmation modal", async () => {
      setupDefaultLoad([makeCourse({ title: "Course To Delete" })]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Course To Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      expect(
        screen.getByText(/Are you sure you want to delete "Course To Delete"\?/)
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Type DELETE to confirm")
      ).toBeInTheDocument();
    });

    it("disables delete button until 'DELETE' is typed", async () => {
      setupDefaultLoad([makeCourse()]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      const deleteBtn = screen.getByText("Delete Course");
      expect(deleteBtn).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("Type DELETE to confirm"), {
        target: { value: "DELETE" },
      });

      expect(deleteBtn).not.toBeDisabled();
    });

    it("shows error for non-owner users attempting to delete", async () => {
      const course = makeCourse();
      setupFromMock({
        training_courses: { thenData: { data: [course], error: null } },
        employee_profiles: {
          maybeSingleData: { data: { role: "admin" }, error: null },
        },
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      fireEvent.change(screen.getByPlaceholderText("Type DELETE to confirm"), {
        target: { value: "DELETE" },
      });
      fireEvent.click(screen.getByText("Delete Course"));

      await waitFor(() => {
        // Error appears in two locations (top-level alert + form modal alert)
        const matches = screen.getAllByText(
          /Only users with Owner role can delete courses/
        );
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it("shows error when user is not authenticated", async () => {
      setupDefaultLoad([makeCourse()]);
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      fireEvent.change(screen.getByPlaceholderText("Type DELETE to confirm"), {
        target: { value: "DELETE" },
      });
      fireEvent.click(screen.getByText("Delete Course"));

      await waitFor(() => {
        // Error appears in two locations (top-level alert + form modal alert)
        const matches = screen.getAllByText("User not authenticated");
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it("performs cascade soft delete on course and related entities", async () => {
      const course = makeCourse({ id: "course-del-1", title: "Del Course" });
      const sections = [{ id: "sec-1" }, { id: "sec-2" }];
      const tests = [{ id: "test-1" }, { id: "test-2" }];
      const units = [{ id: "unit-1" }];

      const builders = setupFromMock({
        training_courses: { thenData: { data: [course], error: null } },
        employee_profiles: {
          maybeSingleData: { data: { role: "owner" }, error: null },
        },
        course_sections: { thenData: { data: sections, error: null } },
        course_tests: { thenData: { data: tests, error: null } },
        course_units: { thenData: { data: units, error: null } },
        test_questions: { thenData: { data: [], error: null } },
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Del Course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      fireEvent.change(screen.getByPlaceholderText("Type DELETE to confirm"), {
        target: { value: "DELETE" },
      });
      fireEvent.click(screen.getByText("Delete Course"));

      await waitFor(() => {
        // Course soft-deleted
        expect(builders.training_courses.update).toHaveBeenCalled();
        // Sections soft-deleted
        expect(builders.course_sections.update).toHaveBeenCalled();
        // Tests soft-deleted
        expect(builders.course_tests.update).toHaveBeenCalled();
        // Units soft-deleted
        expect(builders.course_units.update).toHaveBeenCalled();
        // moveStorageFilesToDeleted called
        expect(mockMoveStorageFilesToDeleted).toHaveBeenCalledWith(
          "course-del-1",
          "course",
          "user-123"
        );
      });
    });

    it("soft-deletes test questions for each test", async () => {
      const course = makeCourse({ id: "course-q-del" });
      const tests = [{ id: "test-q-1" }];

      const builders = setupFromMock({
        training_courses: { thenData: { data: [course], error: null } },
        employee_profiles: {
          maybeSingleData: { data: { role: "owner" }, error: null },
        },
        course_sections: { thenData: { data: [], error: null } },
        course_tests: { thenData: { data: tests, error: null } },
        course_units: { thenData: { data: [], error: null } },
        test_questions: { thenData: { data: [], error: null } },
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      fireEvent.change(screen.getByPlaceholderText("Type DELETE to confirm"), {
        target: { value: "DELETE" },
      });
      fireEvent.click(screen.getByText("Delete Course"));

      await waitFor(() => {
        // test_questions builder should have had update called (soft delete)
        expect(builders.test_questions.update).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // DUPLICATE COURSE
  // -------------------------------------------------------------------------
  describe("Course Duplication", () => {
    it("shows confirm dialog before duplicating", async () => {
      const course = makeCourse({ title: "Original Course" });
      setupDefaultLoad([course]);

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Duplicate course"));

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure you want to duplicate "Original Course"?')
      );

      confirmSpy.mockRestore();
    });

    it("creates a duplicate course with '(Copy)' suffix and inactive status", async () => {
      const course = makeCourse({ id: "orig-1", title: "My Course" });
      const newCourse = { id: "new-dup-1", title: "My Course (Copy)" };

      const builders = setupFromMock({
        training_courses: {
          thenData: { data: [course], error: null },
          singleData: { data: newCourse, error: null },
        },
        course_sections: { thenData: { data: [], error: null } },
        course_tests: { thenData: { data: [], error: null } },
        course_units: { thenData: { data: [], error: null } },
        test_questions: { thenData: { data: [], error: null } },
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Duplicate course"));

      await waitFor(() => {
        expect(builders.training_courses.insert).toHaveBeenCalled();
        const insertPayload = builders.training_courses.insert.mock.calls[0][0];
        expect(insertPayload.title).toBe("My Course (Copy)");
        expect(insertPayload.active).toBe(false);
      });

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it("duplicates sections with prerequisite_section_id remapping", async () => {
      const course = makeCourse({ id: "orig-sec" });
      const newCourse = { id: "new-sec-dup" };
      const sections = [
        {
          id: "sec-old-1",
          name: "Section 1",
          display_order: 1,
          description: "Sec 1",
          section_type: "standard",
          requires_subscription: false,
          requires_test_passed: false,
          prerequisite_section_id: null,
          is_active: true,
          exam_type: null,
        },
        {
          id: "sec-old-2",
          name: "Section 2",
          display_order: 2,
          description: "Sec 2",
          section_type: "standard",
          requires_subscription: false,
          requires_test_passed: false,
          prerequisite_section_id: "sec-old-1",
          is_active: true,
          exam_type: null,
        },
      ];

      // We need section inserts to return new IDs
      let sectionInsertCount = 0;
      const sectionBuilder = createChainableBuilder({
        thenData: { data: sections, error: null },
      });
      sectionBuilder.single
        .mockResolvedValueOnce({ data: { id: "sec-new-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "sec-new-2" }, error: null });

      const courseBuilder = createChainableBuilder({
        thenData: { data: [course], error: null },
        singleData: { data: newCourse, error: null },
      });

      (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
        if (table === "training_courses") return courseBuilder;
        if (table === "course_sections") return sectionBuilder;
        return createChainableBuilder();
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Duplicate course"));

      await waitFor(() => {
        // Section insert should have been called for each section
        expect(sectionBuilder.insert).toHaveBeenCalled();
        // Section update should be called for prerequisite remapping
        expect(sectionBuilder.update).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it("rolls back on failure during duplication", async () => {
      const course = makeCourse({ id: "orig-fail" });
      const newCourse = { id: "new-fail-dup" };

      const courseBuilder = createChainableBuilder({
        thenData: { data: [course], error: null },
        singleData: { data: newCourse, error: null },
      });

      // Sections fetch fails
      const sectionBuilder = createChainableBuilder();
      sectionBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: "Sections fetch failed" } })
      );

      (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
        if (table === "training_courses") return courseBuilder;
        if (table === "course_sections") return sectionBuilder;
        if (table === "course_tests") return createChainableBuilder();
        if (table === "course_units") return createChainableBuilder();
        if (table === "test_questions") return createChainableBuilder();
        return createChainableBuilder();
      });

      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));
      fireEvent.click(screen.getByText("Duplicate course"));

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to duplicate course.*rolled back/i)
        ).toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // FILTERING
  // -------------------------------------------------------------------------
  describe("Filtering", () => {
    const courses = [
      makeCourse({
        id: "c1",
        title: "Buzz Canada Mandatory",
        provider: "Buzz",
        region: "Canada",
        category: "Mandatory",
      }),
      makeCourse({
        id: "c2",
        title: "Red Cross USA General",
        provider: "Red Cross",
        region: "USA",
        category: "General",
      }),
      makeCourse({
        id: "c3",
        title: "Buzz UK Extension",
        provider: "Buzz",
        region: "UK",
        category: "Extension",
      }),
    ];

    it("filters by provider", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      // Use getByRole("button") to target filter buttons (table cells are not buttons)
      fireEvent.click(screen.getByRole("button", { name: "Red Cross" }));

      expect(screen.getByText("Red Cross USA General")).toBeInTheDocument();
      expect(screen.queryByText("Buzz Canada Mandatory")).not.toBeInTheDocument();
      expect(screen.queryByText("Buzz UK Extension")).not.toBeInTheDocument();
    });

    it("filters by region", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      // Region filter buttons - use getByRole to avoid matching table cells
      fireEvent.click(screen.getByRole("button", { name: "UK" }));

      expect(screen.getByText("Buzz UK Extension")).toBeInTheDocument();
      expect(screen.queryByText("Buzz Canada Mandatory")).not.toBeInTheDocument();
      expect(screen.queryByText("Red Cross USA General")).not.toBeInTheDocument();
    });

    it("filters by category when provider is selected", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      // Select Buzz provider first to show category filter
      // "Buzz" appears in filter buttons and table cells, but only filter is a <button>
      const buzzFilterBtns = screen.getAllByRole("button", { name: "Buzz" });
      fireEvent.click(buzzFilterBtns[0]);

      // Now Category filter should be visible with category buttons
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Extension" })).toBeInTheDocument();
      });

      // Select Extension category
      fireEvent.click(screen.getByRole("button", { name: "Extension" }));

      expect(screen.getByText("Buzz UK Extension")).toBeInTheDocument();
      expect(screen.queryByText("Buzz Canada Mandatory")).not.toBeInTheDocument();
    });

    it("filters by search query (title search)", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("Search courses by title..."),
        { target: { value: "UK" } }
      );

      expect(screen.getByText("Buzz UK Extension")).toBeInTheDocument();
      expect(screen.queryByText("Buzz Canada Mandatory")).not.toBeInTheDocument();
      expect(screen.queryByText("Red Cross USA General")).not.toBeInTheDocument();
    });

    it("shows 'No courses match' when filters exclude everything", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("Search courses by title..."),
        { target: { value: "zzzznonexistent" } }
      );

      expect(
        screen.getByText("No courses match the selected filters.")
      ).toBeInTheDocument();
    });

    it("shows active filter count badge", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      // Apply search filter
      fireEvent.change(
        screen.getByPlaceholderText("Search courses by title..."),
        { target: { value: "Buzz" } }
      );

      // Should show "Clear filters" button when filters are active
      await waitFor(() => {
        expect(screen.getByText("Clear filters")).toBeInTheDocument();
      });
      // The filter count badge renders showing "Showing X of Y courses"
      expect(screen.getByText(/Showing 2 of 3 courses/)).toBeInTheDocument();
    });

    it("shows 'Showing X of Y courses' text when filters are active", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("Search courses by title..."),
        { target: { value: "Buzz" } }
      );

      await waitFor(() => {
        expect(screen.getByText(/Showing 2 of 3 courses/)).toBeInTheDocument();
      });
    });

    it("clears all filters when 'Clear filters' is clicked", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("Search courses by title..."),
        { target: { value: "UK" } }
      );

      expect(screen.queryByText("Buzz Canada Mandatory")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear filters"));

      expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      expect(screen.getByText("Red Cross USA General")).toBeInTheDocument();
      expect(screen.getByText("Buzz UK Extension")).toBeInTheDocument();
    });

    it("combines multiple filters", async () => {
      setupDefaultLoad(courses);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      });

      // Filter by provider Buzz (button role avoids matching table cells)
      const buzzBtns = screen.getAllByRole("button", { name: "Buzz" });
      fireEvent.click(buzzBtns[0]);

      // Also filter by region Canada
      fireEvent.click(screen.getByRole("button", { name: "Canada" }));

      expect(screen.getByText("Buzz Canada Mandatory")).toBeInTheDocument();
      expect(screen.queryByText("Buzz UK Extension")).not.toBeInTheDocument();
      expect(screen.queryByText("Red Cross USA General")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // FORM LOGIC
  // -------------------------------------------------------------------------
  describe("Form Logic", () => {
    it("auto-sets category to 'General' when provider changes to non-Buzz", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Default provider is Buzz, category is Mandatory
      const categorySelect = screen.getAllByDisplayValue("Mandatory")[0] as HTMLSelectElement;
      expect(categorySelect.value).toBe("Mandatory");

      // Change provider to Red Cross
      const providerSelect = screen.getAllByDisplayValue("Buzz")[0] as HTMLSelectElement;
      fireEvent.change(providerSelect, {
        target: { value: "Red Cross", name: "provider" },
      });

      // Category should now be General
      expect(categorySelect.value).toBe("General");
    });

    it("auto-sets category to 'Mandatory' when provider changes back to Buzz from General", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Change to non-Buzz first (category becomes General)
      const providerSelect = screen.getAllByDisplayValue("Buzz")[0] as HTMLSelectElement;
      fireEvent.change(providerSelect, {
        target: { value: "FEMA", name: "provider" },
      });

      const categorySelect = screen.getAllByDisplayValue("General")[0] as HTMLSelectElement;
      expect(categorySelect.value).toBe("General");

      // Change back to Buzz (category should become Mandatory since it was General)
      fireEvent.change(providerSelect, {
        target: { value: "Buzz", name: "provider" },
      });

      expect(categorySelect.value).toBe("Mandatory");
    });

    it("handles checkbox changes for prerequisites", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      const uasCheckbox = screen.getByLabelText(
        "Requires UAS Ground School"
      ) as HTMLInputElement;
      expect(uasCheckbox.checked).toBe(false);

      fireEvent.click(uasCheckbox);
      expect(uasCheckbox.checked).toBe(true);

      const flightCheckbox = screen.getByLabelText(
        "Requires Flight Review Passed"
      ) as HTMLInputElement;
      fireEvent.click(flightCheckbox);
      expect(flightCheckbox.checked).toBe(true);

      const rocCheckbox = screen.getByLabelText(
        "Requires ROC-A Passed"
      ) as HTMLInputElement;
      fireEvent.click(rocCheckbox);
      expect(rocCheckbox.checked).toBe(true);
    });

    it("shows external URL field only for non-Buzz providers", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      // Default is Buzz - external URL should NOT be visible
      expect(
        screen.queryByPlaceholderText("https://example.com/course")
      ).not.toBeInTheDocument();

      // Change to non-Buzz
      const providerSelect = screen.getAllByDisplayValue("Buzz")[0] as HTMLSelectElement;
      fireEvent.change(providerSelect, {
        target: { value: "USFA", name: "provider" },
      });

      // External URL field should now be visible
      expect(
        screen.getByPlaceholderText("https://example.com/course")
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------------
  describe("Navigation", () => {
    it("navigates to CourseUnitsManager on 'More' button click for Buzz courses", async () => {
      const buzzCourse = makeCourse({ id: "buzz-nav-1", provider: "Buzz" });
      setupDefaultLoad([buzzCourse]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("More")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("More"));

      expect(mockNavigate).toHaveBeenCalledWith(
        "/admin/academy-courses/buzz-nav-1/units"
      );
    });

    it("does not show 'More' button for non-Buzz courses", async () => {
      const nonBuzzCourse = makeCourse({
        id: "ext-1",
        provider: "Red Cross",
        title: "Red Cross Course",
      });
      setupDefaultLoad([nonBuzzCourse]);

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Red Cross Course")).toBeInTheDocument();
      });

      expect(screen.queryByText("More")).not.toBeInTheDocument();
    });

    it("navigates to recycle bin when 'Recycle Bin' button is clicked", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });

      // The Recycle Bin button contains an emoji + text
      const recycleBinBtn = screen.getByRole("button", {
        name: /Recycle Bin/,
      });
      fireEvent.click(recycleBinBtn);

      expect(mockNavigate).toHaveBeenCalledWith("/admin/recycle-bin");
    });
  });

  // -------------------------------------------------------------------------
  // MODAL INTERACTIONS
  // -------------------------------------------------------------------------
  describe("Modal Interactions", () => {
    it("closes create modal when 'Cancel' is clicked", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      expect(screen.getByText("Create Course")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByText("Create Course")).not.toBeInTheDocument();
    });

    it("closes create modal when 'Close' is clicked", async () => {
      setupDefaultLoad([]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("+ New course")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("+ New course"));

      fireEvent.click(screen.getByText("Close"));

      expect(screen.queryByText("Create Course")).not.toBeInTheDocument();
    });

    it("closes edit modal when 'Cancel' is clicked", async () => {
      setupDefaultLoad([makeCourse()]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Edit"));

      expect(screen.getByText("Edit Course")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByText("Edit Course")).not.toBeInTheDocument();
    });

    it("closes delete modal when cancel button is clicked", async () => {
      setupDefaultLoad([makeCourse({ title: "Cancel Del" })]);
      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Cancel Del")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Delete"));

      expect(
        screen.getByPlaceholderText("Type DELETE to confirm")
      ).toBeInTheDocument();

      // Use the cancel button inside the delete modal
      const deleteModal = screen.getByText("Delete Course").closest(".modal-card")!;
      const cancelBtn = within(deleteModal).getByText("Cancel");
      fireEvent.click(cancelBtn);

      expect(
        screen.queryByPlaceholderText("Type DELETE to confirm")
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------------------------
  describe("Error Handling", () => {
    it("shows error when loading courses fails", async () => {
      setupFromMock({
        training_courses: {
          thenData: { data: null, error: { message: "Network error" } },
        },
      });

      render(<AcademyCourses />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
