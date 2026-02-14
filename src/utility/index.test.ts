import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseClient", () => ({
  supabaseClient: { mock: true },
}));

describe("utility/index", () => {
  it("re-exports supabaseClient", async () => {
    const mod = await import("./index");
    expect(mod.supabaseClient).toBeDefined();
  });

  it("re-exports storage helper functions", async () => {
    const mod = await import("./index");
    expect(mod.moveStorageFilesToDeleted).toBeTypeOf("function");
    expect(mod.restoreStorageFiles).toBeTypeOf("function");
    expect(mod.permanentlyDeleteStorageFiles).toBeTypeOf("function");
    expect(mod.getStorageFileCount).toBeTypeOf("function");
  });
});
