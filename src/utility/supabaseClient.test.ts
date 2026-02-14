import { describe, it, expect, vi } from "vitest";

vi.mock("@refinedev/supabase", () => ({
  createClient: vi.fn().mockReturnValue({ mock: true }),
}));

describe("supabaseClient", () => {
  it("exports a supabaseClient created with correct config", async () => {
    const { supabaseClient } = await import("./supabaseClient");
    const { createClient } = await import("@refinedev/supabase");

    expect(createClient).toHaveBeenCalledWith(
      "https://mzapuczjijqjzdcujetx.supabase.co",
      expect.any(String),
      {
        db: { schema: "public" },
        auth: { persistSession: true },
      }
    );
    expect(supabaseClient).toBeDefined();
  });
});
