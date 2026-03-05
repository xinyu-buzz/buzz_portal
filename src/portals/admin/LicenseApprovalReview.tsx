import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type RoleType = "flight_reviewer" | "roc_a_examiner";

type LicenseApprovalRequest = {
  id: string;
  pilot_id: string;
  license_id: string;
  license_type: string;
  file_url: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
  pilot_name?: string;
  pilot_email?: string;
};

type Filter = {
  status: string | null;
  searchQuery: string;
};

const STATUSES = ["pending", "approved", "rejected"];

const ROLE_CONFIG: Record<RoleType, { title: string; licensePattern: string; roleField: string }> = {
  flight_reviewer: {
    title: "Flight Reviewer Applications",
    licensePattern: "%Flight Reviewer%",
    roleField: "flight_reviewer",
  },
  roc_a_examiner: {
    title: "ROC-A Examiner Applications",
    licensePattern: "%ROC-A Examiner%",
    roleField: "roc_a_examiner",
  },
};

export const LicenseApprovalReview = ({ roleType }: { roleType: RoleType }) => {
  const config = ROLE_CONFIG[roleType];

  const [allApplications, setAllApplications] = useState<LicenseApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<LicenseApprovalRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    status: "pending",
    searchQuery: "",
  });

  const loadApplications = async () => {
    setLoading(true);
    setPageError(null);

    try {
      let query = supabaseClient
        .from("license_approval_requests")
        .select(`
          *,
          pilot:pilot_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .ilike("license_type", config.licensePattern)
        .order("submitted_at", { ascending: false });

      if (filter.status) {
        query = query.eq("status", filter.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const results = (data || []).map((item: any) => {
        const firstName = item.pilot?.first_name || "";
        const lastName = item.pilot?.last_name || "";
        const pilotName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

        return {
          id: item.id,
          pilot_id: item.pilot_id,
          license_id: item.license_id,
          license_type: item.license_type,
          file_url: item.file_url,
          status: item.status,
          submitted_at: item.submitted_at,
          reviewed_at: item.reviewed_at,
          reviewed_by: item.reviewed_by,
          reviewer_notes: item.reviewer_notes,
          created_at: item.created_at,
          updated_at: item.updated_at,
          pilot_name: pilotName,
          pilot_email: item.pilot?.email || "",
        };
      }) as LicenseApprovalRequest[];

      setAllApplications(results);
    } catch (err: any) {
      console.error("Failed to load applications", err);
      setPageError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [filter.status, roleType]);

  const openReviewModal = (app: LicenseApprovalRequest) => {
    setSelectedApp(app);
    setReviewerNotes(app.reviewer_notes || "");
    setModalError(null);
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedApp(null);
    setReviewerNotes("");
    setModalError(null);
  };

  const openDocument = (url: string, inModal = false) => {
    const setErr = inModal ? setModalError : setPageError;
    if (!url) {
      setErr("No document URL available");
      return;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setErr("Invalid document URL");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Invalid document URL format");
    }
  };

  const getAuthUserId = async () => {
    const { data: userData } = await supabaseClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated. Please log in again.");
    return userId;
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    setSubmitting(true);
    setModalError(null);

    try {
      const userId = await getAuthUserId();

      // 1. Mark application as approved first (safer order — role grant is idempotent)
      const { data: updateData, error: updateError } = await supabaseClient
        .from("license_approval_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewerNotes.trim() || null,
        })
        .eq("id", selectedApp.id)
        .eq("status", "pending")
        .select();

      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error("This application has already been reviewed. Please refresh and try again.");
      }

      // 2. Grant the special role (idempotent upsert, safe to retry)
      const { error: roleError } = await supabaseClient
        .from("pilot_special_roles")
        .upsert(
          { pilot_id: selectedApp.pilot_id, [config.roleField]: true },
          { onConflict: "pilot_id" }
        );

      if (roleError) {
        // Application is already approved but role grant failed — give actionable message
        throw new Error(
          `Application approved, but failed to grant ${config.roleField.replace("_", " ")} role. ` +
          `Please grant it manually via Pilot Accounts. (${roleError.message})`
        );
      }

      closeReviewModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to approve application", err);
      setModalError(err.message || "Failed to approve application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;

    if (!reviewerNotes.trim()) {
      setModalError("Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const userId = await getAuthUserId();

      const { data: updateData, error: updateError } = await supabaseClient
        .from("license_approval_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewerNotes,
        })
        .eq("id", selectedApp.id)
        .eq("status", "pending")
        .select();

      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error("This application has already been reviewed. Please refresh and try again.");
      }

      closeReviewModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to reject application", err);
      setModalError(err.message || "Failed to reject application");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      pending: { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24" },
      approved: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
      rejected: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
    };

    const style = styles[status] || styles.pending;

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
        {status}
      </span>
    );
  };

  const applications = useMemo(() => {
    let results = allApplications;

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.pilot_name?.toLowerCase().includes(q) ||
          r.pilot_email?.toLowerCase().includes(q)
      );
    }

    return results;
  }, [allApplications, filter.searchQuery]);

  const clearFilters = () => {
    setFilter({ status: null, searchQuery: "" });
  };

  const activeFilterCount = [
    filter.status,
    filter.searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>{config.title}</h1>
        <button className="primary-btn" onClick={loadApplications}>
          Refresh
        </button>
      </div>

      {pageError && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {pageError}
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
            placeholder="Search by pilot name or email..."
            value={filter.searchQuery}
            onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadApplications();
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
            onClick={loadApplications}
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

        {/* Status Filter */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Status
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              onClick={() => setFilter({ ...filter, status: null })}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                backgroundColor:
                  filter.status === null
                    ? "#6b8cae"
                    : "rgba(255, 255, 255, 0.1)",
                color: filter.status === null ? "white" : "#9ca3b5",
                cursor: "pointer",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
            >
              All
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setFilter({ ...filter, status })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.status === status
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.status === status ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                  textTransform: "capitalize",
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading applications...</p>
      ) : (
        <>
          <p style={{ marginBottom: "16px", color: "#9ca3b5" }}>
            Showing {applications.length} application
            {applications.length !== 1 ? "s" : ""}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pilot</th>
                  <th>License Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div>{app.pilot_name}</div>
                      <div style={{ fontSize: "12px", color: "#9ca3b5" }}>
                        {app.pilot_email}
                      </div>
                    </td>
                    <td>{app.license_type}</td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(app.submitted_at)}
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(app.reviewed_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {app.status === "pending" && (
                          <button
                            className="primary-btn"
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              backgroundColor: "#6b8cae",
                            }}
                            onClick={() => openReviewModal(app)}
                          >
                            Review
                          </button>
                        )}
                        <button
                          className="ghost-btn"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={() => openDocument(app.file_url)}
                        >
                          View Doc
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      No applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedApp && (
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
              <h3 style={{ margin: 0 }}>Review Application</h3>
              <button className="ghost-btn" onClick={closeReviewModal} disabled={submitting}>
                Close
              </button>
            </div>

            {modalError && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                {modalError}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong>Pilot:</strong> {selectedApp.pilot_name} (
                {selectedApp.pilot_email})
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>License Type:</strong> {selectedApp.license_type}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Current Status:</strong>{" "}
                {getStatusBadge(selectedApp.status)}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Submitted:</strong>{" "}
                {formatDate(selectedApp.submitted_at)}
              </div>
              {selectedApp.reviewer_notes && (
                <div style={{ marginBottom: "12px" }}>
                  <strong>Previous Notes:</strong>{" "}
                  {selectedApp.reviewer_notes}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <button
                className="ghost-btn"
                onClick={() => openDocument(selectedApp.file_url, true)}
                style={{ fontSize: "14px" }}
              >
                View Document
              </button>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label className="input-label">
                Reviewer Notes (required for rejection)
              </label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                className="text-input"
                rows={4}
                placeholder="Provide notes or a reason if rejecting this application..."
              />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {selectedApp.status === "pending" && (
                <>
                  <button
                    className="primary-btn"
                    onClick={handleApprove}
                    disabled={submitting}
                    style={{ backgroundColor: "#22c55e" }}
                  >
                    {submitting ? "Processing..." : "Approve"}
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleReject}
                    disabled={submitting}
                    style={{ backgroundColor: "#ef4444" }}
                  >
                    {submitting ? "Processing..." : "Reject"}
                  </button>
                </>
              )}
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
