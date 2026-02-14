import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMove = vi.fn();
const mockRemove = vi.fn();
const mockList = vi.fn();
const mockStorageFrom = vi.fn().mockReturnValue({
  list: mockList,
  move: mockMove,
  remove: mockRemove,
});

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock("./supabaseClient", () => ({
  supabaseClient: {
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
    from: vi.fn().mockImplementation(() => ({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    })),
  },
}));

import {
  moveStorageFilesToDeleted,
  restoreStorageFiles,
  permanentlyDeleteStorageFiles,
  getStorageFileCount,
} from "./storageHelpers";
import { supabaseClient } from "./supabaseClient";

describe("storageHelpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: storage list returns empty
    mockList.mockResolvedValue({ data: [], error: null });
    mockMove.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ data: [], error: null });
  });

  describe("moveStorageFilesToDeleted", () => {
    it("does nothing when buckets have no files", async () => {
      mockList.mockResolvedValue({ data: [], error: null });

      await moveStorageFilesToDeleted("entity-1", "course", "user-1");

      expect(mockMove).not.toHaveBeenCalled();
    });

    it("moves matching files to deleted folder", async () => {
      // Return files that match entityId on first call, empty on subsequent
      mockList
        .mockResolvedValueOnce({
          data: [{ id: "file-1", name: "entity-1-cover.png" }],
          error: null,
        })
        .mockResolvedValue({ data: [], error: null });

      mockMove.mockResolvedValue({ error: null });

      // Mock the DB insert
      const mockInsertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockInsertChain);

      await moveStorageFilesToDeleted("entity-1", "course", "user-1");

      expect(mockMove).toHaveBeenCalledWith(
        "entity-1-cover.png",
        "deleted/entity-1/entity-1-cover.png"
      );
    });

    it("skips files that do not match entityId", async () => {
      mockList
        .mockResolvedValueOnce({
          data: [{ id: "file-1", name: "other-id-cover.png" }],
          error: null,
        })
        .mockResolvedValue({ data: [], error: null });

      await moveStorageFilesToDeleted("entity-1", "course", "user-1");

      expect(mockMove).not.toHaveBeenCalled();
    });

    it("handles move errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockList
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: "entity-1-file.png" }],
          error: null,
        })
        .mockResolvedValue({ data: [], error: null });

      mockMove.mockResolvedValue({ error: new Error("move failed") });

      await moveStorageFilesToDeleted("entity-1", "course", "user-1");

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles list errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockList.mockResolvedValue({ data: null, error: new Error("list failed") });

      await moveStorageFilesToDeleted("entity-1", "course", "user-1");

      expect(mockMove).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("restoreStorageFiles", () => {
    it("restores files and removes tracking records", async () => {
      const files = [
        {
          bucket_name: "course-covers",
          original_path: "cover.png",
          deleted_path: "deleted/e1/cover.png",
          entity_id: "e1",
        },
      ];

      const mockEqChain = vi.fn().mockResolvedValue({ data: files, error: null });
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: mockEqChain,
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      mockMove.mockResolvedValue({ error: null });

      await restoreStorageFiles("e1");

      expect(mockMove).toHaveBeenCalledWith("deleted/e1/cover.png", "cover.png");
    });

    it("returns early on fetch error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error("fetch error") }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      await restoreStorageFiles("e1");

      expect(mockMove).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("returns early when no files found", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      await restoreStorageFiles("e1");

      expect(mockMove).not.toHaveBeenCalled();
    });
  });

  describe("permanentlyDeleteStorageFiles", () => {
    it("removes files and tracking records", async () => {
      const files = [
        {
          bucket_name: "course-covers",
          deleted_path: "deleted/e1/cover.png",
          entity_id: "e1",
        },
      ];

      const mockEqChain = vi.fn().mockResolvedValue({ data: files, error: null });
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({ eq: mockEqChain }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      mockRemove.mockResolvedValue({ data: [], error: null });

      await permanentlyDeleteStorageFiles("e1");

      expect(mockRemove).toHaveBeenCalledWith(["deleted/e1/cover.png"]);
    });

    it("returns early on fetch error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error("err") }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      await permanentlyDeleteStorageFiles("e1");

      expect(mockRemove).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("getStorageFileCount", () => {
    it("returns count of files", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      const count = await getStorageFileCount("e1");
      expect(count).toBe(5);
    });

    it("returns 0 on error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: new Error("err") }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      const count = await getStorageFileCount("e1");
      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });

    it("returns 0 when count is null", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: null }),
        }),
      };
      (supabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain);

      const count = await getStorageFileCount("e1");
      expect(count).toBe(0);
    });
  });
});
