import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type Enrollment = {
  id: string;
  pilot_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percentage: number;
  pilot_name?: string;
  pilot_email?: string;
  course_title?: string;
  course_region?: string;
  course_category?: string;
  course_provider?: string;
};

type Filter = {
  completionStatus: string | null;
  courseCategory: string | null;
  searchQuery: string;
};

const COMPLETION_STATUSES = ["in_progress", "completed"];
const COURSE_CATEGORIES = ["Mandatory", "Extension", "Intermediate", "Advanced", "Specialized", "General"];

export const AcademyEnrollment = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({
    completionStatus: null,
    courseCategory: null,
    searchQuery: "",
  });

  const loadEnrollments = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch enrollments with joined data
      let query = supabaseClient
        .from("course_enrollments")
        .select(`
          *,
          pilot:pilot_id (
            id,
            first_name,
            last_name,
            email
          ),
          course:course_id (
            id,
            title,
            region,
            category,
            provider
          )
        `)
        .order("enrolled_at", { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform data
      let results = (data || []).map((item: any) => {
        const firstName = item.pilot?.first_name || "";
        const lastName = item.pilot?.last_name || "";
        const pilotName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

        return {
          id: item.id,
          pilot_id: item.pilot_id,
          course_id: item.course_id,
          enrolled_at: item.enrolled_at,
          completed_at: item.completed_at,
          progress_percentage: item.progress_percentage || 0,
          pilot_name: pilotName,
          pilot_email: item.pilot?.email || "",
          course_title: item.course?.title || "Unknown Course",
          course_region: item.course?.region || "Global",
          course_category: item.course?.category || "General",
          course_provider: item.course?.provider || "Buzz",
        };
      }) as Enrollment[];

      // Apply client-side filters
      if (filter.completionStatus) {
        if (filter.completionStatus === "completed") {
          results = results.filter((r) => r.completed_at !== null);
        } else if (filter.completionStatus === "in_progress") {
          results = results.filter((r) => r.completed_at === null);
        }
      }

      if (filter.courseCategory) {
        results = results.filter((r) => r.course_category === filter.courseCategory);
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        results = results.filter(
          (r) =>
            r.pilot_name?.toLowerCase().includes(query) ||
            r.pilot_email?.toLowerCase().includes(query) ||
            r.course_title?.toLowerCase().includes(query) ||
            r.course_provider?.toLowerCase().includes(query)
        );
      }

      setEnrollments(results);
    } catch (err: any) {
      console.error("Failed to load enrollments", err);
      setError(err.message || "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnrollments();
  }, []);

  const getCompletionStatusBadge = (enrollment: Enrollment) => {
    const isCompleted = enrollment.completed_at !== null;
    const styles = isCompleted
      ? { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "Completed" }
      : { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24", label: "In Progress" };

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 600,
          backgroundColor: styles.bg,
          color: styles.text,
          textTransform: "capitalize",
        }}
      >
        {styles.label}
      </span>
    );
  };

  const getProgressBar = (percentage: number) => {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "80px",
            height: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: "100%",
              backgroundColor: percentage === 100 ? "#22c55e" : "#fbbf24",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span style={{ fontSize: "12px", color: "#9ca3b5" }}>{percentage}%</span>
      </div>
    );
  };

  const clearFilters = () => {
    setFilter({
      completionStatus: null,
      courseCategory: null,
      searchQuery: "",
    });
  };

  const activeFilterCount = [
    filter.completionStatus,
    filter.courseCategory,
    filter.searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Academy Enrollment</h1>
        <button className="primary-btn" onClick={loadEnrollments}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filter Section */}
      <div
        style={{
          backgroundColor: "rgba(107, 140, 174, 0.1)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search by pilot name, email, course, or provider..."
            value={filter.searchQuery}
            onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadEnrollments();
            }}
            style={{
              flex: 1,
              minWidth: "250px",
              padding: "10px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              color: "white",
              fontSize: "14px",
            }}
          />
          <button
            className="primary-btn"
            onClick={loadEnrollments}
            style={{ fontSize: "14px" }}
          >
            Search
          </button>
          {activeFilterCount > 0 && (
            <button
              className="ghost-btn"
              onClick={clearFilters}
              style={{ fontSize: "14px" }}
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Completion Status Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Completion Status
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setFilter({ ...filter, completionStatus: null })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.completionStatus === null
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.completionStatus === null ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                All
              </button>
              {COMPLETION_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter({ ...filter, completionStatus: status })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "none",
                    backgroundColor:
                      filter.completionStatus === status
                        ? "#6b8cae"
                        : "rgba(255, 255, 255, 0.1)",
                    color: filter.completionStatus === status ? "white" : "#9ca3b5",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Course Category Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Course Category
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setFilter({ ...filter, courseCategory: null })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.courseCategory === null
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.courseCategory === null ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                All
              </button>
              {COURSE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilter({ ...filter, courseCategory: category })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "none",
                    backgroundColor:
                      filter.courseCategory === category
                        ? "#6b8cae"
                        : "rgba(255, 255, 255, 0.1)",
                    color: filter.courseCategory === category ? "white" : "#9ca3b5",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading enrollments...</p>
      ) : (
        <>
          <p style={{ marginBottom: "16px", color: "#9ca3b5" }}>
            Showing {enrollments.length} enrollment{enrollments.length !== 1 ? "s" : ""}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pilot</th>
                  <th>Course</th>
                  <th>Category</th>
                  <th>Region</th>
                  <th>Provider</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>
                      <div>{enrollment.pilot_name}</div>
                      <div style={{ fontSize: "12px", color: "#9ca3b5" }}>
                        {enrollment.pilot_email}
                      </div>
                    </td>
                    <td>{enrollment.course_title}</td>
                    <td>{enrollment.course_category}</td>
                    <td>{enrollment.course_region}</td>
                    <td>{enrollment.course_provider}</td>
                    <td>{getProgressBar(enrollment.progress_percentage)}</td>
                    <td>{getCompletionStatusBadge(enrollment)}</td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(enrollment.enrolled_at)}
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(enrollment.completed_at)}
                    </td>
                  </tr>
                ))}
                {enrollments.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center" }}>
                      No enrollments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};