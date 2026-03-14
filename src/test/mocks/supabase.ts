import { vi } from "vitest";

function createQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return builder;
}

function createStorageBucket() {
  return {
    upload: vi.fn().mockResolvedValue({ data: { path: "test-path" }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/test" } }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
}

export const mockSupabaseClient = {
  from: vi.fn().mockReturnValue(createQueryBuilder()),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  storage: {
    from: vi.fn().mockReturnValue(createStorageBucket()),
  },
};

vi.mock("../../utility/supabaseClient", () => ({
  supabaseClient: mockSupabaseClient,
}));
