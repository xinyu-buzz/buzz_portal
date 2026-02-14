import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../test/test-utils";
import SlidePresentation from "./SlidePresentation";
import type { CourseUnit, CourseMaterial } from "./useSlideshowLogic";

// Mock the hooks used by SlidePresentation
vi.mock("./useSlideshowLogic", () => ({
  useSlideshowLogic: vi.fn().mockReturnValue({
    slideContents: [],
    currentSlideIndex: 0,
    currentSlide: null,
    completedSlides: new Set(),
    progressPercentage: 0,
    isLastSlide: false,
    isCurrentSlideCompleted: false,
    showAnswerFeedback: false,
    isAnswerCorrect: false,
    selectedAnswer: null,
    setSelectedAnswer: vi.fn(),
    handleAnswerSubmit: vi.fn(),
    resetQuestionState: vi.fn(),
    handleNextSlide: vi.fn(),
    handlePreviousSlide: vi.fn(),
    markSlideCompleted: vi.fn(),
  }),
}));

vi.mock("./useFullscreen", () => ({
  useFullscreen: vi.fn().mockReturnValue({
    isFullScreen: false,
    enterFullScreen: vi.fn(),
    exitFullScreen: vi.fn(),
    fullScreenRef: { current: null },
  }),
}));

vi.mock("./useMediaHandlers", () => ({
  useMediaHandlers: vi.fn().mockReturnValue({
    handleVideoEnd: vi.fn(),
    handleImageLoad: vi.fn(),
    handlePdfLoad: vi.fn(),
  }),
}));

const mockUnit: CourseUnit = {
  id: "unit-1",
  title: "Test Unit",
  unit_number: 1,
};

const mockMaterials: CourseMaterial[] = [];
const mockOnComplete = vi.fn();

describe("SlidePresentation", () => {
  it("shows empty state when no slides", () => {
    render(
      <SlidePresentation
        unit={mockUnit}
        materials={mockMaterials}
        onComplete={mockOnComplete}
      />
    );

    expect(
      screen.getByText("No presentation content available")
    ).toBeInTheDocument();
  });

  it("shows preview mode with start button when slides exist", async () => {
    const { useSlideshowLogic } = await import("./useSlideshowLogic");
    vi.mocked(useSlideshowLogic).mockReturnValueOnce({
      slideContents: [
        { type: "image", url: "https://example.com/slide1.jpg", name: "Slide 1" },
      ],
      currentSlideIndex: 0,
      currentSlide: {
        type: "image",
        url: "https://example.com/slide1.jpg",
        name: "Slide 1",
      },
      completedSlides: new Set<number>(),
      progressPercentage: 0,
      isLastSlide: true,
      isCurrentSlideCompleted: false,
      showAnswerFeedback: false,
      isAnswerCorrect: false,
      selectedAnswer: null,
      setSelectedAnswer: vi.fn(),
      handleAnswerSubmit: vi.fn(),
      resetQuestionState: vi.fn(),
      handleNextSlide: vi.fn(),
      handlePreviousSlide: vi.fn(),
      markSlideCompleted: vi.fn(),
    } as any);

    render(
      <SlidePresentation
        unit={mockUnit}
        materials={mockMaterials}
        onComplete={mockOnComplete}
      />
    );

    expect(
      screen.getByText("Click to start presentation")
    ).toBeInTheDocument();
  });

  it("transitions from preview to presentation mode on click", async () => {
    const { useSlideshowLogic } = await import("./useSlideshowLogic");
    vi.mocked(useSlideshowLogic).mockReturnValue({
      slideContents: [
        { type: "image", url: "https://example.com/slide1.jpg", name: "Slide 1" },
      ],
      currentSlideIndex: 0,
      currentSlide: {
        type: "image",
        url: "https://example.com/slide1.jpg",
        name: "Slide 1",
      },
      completedSlides: new Set<number>(),
      progressPercentage: 0,
      isLastSlide: true,
      isCurrentSlideCompleted: false,
      showAnswerFeedback: false,
      isAnswerCorrect: false,
      selectedAnswer: null,
      setSelectedAnswer: vi.fn(),
      handleAnswerSubmit: vi.fn(),
      resetQuestionState: vi.fn(),
      handleNextSlide: vi.fn(),
      handlePreviousSlide: vi.fn(),
      markSlideCompleted: vi.fn(),
    } as any);

    render(
      <SlidePresentation
        unit={mockUnit}
        materials={mockMaterials}
        onComplete={mockOnComplete}
      />
    );

    // Click the preview area to start
    fireEvent.click(screen.getByText("Click to start presentation"));

    // Should now show slide counter
    expect(screen.getByText("Slide 1 of 1")).toBeInTheDocument();
  });
});
