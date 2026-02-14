import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMediaHandlers } from "./useMediaHandlers";

describe("useMediaHandlers", () => {
  const markSlideCompleted = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handleVideoEnd marks current slide completed when no index passed", () => {
    const { result } = renderHook(() =>
      useMediaHandlers({ markSlideCompleted, currentSlideIndex: 2 })
    );

    result.current.handleVideoEnd();
    expect(markSlideCompleted).toHaveBeenCalledWith(2);
  });

  it("handleVideoEnd marks specific slide when index passed", () => {
    const { result } = renderHook(() =>
      useMediaHandlers({ markSlideCompleted, currentSlideIndex: 0 })
    );

    result.current.handleVideoEnd(5);
    expect(markSlideCompleted).toHaveBeenCalledWith(5);
  });

  it("handleImageLoad marks current slide completed", () => {
    const { result } = renderHook(() =>
      useMediaHandlers({ markSlideCompleted, currentSlideIndex: 3 })
    );

    result.current.handleImageLoad();
    expect(markSlideCompleted).toHaveBeenCalledWith(3);
  });

  it("handlePdfLoad marks current slide completed", () => {
    const { result } = renderHook(() =>
      useMediaHandlers({ markSlideCompleted, currentSlideIndex: 1 })
    );

    result.current.handlePdfLoad();
    expect(markSlideCompleted).toHaveBeenCalledWith(1);
  });
});
