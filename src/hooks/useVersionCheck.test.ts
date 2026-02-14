import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVersionCheck } from "./useVersionCheck";

describe("useVersionCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fetches version on mount", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 1 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderHook(() => useVersionCheck(60000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockFetch).toHaveBeenCalledWith("/version.json", expect.objectContaining({
      cache: "no-cache",
    }));
  });

  it("initially showRefreshPrompt is false", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 1 }),
    }));

    const { result } = renderHook(() => useVersionCheck(60000));
    expect(result.current.showRefreshPrompt).toBe(false);
  });

  it("does not show prompt when version unchanged", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 1 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useVersionCheck(1000));

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Second fetch with same version
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.showRefreshPrompt).toBe(false);
  });

  it("does not show prompt if fetch returns not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useVersionCheck(1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.showRefreshPrompt).toBe(false);
  });

  it("does not show prompt if fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useVersionCheck(1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.showRefreshPrompt).toBe(false);
    consoleSpy.mockRestore();
  });

  it("dismissPrompt sets showRefreshPrompt to false", async () => {
    const { result } = renderHook(() => useVersionCheck(60000));

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.showRefreshPrompt).toBe(false);
  });

  it("exposes refreshApp function", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 1 }),
    }));

    const { result } = renderHook(() => useVersionCheck());
    expect(result.current.refreshApp).toBeTypeOf("function");
  });
});
