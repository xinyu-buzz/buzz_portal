import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSlideshowLogic,
  decodeBase64,
  getQuestionFromUrl,
  type CourseMaterial,
  type CourseUnit,
  type UseSlideshowLogicProps,
} from "./useSlideshowLogic";

describe("decodeBase64", () => {
  it("decodes a valid base64 string", () => {
    const encoded = btoa("Hello World");
    expect(decodeBase64(encoded)).toBe("Hello World");
  });

  it("returns empty string on invalid input", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(decodeBase64("%%%invalid%%%")).toBe("");
    consoleSpy.mockRestore();
  });
});

describe("getQuestionFromUrl", () => {
  it("decodes a valid data URL with question JSON", () => {
    const question = {
      question_text: "What is 2+2?",
      options: ["3", "4", "5"],
      correct_answer_index: 1,
      explanation: "Basic math",
    };
    const base64 = btoa(JSON.stringify(question));
    const url = `data:application/json;base64,${base64}`;

    const result = getQuestionFromUrl(url);
    expect(result).toEqual(question);
  });

  it("returns null for non-data URLs", () => {
    expect(getQuestionFromUrl("https://example.com/image.png")).toBeNull();
  });

  it("returns null for invalid base64 in data URL", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = getQuestionFromUrl("data:application/json;base64,%%%");
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe("useSlideshowLogic", () => {
  // Keep stable references to avoid useEffect infinite loops
  const mockUnit: CourseUnit = {
    id: "unit-1",
    title: "Test Unit",
    unit_number: 1,
  };

  const imageMaterial: CourseMaterial = {
    index: 0,
    name: "slide1.png",
    url: "https://example.com/slide1.png",
    type: "image",
    isVideo: false,
    isImage: true,
    isPDF: false,
  };

  const videoMaterial: CourseMaterial = {
    index: 1,
    name: "video1.mp4",
    url: "https://example.com/video1.mp4",
    type: "video",
    isVideo: true,
    isImage: false,
    isPDF: false,
  };

  const pdfMaterial: CourseMaterial = {
    index: 2,
    name: "doc.pdf",
    url: "https://example.com/doc.pdf",
    type: "pdf",
    isVideo: false,
    isImage: false,
    isPDF: true,
  };

  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: use initialProps pattern so object references stay stable across renders
  function renderSlideshow(props: UseSlideshowLogicProps) {
    return renderHook(
      (p: UseSlideshowLogicProps) => useSlideshowLogic(p),
      { initialProps: props }
    );
  }

  it("initializes with first slide", () => {
    const materials = [imageMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.currentSlideIndex).toBe(0);
    expect(result.current.selectedAnswer).toBeNull();
    expect(result.current.showAnswerFeedback).toBe(false);
    expect(result.current.isAnswerCorrect).toBeNull();
  });

  it("converts materials to slide contents", () => {
    const materials = [imageMaterial, videoMaterial, pdfMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.slideContents).toHaveLength(3);
    expect(result.current.slideContents[0].type).toBe("image");
    expect(result.current.slideContents[1].type).toBe("video");
    expect(result.current.slideContents[2].type).toBe("pdf");
  });

  it("prepends unit content slide when unit has content", () => {
    const unitWithContent: CourseUnit = {
      id: "unit-2",
      title: "Unit With Content",
      unit_number: 2,
      content: "Some unit content",
    };
    const materials = [imageMaterial];

    const { result } = renderSlideshow({ unit: unitWithContent, materials, onComplete });

    expect(result.current.slideContents).toHaveLength(2);
    expect(result.current.slideContents[0].name).toBe("Unit Content");
  });

  it("computes isLastSlide correctly for single slide", () => {
    const materials = [imageMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.isLastSlide).toBe(true);
  });

  it("computes progressPercentage", () => {
    const materials = [imageMaterial, videoMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    // First slide of 2 = 50%
    expect(result.current.progressPercentage).toBe(50);
  });

  it("returns 0 progress when no slides", () => {
    const materials: CourseMaterial[] = [];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.progressPercentage).toBe(0);
  });

  it("markSlideCompleted adds slide to completed set", () => {
    const materials = [imageMaterial, videoMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.markSlideCompleted(0);
    });

    expect(result.current.completedSlides.has(0)).toBe(true);
    expect(result.current.isCurrentSlideCompleted).toBe(true);
  });

  it("handleNextSlide advances when current slide is completed", () => {
    const materials = [imageMaterial, videoMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.markSlideCompleted(0);
    });

    act(() => {
      result.current.handleNextSlide();
    });

    expect(result.current.currentSlideIndex).toBe(1);
  });

  it("handleNextSlide does not advance when current slide not completed", () => {
    const materials = [imageMaterial, videoMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.handleNextSlide();
    });

    expect(result.current.currentSlideIndex).toBe(0);
  });

  it("handlePreviousSlide goes back", () => {
    const materials = [imageMaterial, videoMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.markSlideCompleted(0);
    });
    act(() => {
      result.current.handleNextSlide();
    });
    expect(result.current.currentSlideIndex).toBe(1);

    act(() => {
      result.current.handlePreviousSlide();
    });
    expect(result.current.currentSlideIndex).toBe(0);
  });

  it("handlePreviousSlide does nothing at slide 0", () => {
    const materials = [imageMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.handlePreviousSlide();
    });

    expect(result.current.currentSlideIndex).toBe(0);
  });

  it("resetQuestionState clears answer state", () => {
    const materials = [imageMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.setSelectedAnswer(2);
    });
    expect(result.current.selectedAnswer).toBe(2);

    act(() => {
      result.current.resetQuestionState();
    });

    expect(result.current.selectedAnswer).toBeNull();
    expect(result.current.showAnswerFeedback).toBe(false);
    expect(result.current.isAnswerCorrect).toBeNull();
  });

  it("calls onComplete when all slides are completed", () => {
    const materials = [imageMaterial];
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    act(() => {
      result.current.markSlideCompleted(0);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles question material with valid data URL", () => {
    const question = {
      question_text: "What?",
      options: ["A", "B"],
      correct_answer_index: 0,
      explanation: "Because",
    };
    const base64 = btoa(JSON.stringify(question));
    const questionMaterial: CourseMaterial = {
      index: 0,
      name: "Q1",
      url: `data:application/json;base64,${base64}`,
      type: "question",
      isVideo: false,
      isImage: false,
      isPDF: false,
      isQuestion: true,
    };
    const materials = [questionMaterial];

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.slideContents).toHaveLength(1);
    expect(result.current.slideContents[0].type).toBe("question");
    expect(result.current.slideContents[0].question?.question).toBe("What?");
    consoleSpy.mockRestore();
  });

  it("handles question material with invalid URL gracefully", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const questionMaterial: CourseMaterial = {
      index: 0,
      name: "Q1",
      url: "not-a-data-url",
      type: "question",
      isVideo: false,
      isImage: false,
      isPDF: false,
    };
    const materials = [questionMaterial];

    const { result } = renderSlideshow({ unit: mockUnit, materials, onComplete });

    expect(result.current.slideContents).toHaveLength(1);
    expect(result.current.slideContents[0].type).toBe("question");
    expect(result.current.slideContents[0].question?.question).toBe("Q1");
    consoleSpy.mockRestore();
  });
});
