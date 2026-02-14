import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStorageBucket, mockQueryBuilder, mockFrom, mockStorageFrom } =
  vi.hoisted(() => {
    return {
      mockStorageBucket: {
        list: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
      },
      mockQueryBuilder: {
        select: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        eq: vi.fn(),
      },
      mockFrom: vi.fn(),
      mockStorageFrom: vi.fn(),
    };
  });

vi.mock("./supabaseClient", () => ({
  supabaseClient: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

import {
  moveStorageFilesToDeleted,
  restoreStorageFiles,
  permanentlyDeleteStorageFiles,
  getStorageFileCount,
} from "./storageHelpers";

describe("storageHelpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Re-configure mock defaults after reset
    mockFrom.mockReturnValue(mockQueryBuilder);
    mockStorageFrom.mockReturnValue(mockStorageBucket);

    // Chainable methods return the builder for chaining
    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);

    // Terminal methods return promises
    mockQueryBuilder.eq.mockResolvedValue({
      data: null,
      error: null,
      count: null,
    });
    mockQueryBuilder.insert.mockResolvedValue({ error: null });

    // Storage defaults
    mockStorageBucket.list.mockResolvedValue({ data: [], error: null });
    mockStorageBucket.move.mockResolvedValue({ error: null });
    mockStorageBucket.remove.mockResolvedValue({ data: [], error: null });
  });

  // ─── moveStorageFilesToDeleted ──────────────────────────────────────────

  describe("moveStorageFilesToDeleted", () => {
    const entityId = "entity-123";
    const entityType = "course" as const;
    const userId = "user-456";

    it("should recursively list, move matching files, and insert tracking records", async () => {
      mockStorageBucket.list
        // course-covers: root lists a folder named entityId
        .mockResolvedValueOnce({
          data: [{ name: entityId }], // folder (no id)
          error: null,
        })
        // course-covers: recurse into folder, find a file
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: "cover.jpg" }],
          error: null,
        })
        // course-materials: direct file matching entityId at root
        .mockResolvedValueOnce({
          data: [{ id: "f2", name: `${entityId}_material.pdf` }],
          error: null,
        })
        // course-test-results: empty
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      // Verify moves
      expect(mockStorageBucket.move).toHaveBeenCalledTimes(2);
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `${entityId}/cover.jpg`,
        `deleted/${entityId}/cover.jpg`
      );
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `${entityId}_material.pdf`,
        `deleted/${entityId}/${entityId}_material.pdf`
      );

      // Verify storage.from called with each bucket
      expect(mockStorageFrom).toHaveBeenCalledWith("course-covers");
      expect(mockStorageFrom).toHaveBeenCalledWith("course-materials");
      expect(mockStorageFrom).toHaveBeenCalledWith("course-test-results");

      // Verify tracking records inserted
      expect(mockFrom).toHaveBeenCalledWith("deleted_storage_files");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
        {
          bucket_name: "course-covers",
          original_path: `${entityId}/cover.jpg`,
          deleted_path: `deleted/${entityId}/cover.jpg`,
          entity_type: entityType,
          entity_id: entityId,
          deleted_by: userId,
        },
        {
          bucket_name: "course-materials",
          original_path: `${entityId}_material.pdf`,
          deleted_path: `deleted/${entityId}/${entityId}_material.pdf`,
          entity_type: entityType,
          entity_id: entityId,
          deleted_by: userId,
        },
      ]);
    });

    it("should filter files by entityId in path", async () => {
      mockStorageBucket.list
        .mockResolvedValueOnce({
          data: [
            { id: "f1", name: `${entityId}_file.jpg` }, // matches
            { id: "f2", name: "other-entity_file.jpg" }, // no match
          ],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(mockStorageBucket.move).toHaveBeenCalledTimes(1);
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `${entityId}_file.jpg`,
        `deleted/${entityId}/${entityId}_file.jpg`
      );
    });

    it("should not insert tracking records when no files are found", async () => {
      // All buckets return empty (default mock behavior)
      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(mockStorageBucket.move).not.toHaveBeenCalled();
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should continue processing when an individual move fails", async () => {
      mockStorageBucket.list
        .mockResolvedValueOnce({
          data: [
            { id: "f1", name: `${entityId}_a.jpg` },
            { id: "f2", name: `${entityId}_b.jpg` },
          ],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      mockStorageBucket.move
        .mockResolvedValueOnce({ error: new Error("Move failed") })
        .mockResolvedValueOnce({ error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error moving file"),
        expect.any(Error)
      );
      // Only the second (successful) file is tracked
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          original_path: `${entityId}_b.jpg`,
        }),
      ]);
    });

    it("should log error when insert tracking records fails", async () => {
      mockStorageBucket.list
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: `${entityId}_file.jpg` }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      mockQueryBuilder.insert.mockResolvedValueOnce({
        error: new Error("Insert failed"),
      });

      // Should not throw
      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(console.error).toHaveBeenCalledWith(
        "Error tracking deleted files:",
        expect.any(Error)
      );
    });

    it("should catch and log bucket processing errors and continue", async () => {
      // First bucket throws, others are fine
      mockStorageBucket.list
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: `${entityId}_file.jpg` }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error processing bucket course-covers"),
        expect.any(Error)
      );
      // Second bucket still processed - file moved
      expect(mockStorageBucket.move).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle list returning an error gracefully", async () => {
      mockStorageBucket.list
        .mockResolvedValueOnce({
          data: null,
          error: new Error("List error"),
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      // List error returns empty array, so no files, no moves
      expect(mockStorageBucket.move).not.toHaveBeenCalled();
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should handle deeply nested directory structures", async () => {
      mockStorageBucket.list
        // course-covers root: folder "level1"
        .mockResolvedValueOnce({
          data: [{ name: "level1" }],
          error: null,
        })
        // level1: nested folder matching entityId
        .mockResolvedValueOnce({
          data: [{ name: entityId }],
          error: null,
        })
        // level1/entity-123: a file
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: "deep-file.jpg" }],
          error: null,
        })
        // course-materials: empty
        .mockResolvedValueOnce({ data: [], error: null })
        // course-test-results: empty
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `level1/${entityId}/deep-file.jpg`,
        `deleted/${entityId}/deep-file.jpg`
      );
    });

    it("should pass entityType through to tracking records", async () => {
      mockStorageBucket.list
        .mockResolvedValueOnce({
          data: [{ id: "f1", name: `${entityId}_file.jpg` }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, "question", userId);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({ entity_type: "question" }),
      ]);
    });

    it("should handle mixed folders and files at the same level", async () => {
      mockStorageBucket.list
        // Root has both a folder and a file
        .mockResolvedValueOnce({
          data: [
            { name: "subfolder" }, // folder (no id)
            { id: "f1", name: `${entityId}_root.jpg` }, // file at root
          ],
          error: null,
        })
        // Recurse into subfolder: has a matching file
        .mockResolvedValueOnce({
          data: [{ id: "f2", name: `${entityId}_nested.jpg` }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await moveStorageFilesToDeleted(entityId, entityType, userId);

      expect(mockStorageBucket.move).toHaveBeenCalledTimes(2);
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `${entityId}_root.jpg`,
        `deleted/${entityId}/${entityId}_root.jpg`
      );
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        `subfolder/${entityId}_nested.jpg`,
        `deleted/${entityId}/${entityId}_nested.jpg`
      );
    });
  });

  // ─── restoreStorageFiles ───────────────────────────────────────────────

  describe("restoreStorageFiles", () => {
    const entityId = "entity-123";
    const mockFiles = [
      {
        id: 1,
        bucket_name: "course-covers",
        original_path: "entity-123/cover.jpg",
        deleted_path: "deleted/entity-123/cover.jpg",
        entity_id: entityId,
      },
      {
        id: 2,
        bucket_name: "course-materials",
        original_path: "entity-123/material.pdf",
        deleted_path: "deleted/entity-123/material.pdf",
        entity_id: entityId,
      },
    ];

    it("should restore files and delete tracking records", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null }) // select().eq()
        .mockResolvedValueOnce({ error: null }); // delete().eq()

      await restoreStorageFiles(entityId);

      // Verify files moved back to original paths
      expect(mockStorageBucket.move).toHaveBeenCalledTimes(2);
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        "deleted/entity-123/cover.jpg",
        "entity-123/cover.jpg"
      );
      expect(mockStorageBucket.move).toHaveBeenCalledWith(
        "deleted/entity-123/material.pdf",
        "entity-123/material.pdf"
      );

      // Verify storage.from called with correct bucket names
      expect(mockStorageFrom).toHaveBeenCalledWith("course-covers");
      expect(mockStorageFrom).toHaveBeenCalledWith("course-materials");

      // Verify DB operations
      expect(mockFrom).toHaveBeenCalledWith("deleted_storage_files");
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("entity_id", entityId);
    });

    it("should return early when no tracking records found (empty array)", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });

      await restoreStorageFiles(entityId);

      expect(mockStorageBucket.move).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should return early when data is null", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

      await restoreStorageFiles(entityId);

      expect(mockStorageBucket.move).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should return early and log on fetch error", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: new Error("Fetch failed"),
      });

      await restoreStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching deleted files:",
        expect.any(Error)
      );
      expect(mockStorageBucket.move).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should continue restoring other files when individual move returns error", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: null });

      mockStorageBucket.move
        .mockResolvedValueOnce({ error: new Error("Move failed") })
        .mockResolvedValueOnce({ error: null });

      await restoreStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error restoring file"),
        expect.any(Error)
      );
      // Both moves attempted
      expect(mockStorageBucket.move).toHaveBeenCalledTimes(2);
      // Tracking records still deleted
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it("should handle move throwing an exception and continue", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: null });

      mockStorageBucket.move
        .mockRejectedValueOnce(new Error("Network crash"))
        .mockResolvedValueOnce({ error: null });

      await restoreStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error processing file restore:",
        expect.any(Error)
      );
      // Second file still attempted, tracking records cleaned up
      expect(mockStorageBucket.move).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it("should log error when deleting tracking records fails", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: new Error("Delete failed") });

      await restoreStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error removing tracking records:",
        expect.any(Error)
      );
    });
  });

  // ─── permanentlyDeleteStorageFiles ─────────────────────────────────────

  describe("permanentlyDeleteStorageFiles", () => {
    const entityId = "entity-123";
    const mockFiles = [
      {
        id: 1,
        bucket_name: "course-covers",
        deleted_path: "deleted/entity-123/cover.jpg",
        entity_id: entityId,
      },
      {
        id: 2,
        bucket_name: "course-materials",
        deleted_path: "deleted/entity-123/material.pdf",
        entity_id: entityId,
      },
    ];

    it("should permanently delete files and remove tracking records", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: null });

      await permanentlyDeleteStorageFiles(entityId);

      // Verify remove called with correct paths (wrapped in arrays)
      expect(mockStorageBucket.remove).toHaveBeenCalledTimes(2);
      expect(mockStorageBucket.remove).toHaveBeenCalledWith([
        "deleted/entity-123/cover.jpg",
      ]);
      expect(mockStorageBucket.remove).toHaveBeenCalledWith([
        "deleted/entity-123/material.pdf",
      ]);

      // Verify correct buckets used
      expect(mockStorageFrom).toHaveBeenCalledWith("course-covers");
      expect(mockStorageFrom).toHaveBeenCalledWith("course-materials");

      // Verify tracking records removed
      expect(mockFrom).toHaveBeenCalledWith("deleted_storage_files");
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it("should return early when no tracking records found (empty array)", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });

      await permanentlyDeleteStorageFiles(entityId);

      expect(mockStorageBucket.remove).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should return early when data is null", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

      await permanentlyDeleteStorageFiles(entityId);

      expect(mockStorageBucket.remove).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should return early and log on fetch error", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: new Error("Fetch failed"),
      });

      await permanentlyDeleteStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching deleted files:",
        expect.any(Error)
      );
      expect(mockStorageBucket.remove).not.toHaveBeenCalled();
      expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
    });

    it("should continue when individual remove returns error", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: null });

      mockStorageBucket.remove
        .mockResolvedValueOnce({ error: new Error("Remove failed") })
        .mockResolvedValueOnce({ data: [], error: null });

      await permanentlyDeleteStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting file"),
        expect.any(Error)
      );
      // Both removes attempted
      expect(mockStorageBucket.remove).toHaveBeenCalledTimes(2);
      // Tracking records still cleaned up
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it("should handle remove throwing an exception and continue", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: null });

      mockStorageBucket.remove
        .mockRejectedValueOnce(new Error("Network crash"))
        .mockResolvedValueOnce({ data: [], error: null });

      await permanentlyDeleteStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error processing file deletion:",
        expect.any(Error)
      );
      expect(mockStorageBucket.remove).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it("should log error when deleting tracking records fails", async () => {
      mockQueryBuilder.eq
        .mockResolvedValueOnce({ data: mockFiles, error: null })
        .mockResolvedValueOnce({ error: new Error("Delete records failed") });

      await permanentlyDeleteStorageFiles(entityId);

      expect(console.error).toHaveBeenCalledWith(
        "Error removing tracking records:",
        expect.any(Error)
      );
    });
  });

  // ─── getStorageFileCount ───────────────────────────────────────────────

  describe("getStorageFileCount", () => {
    const entityId = "entity-123";

    it("should return the correct count", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        count: 5,
        error: null,
      });

      const result = await getStorageFileCount(entityId);

      expect(result).toBe(5);
      expect(mockFrom).toHaveBeenCalledWith("deleted_storage_files");
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("entity_id", entityId);
    });

    it("should return 0 on error", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        count: null,
        error: new Error("Query failed"),
      });

      const result = await getStorageFileCount(entityId);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Error getting storage file count:",
        expect.any(Error)
      );
    });

    it("should return 0 when count is null", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        count: null,
        error: null,
      });

      const result = await getStorageFileCount(entityId);

      expect(result).toBe(0);
    });

    it("should return 0 when count is zero", async () => {
      mockQueryBuilder.eq.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      const result = await getStorageFileCount(entityId);

      expect(result).toBe(0);
    });
  });
});
