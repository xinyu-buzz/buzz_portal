import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFullscreen } from "./useFullscreen";

describe("useFullscreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with isFullScreen false", () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullScreen).toBe(false);
  });

  it("provides a fullScreenRef", () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.fullScreenRef).toBeDefined();
  });

  it("enterFullScreen calls requestFullscreen on ref element", async () => {
    const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFullscreen());

    // Simulate attaching a DOM element to the ref
    Object.defineProperty(result.current.fullScreenRef, "current", {
      value: { requestFullscreen: mockRequestFullscreen },
      writable: true,
    });

    await act(async () => {
      await result.current.enterFullScreen();
    });

    expect(mockRequestFullscreen).toHaveBeenCalled();
  });

  it("exitFullScreen calls document.exitFullscreen when fullscreenElement exists", async () => {
    const mockExitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "fullscreenElement", {
      value: document.createElement("div"),
      writable: true,
      configurable: true,
    });
    document.exitFullscreen = mockExitFullscreen;

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.exitFullScreen();
    });

    expect(mockExitFullscreen).toHaveBeenCalled();

    // Cleanup
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  it("exitFullScreen does nothing when no fullscreenElement", async () => {
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      writable: true,
      configurable: true,
    });
    const mockExit = vi.fn();
    document.exitFullscreen = mockExit;

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.exitFullScreen();
    });

    expect(mockExit).not.toHaveBeenCalled();
  });

  it("responds to fullscreenchange event", () => {
    const { result } = renderHook(() => useFullscreen());

    Object.defineProperty(document, "fullscreenElement", {
      value: document.createElement("div"),
      writable: true,
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullScreen).toBe(true);

    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      writable: true,
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullScreen).toBe(false);
  });
});
