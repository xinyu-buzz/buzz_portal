import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";
import { restoreStorageFiles, permanentlyDeleteStorageFiles } from "../../utility/storageHelpers";

type DeletedItem = {
  id: string;
  type: "course" | "section" | "unit" | "test" | "question";
  title: string;
  deleted_at: string;
  deleted_by: string;
  deleted_by_name: string;
  parent_name?: string;
  days_remaining: number;
  has_storage_files: boolean;
};

export const RecycleBin = () => {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "course" | "section" | "unit" | "test" | "question">("all");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedItems();
  }, []);

  const loadDeletedItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const allItems: DeletedItem[] = [];

      // Load deleted courses
      const { data: courses, error: coursesError } = await supabaseClient
        .from("training_courses")
        .select(`
          id,
          title,
          deleted_at,
          deleted_by,
          profiles:deleted_by (first_name, last_name)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (coursesError) throw coursesError;

      if (courses) {
        for (const course of courses) {
          const profile = (course as any).profiles;
          const deletedByName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown";

          // Check for storage files
          const { count: storageCount } = await supabaseClient
            .from("deleted_storage_files")
            .select("id", { count: "exact", head: true })
            .eq("entity_id", course.id);

          const daysRemaining = Math.max(
            0,
            30 - Math.floor((Date.now() - new Date(course.deleted_at).getTime()) / (1000 * 60 * 60 * 24))
          );

          allItems.push({
            id: course.id,
            type: "course",
            title: course.title,
            deleted_at: course.deleted_at,
            deleted_by: course.deleted_by,
            deleted_by_name: deletedByName,
            days_remaining: daysRemaining,
            has_storage_files: (storageCount ?? 0) > 0,
          });
        }
      }

      // Load deleted sections
      const { data: sections, error: sectionsError } = await supabaseClient
        .from("course_sections")
        .select(`
          id,
          name,
          deleted_at,
          deleted_by,
          course_id,
          training_courses!inner (title),
          profiles:deleted_by (first_name, last_name)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (sectionsError) throw sectionsError;

      if (sections) {
        for (const section of sections) {
          const profile = (section as any).profiles;
          const deletedByName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown";

          const daysRemaining = Math.max(
            0,
            30 - Math.floor((Date.now() - new Date(section.deleted_at).getTime()) / (1000 * 60 * 60 * 24))
          );

          allItems.push({
            id: section.id,
            type: "section",
            title: section.name,
            deleted_at: section.deleted_at,
            deleted_by: section.deleted_by,
            deleted_by_name: deletedByName,
            parent_name: (section as any).training_courses?.title,
            days_remaining: daysRemaining,
            has_storage_files: false,
          });
        }
      }

      // Load deleted units
      const { data: units, error: unitsError } = await supabaseClient
        .from("course_units")
        .select(`
          id,
          title,
          deleted_at,
          deleted_by,
          course_id,
          training_courses!inner (title),
          profiles:deleted_by (first_name, last_name)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (unitsError) throw unitsError;

      if (units) {
        for (const unit of units) {
          const profile = (unit as any).profiles;
          const deletedByName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown";

          const { count: unitStorageCount } = await supabaseClient
            .from("deleted_storage_files")
            .select("id", { count: "exact", head: true })
            .eq("entity_id", unit.id);

          const daysRemaining = Math.max(
            0,
            30 - Math.floor((Date.now() - new Date(unit.deleted_at).getTime()) / (1000 * 60 * 60 * 24))
          );

          allItems.push({
            id: unit.id,
            type: "unit",
            title: unit.title,
            deleted_at: unit.deleted_at,
            deleted_by: unit.deleted_by,
            deleted_by_name: deletedByName,
            parent_name: (unit as any).training_courses?.title,
            days_remaining: daysRemaining,
            has_storage_files: (unitStorageCount ?? 0) > 0,
          });
        }
      }

      // Load deleted tests
      const { data: tests, error: testsError } = await supabaseClient
        .from("course_tests")
        .select(`
          id,
          test_name,
          deleted_at,
          deleted_by,
          course_id,
          training_courses!inner (title),
          profiles:deleted_by (first_name, last_name)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (testsError) throw testsError;

      if (tests) {
        for (const test of tests) {
          const profile = (test as any).profiles;
          const deletedByName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown";

          const { count: testStorageCount } = await supabaseClient
            .from("deleted_storage_files")
            .select("id", { count: "exact", head: true })
            .eq("entity_id", test.id);

          const daysRemaining = Math.max(
            0,
            30 - Math.floor((Date.now() - new Date(test.deleted_at).getTime()) / (1000 * 60 * 60 * 24))
          );

          allItems.push({
            id: test.id,
            type: "test",
            title: test.test_name,
            deleted_at: test.deleted_at,
            deleted_by: test.deleted_by,
            deleted_by_name: deletedByName,
            parent_name: (test as any).training_courses?.title,
            days_remaining: daysRemaining,
            has_storage_files: (testStorageCount ?? 0) > 0,
          });
        }
      }

      // Load deleted questions
      const { data: questions, error: questionsError } = await supabaseClient
        .from("test_questions")
        .select(`
          id,
          question_text,
          deleted_at,
          deleted_by,
          test_id,
          course_tests!inner (test_name),
          profiles:deleted_by (first_name, last_name)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (questionsError) throw questionsError;

      if (questions) {
        for (const question of questions) {
          const profile = (question as any).profiles;
          const deletedByName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown";

          const daysRemaining = Math.max(
            0,
            30 - Math.floor((Date.now() - new Date(question.deleted_at).getTime()) / (1000 * 60 * 60 * 24))
          );

          allItems.push({
            id: question.id,
            type: "question",
            title: question.question_text.substring(0, 100) + (question.question_text.length > 100 ? "..." : ""),
            deleted_at: question.deleted_at,
            deleted_by: question.deleted_by,
            deleted_by_name: deletedByName,
            parent_name: (question as any).course_tests?.test_name,
            days_remaining: daysRemaining,
            has_storage_files: false,
          });
        }
      }

      setItems(allItems);
    } catch (err: any) {
      console.error("Error loading deleted items:", err);
      setError(err.message);
    }

    setLoading(false);
  };

  const handleRestore = async (item: DeletedItem) => {
    if (!confirm(`Restore "${item.title}"? It will return to the active list.`)) return;

    setProcessing(item.id);
    setError(null);

    try {
      const tableName =
        item.type === "course"
          ? "training_courses"
          : item.type === "section"
          ? "course_sections"
          : item.type === "unit"
          ? "course_units"
          : item.type === "test"
          ? "course_tests"
          : "test_questions";

      // Clear deleted_at and deleted_by
      const { error: restoreError } = await supabaseClient
        .from(tableName)
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", item.id);

      if (restoreError) throw restoreError;

      // For courses, restore active status
      if (item.type === "course") {
        await supabaseClient
          .from("training_courses")
          .update({ active: true })
          .eq("id", item.id);
      }

      // Restore storage files if any
      if (item.has_storage_files) {
        await restoreStorageFiles(item.id);
      }

      await loadDeletedItems();
    } catch (err: any) {
      console.error("Error restoring item:", err);
      setError(err.message);
    }

    setProcessing(null);
  };

  // Core delete logic without UI confirmation — used by both single delete and bulk cleanup
  const permanentlyDeleteItem = async (item: DeletedItem) => {
    const tableName =
      item.type === "course"
        ? "training_courses"
        : item.type === "section"
        ? "course_sections"
        : item.type === "unit"
        ? "course_units"
        : item.type === "test"
        ? "course_tests"
        : "test_questions";

    // Permanently delete storage files
    if (item.has_storage_files) {
      await permanentlyDeleteStorageFiles(item.id);
    }

    // Hard delete from database.
    // Authorization is enforced by Supabase RLS policies — the client-side
    // confirmation dialog is for UX only.
    const { error: deleteError } = await supabaseClient.from(tableName).delete().eq("id", item.id);

    if (deleteError) throw deleteError;
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    if (
      !confirm(
        `PERMANENTLY DELETE "${item.title}"? This cannot be undone!\n\nThis will also delete all storage files associated with this item.`
      )
    )
      return;

    setProcessing(item.id);
    setError(null);

    try {
      await permanentlyDeleteItem(item);
      await loadDeletedItems();
    } catch (err: any) {
      console.error("Error permanently deleting item:", err);
      setError(err.message);
    }

    setProcessing(null);
  };

  const handleCleanupExpired = async () => {
    if (!confirm("Delete all items that have expired (30+ days in recycle bin)? This cannot be undone!")) return;

    setProcessing("cleanup");
    setError(null);

    try {
      const expiredItems = items.filter((item) => item.days_remaining <= 0);
      const failedItems: string[] = [];

      for (const item of expiredItems) {
        try {
          await permanentlyDeleteItem(item);
        } catch (err) {
          console.error(`Error cleaning up expired item "${item.title}":`, err);
          failedItems.push(item.title);
        }
      }

      await loadDeletedItems();

      if (failedItems.length > 0) {
        setError(
          `Failed to permanently delete ${failedItems.length} expired item${failedItems.length === 1 ? "" : "s"}: ${failedItems.join(", ")}`
        );
      }
    } catch (err: any) {
      console.error("Error cleaning up expired items:", err);
      setError(err.message);
    }

    setProcessing(null);
  };

  const getAgeColor = (daysRemaining: number) => {
    if (daysRemaining > 20) return "#22c55e"; // green
    if (daysRemaining > 10) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const filteredItems = filter === "all" ? items : items.filter((item) => item.type === filter);

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Recycle Bin</h1>
        <button className="ghost-btn" onClick={loadDeletedItems} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <p style={{ color: "#9ca3b5", marginBottom: 16 }}>
          Items in the recycle bin will be permanently deleted after 30 days. You can restore or permanently delete
          items manually.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className={filter === "all" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("all")}
            style={{ fontSize: 14 }}
          >
            All ({items.length})
          </button>
          <button
            className={filter === "course" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("course")}
            style={{ fontSize: 14 }}
          >
            Courses ({items.filter((i) => i.type === "course").length})
          </button>
          <button
            className={filter === "section" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("section")}
            style={{ fontSize: 14 }}
          >
            Sections ({items.filter((i) => i.type === "section").length})
          </button>
          <button
            className={filter === "unit" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("unit")}
            style={{ fontSize: 14 }}
          >
            Units ({items.filter((i) => i.type === "unit").length})
          </button>
          <button
            className={filter === "test" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("test")}
            style={{ fontSize: 14 }}
          >
            Tests ({items.filter((i) => i.type === "test").length})
          </button>
          <button
            className={filter === "question" ? "primary-btn" : "ghost-btn"}
            onClick={() => setFilter("question")}
            style={{ fontSize: 14 }}
          >
            Questions ({items.filter((i) => i.type === "question").length})
          </button>
          {items.filter((item) => item.days_remaining <= 0).length > 0 && (
            <button
              className="ghost-btn"
              onClick={handleCleanupExpired}
              disabled={processing === "cleanup"}
              style={{ marginLeft: "auto", fontSize: 14, color: "#ef4444" }}
            >
              Clean Up Expired ({items.filter((item) => item.days_remaining <= 0).length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Parent</th>
                <th>Deleted By</th>
                <th>Deleted Date</th>
                <th>Days Remaining</th>
                <th>Storage Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: "rgba(107, 140, 174, 0.2)",
                        color: "#6b8cae",
                        textTransform: "capitalize",
                      }}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td>{item.title}</td>
                  <td style={{ color: "#9ca3b5", fontSize: "14px" }}>{item.parent_name || "-"}</td>
                  <td>{item.deleted_by_name}</td>
                  <td>{new Date(item.deleted_at).toLocaleDateString()}</td>
                  <td>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: `${getAgeColor(item.days_remaining)}22`,
                        color: getAgeColor(item.days_remaining),
                      }}
                    >
                      {item.days_remaining} days
                    </span>
                  </td>
                  <td>{item.has_storage_files ? "Yes" : "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="primary-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => handleRestore(item)}
                        disabled={processing === item.id}
                      >
                        {processing === item.id ? "..." : "Restore"}
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "6px 10px", fontSize: 12, color: "#ef4444" }}
                        onClick={() => handlePermanentDelete(item)}
                        disabled={processing === item.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    No deleted items in recycle bin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
