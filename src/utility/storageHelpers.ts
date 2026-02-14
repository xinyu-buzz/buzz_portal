import { supabaseClient } from "./supabaseClient";

/**
 * Storage file management utilities for the recycle bin system.
 * Handles moving files to deleted folder, restoring them, and permanent deletion.
 */

export async function moveStorageFilesToDeleted(
  entityId: string,
  entityType: "course" | "unit" | "test" | "section" | "question",
  userId: string
): Promise<void> {
  const buckets = ["course-covers", "course-materials", "course-test-results"];
  const deletedFiles: any[] = [];

  for (const bucket of buckets) {
    try {
      // List all files recursively (Supabase .list() only returns one level)
      const listRecursive = async (
        bucketName: string,
        prefix: string
      ): Promise<{ name: string; fullPath: string }[]> => {
        const { data: items, error: lErr } = await supabaseClient.storage
          .from(bucketName)
          .list(prefix, { limit: 1000 });

        if (lErr || !items) return [];

        const results: { name: string; fullPath: string }[] = [];
        for (const item of items) {
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id) {
            // It's a file
            results.push({ name: item.name, fullPath: itemPath });
          } else {
            // It's a folder — recurse into it
            const nested = await listRecursive(bucketName, itemPath);
            results.push(...nested);
          }
        }
        return results;
      };

      const allFiles = await listRecursive(bucket, "");

      if (allFiles.length === 0) continue;

      // Filter files that contain the entityId in their path
      const relatedFiles = allFiles.filter(
        (file) => file.fullPath.includes(entityId)
      );

      for (const file of relatedFiles) {
        const originalPath = file.fullPath;
        const deletedPath = `deleted/${entityId}/${file.name}`;

        // Move file to deleted folder
        const { error: moveError } = await supabaseClient.storage
          .from(bucket)
          .move(originalPath, deletedPath);

        if (moveError) {
          console.error(`Error moving file ${originalPath}:`, moveError);
          continue;
        }

        // Track successfully moved file
        deletedFiles.push({
          bucket_name: bucket,
          original_path: originalPath,
          deleted_path: deletedPath,
          entity_type: entityType,
          entity_id: entityId,
          deleted_by: userId,
        });
      }
    } catch (error) {
      console.error(`Error processing bucket ${bucket}:`, error);
    }
  }

  // Save tracking records to database
  if (deletedFiles.length > 0) {
    const { error: insertError } = await supabaseClient
      .from("deleted_storage_files")
      .insert(deletedFiles);

    if (insertError) {
      console.error("Error tracking deleted files:", insertError);
    }
  }
}

export async function restoreStorageFiles(entityId: string): Promise<void> {
  // Get all tracked files for this entity
  const { data: files, error: fetchError } = await supabaseClient
    .from("deleted_storage_files")
    .select("*")
    .eq("entity_id", entityId);

  if (fetchError) {
    console.error("Error fetching deleted files:", fetchError);
    return;
  }

  if (!files || files.length === 0) return;

  // Restore each file
  for (const file of files) {
    try {
      const { error: moveError } = await supabaseClient.storage
        .from(file.bucket_name)
        .move(file.deleted_path, file.original_path);

      if (moveError) {
        console.error(
          `Error restoring file ${file.deleted_path}:`,
          moveError
        );
      }
    } catch (error) {
      console.error(`Error processing file restore:`, error);
    }
  }

  // Remove tracking records after restoration
  const { error: deleteError } = await supabaseClient
    .from("deleted_storage_files")
    .delete()
    .eq("entity_id", entityId);

  if (deleteError) {
    console.error("Error removing tracking records:", deleteError);
  }
}

export async function permanentlyDeleteStorageFiles(
  entityId: string
): Promise<void> {
  // Get all tracked files for this entity
  const { data: files, error: fetchError } = await supabaseClient
    .from("deleted_storage_files")
    .select("*")
    .eq("entity_id", entityId);

  if (fetchError) {
    console.error("Error fetching deleted files:", fetchError);
    return;
  }

  if (!files || files.length === 0) return;

  // Permanently delete each file
  for (const file of files) {
    try {
      const { error: deleteError } = await supabaseClient.storage
        .from(file.bucket_name)
        .remove([file.deleted_path]);

      if (deleteError) {
        console.error(
          `Error deleting file ${file.deleted_path}:`,
          deleteError
        );
      }
    } catch (error) {
      console.error(`Error processing file deletion:`, error);
    }
  }

  // Remove tracking records
  const { error: deleteRecordsError } = await supabaseClient
    .from("deleted_storage_files")
    .delete()
    .eq("entity_id", entityId);

  if (deleteRecordsError) {
    console.error("Error removing tracking records:", deleteRecordsError);
  }
}

/**
 * Get count of storage files associated with an entity
 */
export async function getStorageFileCount(entityId: string): Promise<number> {
  const { count, error } = await supabaseClient
    .from("deleted_storage_files")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId);

  if (error) {
    console.error("Error getting storage file count:", error);
    return 0;
  }

  return count || 0;
}
