import { vi } from "vitest";

export const mockUseList = vi.fn().mockReturnValue({
  data: { data: [], total: 0 },
  isLoading: false,
  isError: false,
});

export const mockUseOne = vi.fn().mockReturnValue({
  data: { data: null },
  isLoading: false,
  isError: false,
});

export const mockUseCreate = vi.fn().mockReturnValue({
  mutate: vi.fn(),
  isLoading: false,
});

export const mockUseUpdate = vi.fn().mockReturnValue({
  mutate: vi.fn(),
  isLoading: false,
});

export const mockUseDelete = vi.fn().mockReturnValue({
  mutate: vi.fn(),
  isLoading: false,
});

export const mockUseNavigation = vi.fn().mockReturnValue({
  list: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  show: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  goBack: vi.fn(),
});

export const mockUseGetIdentity = vi.fn().mockReturnValue({
  data: null,
  isLoading: false,
});

vi.mock("@refinedev/core", async () => {
  const actual = await vi.importActual<typeof import("@refinedev/core")>(
    "@refinedev/core"
  );
  return {
    ...actual,
    useList: (...args: unknown[]) => mockUseList(...args),
    useOne: (...args: unknown[]) => mockUseOne(...args),
    useCreate: (...args: unknown[]) => mockUseCreate(...args),
    useUpdate: (...args: unknown[]) => mockUseUpdate(...args),
    useDelete: (...args: unknown[]) => mockUseDelete(...args),
    useNavigation: (...args: unknown[]) => mockUseNavigation(...args),
    useGetIdentity: (...args: unknown[]) => mockUseGetIdentity(...args),
    Authenticated: ({ children }: { children: React.ReactNode }) => children,
  };
});
