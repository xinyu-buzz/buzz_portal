import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type TestResult = {
  id: string;
  pilot_id: string;
  test_id: string;
  course_id: string;
  score: number;
  passed: boolean;
  answers: any;
  attempt_number: number;
  completed_at: string;
  result_file_urls: string[];
  upload_status: "not_submitted" | "pending" | "approved" | "rejected";
  uploaded_at: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  pilot_name?: string;
  pilot_email?: string;
  test_name?: string;
  test_type?: "multiple_choice" | "practical" | "written" | "oral";
  course_title?: string;
};

type Filter = {
  uploadStatus: string | null;
  testType: string | null;
  searchQuery: string;
};

const UPLOAD_STATUSES = ["not_submitted", "pending", "approved", "rejected"];
const TEST_TYPES = ["multiple_choice", "practical", "written", "oral"];

export const AcademyManager = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    uploadStatus: "pending",
    testType: null,
    searchQuery: "",
  });

  const loadTestResults = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch test results with joined data
      let query = supabaseClient
        .from("test_results")
        .select(`
          *,
          pilot:pilot_id (
            id,
            first_name,
            last_name,
            email
          ),
          test:test_id (
            id,
            test_name,
            test_type
          ),
          course:course_id (
            id,
            title
          )
        `)
        .order("uploaded_at", { ascending: false, nullsFirst: false })
        .order("completed_at", { ascending: false });

      // Apply filters
      if (filter.uploadStatus) {
        query = query.eq("upload_status", filter.uploadStatus);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform data and apply additional filters
      let results = (data || []).map((item: any) => {
        const firstName = item.pilot?.first_name || "";
        const lastName = item.pilot?.last_name || "";
        const pilotName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
        
        return {
          id: item.id,
          pilot_id: item.pilot_id,
          test_id: item.test_id,
          course_id: item.course_id,
          score: item.score,
          passed: item.passed,
          answers: item.answers,
          attempt_number: item.attempt_number,
          completed_at: item.completed_at,
          result_file_urls: item.result_file_urls || [],
          upload_status: item.upload_status,
          uploaded_at: item.uploaded_at,
          reviewed_at: item.reviewed_at,
          reviewer_notes: item.reviewer_notes,
          reviewed_by: item.reviewed_by,
          pilot_name: pilotName,
          pilot_email: item.pilot?.email || "",
          test_name: item.test?.test_name || "Unknown Test",
          test_type: item.test?.test_type || "multiple_choice",
          course_title: item.course?.title || "Unknown Course",
        };
      }) as TestResult[];

      // Apply client-side filters
      if (filter.testType) {
        results = results.filter((r) => r.test_type === filter.testType);
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        results = results.filter(
          (r) =>
            r.pilot_name?.toLowerCase().includes(query) ||
            r.pilot_email?.toLowerCase().includes(query) ||
            r.test_name?.toLowerCase().includes(query) ||
            r.course_title?.toLowerCase().includes(query)
        );
      }

      setTestResults(results);
    } catch (err: any) {
      console.error("Failed to load test results", err);
      setError(err.message || "Failed to load test results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestResults();
  }, [filter.uploadStatus]);

  const openReviewModal = (result: TestResult) => {
    setSelectedResult(result);
    setReviewNotes(result.reviewer_notes || "");
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedResult(null);
    setReviewNotes("");
    setError(null);
  };

  const handleApprove = async () => {
    if (!selectedResult) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;

      const { error: updateError } = await supabaseClient
        .from("test_results")
        .update({
          upload_status: "approved",
          passed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewNotes || null,
        })
        .eq("id", selectedResult.id);

      if (updateError) {
        throw updateError;
      }

      closeReviewModal();
      await loadTestResults();
    } catch (err: any) {
      console.error("Failed to approve test result", err);
      setError(err.message || "Failed to approve test result");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedResult) return;

    if (!reviewNotes.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;

      const { error: updateError } = await supabaseClient
        .from("test_results")
        .update({
          upload_status: "rejected",
          passed: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewNotes,
        })
        .eq("id", selectedResult.id);

      if (updateError) {
        throw updateError;
      }

      closeReviewModal();
      await loadTestResults();
    } catch (err: any) {
      console.error("Failed to reject test result", err);
      setError(err.message || "Failed to reject test result");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverrideResult = async (result: TestResult, newPassed: boolean) => {
    if (!confirm(`Are you sure you want to override this result to ${newPassed ? "PASSED" : "FAILED"}?`)) {
      return;
    }

    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;

      const { error: updateError } = await supabaseClient
        .from("test_results")
        .update({
          passed: newPassed,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: `Manual override by admin`,
        })
        .eq("id", result.id);

      if (updateError) {
        throw updateError;
      }

      await loadTestResults();
    } catch (err: any) {
      console.error("Failed to override result", err);
      setError(err.message || "Failed to override result");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      not_submitted: { bg: "rgba(156, 163, 175, 0.2)", text: "#9ca3b5" },
      pending: { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24" },
      approved: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
      rejected: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
    };

    const style = styles[status] || styles.not_submitted;

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 600,
          backgroundColor: style.bg,
          color: style.text,
          textTransform: "capitalize",
        }}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  const clearFilters = () => {
    setFilter({
      uploadStatus: null,
      testType: null,
      searchQuery: "",
    });
  };

  const activeFilterCount = [
    filter.uploadStatus,
    filter.testType,
    filter.searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const downloadFile = async (url: string) => {
    try {
      // Extract storage path from public URL
      // URL format: https://.../storage/v1/object/public/course-test-results/path/to/file.jpg
      const urlParts = url.split('/course-test-results/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid file URL format');
      }
      const storagePath = urlParts[1];

      // Create signed URL for private bucket
      const { data, error: signedError } = await supabaseClient.storage
        .from('course-test-results')
        .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

      if (signedError) {
        throw signedError;
      }

      const signedUrl = data?.signedUrl;
      if (!signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      window.open(signedUrl, "_blank");
    } catch (err) {
      console.error("Failed to open file", err);
      setError(err instanceof Error ? err.message : "Failed to open file");
    }
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Academy Manager - Test Results</h1>
        <button className="primary-btn" onClick={loadTestResults}>
          🔄 Refresh
        </button>
      </div>

      {error && !showReviewModal && (
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
            placeholder="Search by pilot name, email, test, or course..."
            value={filter.searchQuery}
            onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadTestResults();
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
            onClick={loadTestResults}
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
          {/* Upload Status Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Upload Status
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setFilter({ ...filter, uploadStatus: null })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.uploadStatus === null
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.uploadStatus === null ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                All
              </button>
              {UPLOAD_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter({ ...filter, uploadStatus: status })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "none",
                    backgroundColor:
                      filter.uploadStatus === status
                        ? "#6b8cae"
                        : "rgba(255, 255, 255, 0.1)",
                    color: filter.uploadStatus === status ? "white" : "#9ca3b5",
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

          {/* Test Type Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Test Type
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setFilter({ ...filter, testType: null })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.testType === null
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.testType === null ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                All
              </button>
              {TEST_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFilter({ ...filter, testType: type });
                    // Don't auto-reload here, only when Apply or Enter is pressed
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "none",
                    backgroundColor:
                      filter.testType === type
                        ? "#6b8cae"
                        : "rgba(255, 255, 255, 0.1)",
                    color: filter.testType === type ? "white" : "#9ca3b5",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading test results...</p>
      ) : (
        <>
          <p style={{ marginBottom: "16px", color: "#9ca3b5" }}>
            Showing {testResults.length} test result{testResults.length !== 1 ? "s" : ""}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pilot</th>
                  <th>Test</th>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Passed</th>
                  <th>Uploaded</th>
                  <th>Reviewed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((result) => (
                  <tr key={result.id}>
                    <td>
                      <div>{result.pilot_name}</div>
                      <div style={{ fontSize: "12px", color: "#9ca3b5" }}>
                        {result.pilot_email}
                      </div>
                    </td>
                    <td>{result.test_name}</td>
                    <td>{result.course_title}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {result.test_type?.replace("_", " ")}
                    </td>
                    <td>{result.score}%</td>
                    <td>{getStatusBadge(result.upload_status)}</td>
                    <td>
                      <span
                        style={{
                          color: result.passed ? "#22c55e" : "#ef4444",
                          fontWeight: 600,
                        }}
                      >
                        {result.passed ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(result.uploaded_at)}
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(result.reviewed_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {result.upload_status === "pending" &&
                          result.test_type !== "multiple_choice" && (
                            <button
                              className="primary-btn"
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                backgroundColor: "#6b8cae",
                              }}
                              onClick={() => openReviewModal(result)}
                            >
                              Review
                            </button>
                          )}
                        {result.test_type === "multiple_choice" && (
                          <>
                            <button
                              className="ghost-btn"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => handleOverrideResult(result, true)}
                              disabled={result.passed}
                            >
                              Pass
                            </button>
                            <button
                              className="ghost-btn"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => handleOverrideResult(result, false)}
                              disabled={!result.passed}
                            >
                              Fail
                            </button>
                          </>
                        )}
                        {result.result_file_urls.length > 0 && (
                          <button
                            className="ghost-btn"
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => downloadFile(result.result_file_urls[0])}
                          >
                            📄 View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {testResults.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center" }}>
                      No test results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedResult && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ margin: 0 }}>Review Test Result</h3>
              <button className="ghost-btn" onClick={closeReviewModal}>
                Close
              </button>
            </div>

            {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ marginBottom: "24px" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong>Pilot:</strong> {selectedResult.pilot_name} ({selectedResult.pilot_email})
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Test:</strong> {selectedResult.test_name}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Course:</strong> {selectedResult.course_title}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Type:</strong>{" "}
                <span style={{ textTransform: "capitalize" }}>
                  {selectedResult.test_type?.replace("_", " ")}
                </span>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Score:</strong> {selectedResult.score}%
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Completed:</strong> {formatDate(selectedResult.completed_at)}
              </div>
            </div>

            {selectedResult.result_file_urls.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", marginBottom: "12px" }}>
                  Submitted Files:
                </strong>
                {selectedResult.result_file_urls.map((url, index) => (
                  <div key={index} style={{ marginBottom: "8px" }}>
                    <button
                      className="ghost-btn"
                      onClick={() => downloadFile(url)}
                      style={{ fontSize: "14px" }}
                    >
                      📄 File {index + 1}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <label className="input-label">Reviewer Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="text-input"
                rows={4}
                placeholder="Add notes about this review (required for rejection)..."
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="primary-btn"
                onClick={handleApprove}
                disabled={submitting}
                style={{ backgroundColor: "#22c55e" }}
              >
                {submitting ? "Processing..." : "✓ Approve & Pass"}
              </button>
              <button
                className="primary-btn"
                onClick={handleReject}
                disabled={submitting}
                style={{ backgroundColor: "#ef4444" }}
              >
                {submitting ? "Processing..." : "✗ Reject & Fail"}
              </button>
              <button
                className="ghost-btn"
                onClick={closeReviewModal}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
