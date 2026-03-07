import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";
import { extractPCNumber } from "../../utility/extractPCNumber";

type RoleType = "flight_reviewer" | "roc_a_examiner";

type LicenseApprovalRequest = {
  id: string;
  pilot_id: string;
  license_id: string | null;
  license_type: string;
  file_url: string;
  status: "pending" | "approved" | "rejected" | "document_deleted";
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

const STATUSES = ["pending", "approved", "rejected", "document_deleted"];

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
  const navigate = useNavigate();
  const pcExtractionIdRef = useRef(0);

  const [allApplications, setAllApplications] = useState<LicenseApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<LicenseApprovalRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // TC Email Modal state
  const [showTCEmailModal, setShowTCEmailModal] = useState(false);
  const [tcEmailTo, setTcEmailTo] = useState("");
  const [tcEmailSubject, setTcEmailSubject] = useState("");
  const [tcEmailBody, setTcEmailBody] = useState("");
  const [approvedApp, setApprovedApp] = useState<LicenseApprovalRequest | null>(null);

  // PC number extraction state
  const [pcExtracting, setPcExtracting] = useState(false);
  const [extractedPC, setExtractedPC] = useState<string | null>(null);
  const [showPcWarningModal, setShowPcWarningModal] = useState(false);

  // Edit Status Modal state
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [editStatusApp, setEditStatusApp] = useState<LicenseApprovalRequest | null>(null);
  const [editStatusValue, setEditStatusValue] = useState<string>("");
  const [editStatusNotes, setEditStatusNotes] = useState("");
  const [editStatusSubmitting, setEditStatusSubmitting] = useState(false);
  const [editStatusError, setEditStatusError] = useState<string | null>(null);

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

    // Start PC number extraction in background
    setExtractedPC(null);
    setPcExtracting(true);
    const extractionId = ++pcExtractionIdRef.current;
    extractPCNumber(app.file_url)
      .then((pc) => {
        if (extractionId !== pcExtractionIdRef.current) return;
        setExtractedPC(pc);
      })
      .finally(() => {
        if (extractionId !== pcExtractionIdRef.current) return;
        setPcExtracting(false);
      });
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedApp(null);
    setReviewerNotes("");
    setModalError(null);
    setExtractedPC(null);
    setPcExtracting(false);
    setShowPcWarningModal(false);
    pcExtractionIdRef.current++; // invalidate any in-flight extraction
  };

  const generateTCEmailDefaults = (app: LicenseApprovalRequest, pcNumber: string | null) => {
    const pcDisplay = pcNumber || "____________";
    if (roleType === "flight_reviewer") {
      return {
        to: "marc.vanderaegen@tc.gc.ca",
        subject: "Flight Reviewer Affiliation",
        body:
          `Dear Mr. Vanderaegen,\n\n` +
          `Please add the following flight reviewer to Buzz.\n\n` +
          `Flight Reviewer: ${app.pilot_name || "_______________"}\n` +
          `PC${pcDisplay}\n\n` +
          `Much appreciated.\n\n` +
          `Buzz\n\n` +
          `cc: April`,
      };
    }
    // ROC-A Examiner
    return {
      to: "marc.vanderaegen@tc.gc.ca",
      subject: `ROC-A Examiner Affiliation`,
      body:
        `Dear Mr. Vanderaegen,\n\n` +
        `Please add the following ROC-A examiner to Buzz.\n\n` +
        `ROC-A Examiner: ${app.pilot_name || "_______________"}\n` +
        `PC${pcDisplay}\n\n` +
        `Much appreciated.\n\n` +
        `Buzz\n\n` +
        `cc: April`,
    };
  };

  const handleOpenEmailClient = () => {
    const body = tcEmailBody.replace(/\r?\n/g, "\r\n");
    const mailto = `mailto:${encodeURIComponent(tcEmailTo.trim())}?subject=${encodeURIComponent(tcEmailSubject.trim())}&body=${encodeURIComponent(body)}&cc=${encodeURIComponent("iam@buzzbuzzin.com")}&from=${encodeURIComponent("hello@buzzacademy.world")}`;
    window.open(mailto, "_blank");
  };

  const closeTCEmailModal = () => {
    setShowTCEmailModal(false);
    setTcEmailTo("");
    setTcEmailSubject("");
    setTcEmailBody("");
    setApprovedApp(null);
    setExtractedPC(null);
    setPcExtracting(false);
    setShowPcWarningModal(false);
  };

  const openEditStatusModal = (app: LicenseApprovalRequest) => {
    setEditStatusApp(app);
    setEditStatusValue(app.status);
    setEditStatusNotes(app.reviewer_notes || "");
    setEditStatusError(null);
    setShowEditStatusModal(true);
  };

  const closeEditStatusModal = () => {
    setShowEditStatusModal(false);
    setEditStatusApp(null);
    setEditStatusValue("");
    setEditStatusNotes("");
    setEditStatusError(null);
    setEditStatusSubmitting(false);
  };

  const handleEditStatusSave = async () => {
    if (!editStatusApp) return;
    if (editStatusValue === editStatusApp.status) {
      closeEditStatusModal();
      return;
    }

    setEditStatusSubmitting(true);
    setEditStatusError(null);

    try {
      const userId = await getAuthUserId();

      const { error: updateError } = await supabaseClient
        .from("license_approval_requests")
        .update({
          status: editStatusValue,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: editStatusNotes.trim() || null,
        })
        .eq("id", editStatusApp.id);

      if (updateError) throw updateError;

      // If changing to approved, also grant the role
      if (editStatusValue === "approved") {
        const { error: roleError } = await supabaseClient
          .from("pilot_special_roles")
          .upsert(
            { pilot_id: editStatusApp.pilot_id, [config.roleField]: true },
            { onConflict: "pilot_id" }
          );

        if (roleError) {
          throw new Error(
            `Status updated, but failed to grant ${config.roleField.replace("_", " ")} role. ` +
            `Please grant it manually via Pilot Accounts. (${roleError.message})`
          );
        }
      }

      // If changing away from approved, revoke the role
      if (editStatusApp.status === "approved" && editStatusValue !== "approved") {
        const { error: revokeError } = await supabaseClient
          .from("pilot_special_roles")
          .upsert(
            { pilot_id: editStatusApp.pilot_id, [config.roleField]: false },
            { onConflict: "pilot_id" }
          );

        if (revokeError) {
          throw new Error(
            `Status updated, but failed to revoke ${config.roleField.replace("_", " ")} role. ` +
            `Please revoke it manually via Pilot Accounts. (${revokeError.message})`
          );
        }
      }

      closeEditStatusModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to update status", err);
      setEditStatusError(err.message || "Failed to update status");
    } finally {
      setEditStatusSubmitting(false);
    }
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

      // Preserve app reference and PC state for TC email before closing review modal
      const appForEmail = { ...selectedApp };
      const capturedPC = extractedPC;
      const emailDefaults = generateTCEmailDefaults(appForEmail, capturedPC);

      closeReviewModal();
      await loadApplications();

      // Restore PC extraction result for TC email inline indicator
      setExtractedPC(capturedPC);

      // Open TC email modal after approval
      setApprovedApp(appForEmail);
      setTcEmailTo(emailDefaults.to);
      setTcEmailSubject(emailDefaults.subject);
      setTcEmailBody(emailDefaults.body);
      setShowTCEmailModal(true);

      // Show warning popup if PC was not found
      if (capturedPC === null) {
        setShowPcWarningModal(true);
      }
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
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24", label: "Pending" },
      approved: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "Approved" },
      rejected: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444", label: "Rejected" },
      document_deleted: { bg: "rgba(107, 114, 128, 0.2)", text: "#9ca3b5", label: "Document Deleted" },
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
        }}
      >
        {style.label}
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
      <div style={{ marginBottom: 16 }}>
        <button
          className="ghost-btn"
          onClick={() => navigate("/admin/pilot-management")}
          style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          &larr; Back to Pilot Management
        </button>
      </div>

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
                }}
              >
                {status === "document_deleted" ? "Document Deleted" : status.charAt(0).toUpperCase() + status.slice(1)}
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
                        {app.status !== "document_deleted" && (
                          <button
                            className="ghost-btn"
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => openDocument(app.file_url)}
                          >
                            View Doc
                          </button>
                        )}
                        {app.status !== "document_deleted" && (
                          <button
                            className="ghost-btn"
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => openEditStatusModal(app)}
                          >
                            Edit Status
                          </button>
                        )}
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

      {/* Edit Status Modal */}
      {showEditStatusModal && editStatusApp && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ margin: 0 }}>Edit Application Status</h3>
              <button className="ghost-btn" onClick={closeEditStatusModal} disabled={editStatusSubmitting}>
                Close
              </button>
            </div>

            {editStatusError && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                {editStatusError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Pilot:</strong> {editStatusApp.pilot_name} ({editStatusApp.pilot_email})
              </div>
              <div>
                <strong>Current Status:</strong> {getStatusBadge(editStatusApp.status)}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">New Status</label>
              <select
                value={editStatusValue}
                onChange={(e) => setEditStatusValue(e.target.value)}
                className="text-input"
                disabled={editStatusSubmitting}
                style={{ padding: "10px 16px" }}
              >
                {STATUSES.filter((s) => s !== "document_deleted").map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Notes</label>
              <textarea
                value={editStatusNotes}
                onChange={(e) => setEditStatusNotes(e.target.value)}
                className="text-input"
                rows={3}
                placeholder="Optional notes..."
                disabled={editStatusSubmitting}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="primary-btn"
                onClick={handleEditStatusSave}
                disabled={editStatusSubmitting}
                style={{ backgroundColor: "#6b8cae" }}
              >
                {editStatusSubmitting ? "Saving..." : "Save"}
              </button>
              <button
                className="ghost-btn"
                onClick={closeEditStatusModal}
                disabled={editStatusSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TC Email Modal */}
      {showTCEmailModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ margin: 0 }}>Notify Transport Canada</h3>
              <button className="ghost-btn" onClick={closeTCEmailModal}>
                Skip
              </button>
            </div>

            <p style={{ color: "#9ca3b5", marginBottom: 16, fontSize: 14 }}>
              Application approved for <strong>{approvedApp?.pilot_name}</strong>. Review the email below, then click
              "Open in Email Client" to send via your default email app.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">To</label>
              <input
                type="email"
                value={tcEmailTo}
                onChange={(e) => setTcEmailTo(e.target.value)}
                className="text-input"
                placeholder="Transport Canada email address..."
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Subject</label>
              <input
                type="text"
                value={tcEmailSubject}
                onChange={(e) => setTcEmailSubject(e.target.value)}
                className="text-input"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="input-label">Body</label>
              <textarea
                value={tcEmailBody}
                onChange={(e) => setTcEmailBody(e.target.value)}
                className="text-input"
                rows={12}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
              {pcExtracting && (
                <p style={{ color: "#fbbf24", fontSize: 12, marginTop: 6 }}>
                  Extracting PC number from document...
                </p>
              )}
              {!pcExtracting && extractedPC === null && (
                <p style={{ color: "#f59e0b", fontSize: 12, marginTop: 6 }}>
                  PC number could not be auto-extracted. Please enter it manually.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="primary-btn"
                onClick={handleOpenEmailClient}
                style={{ backgroundColor: "#6b8cae" }}
              >
                Open in Email Client
              </button>
              <button
                className="ghost-btn"
                onClick={closeTCEmailModal}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PC Number Warning Modal */}
      {showPcWarningModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#9888;</div>
            <h3 style={{ marginBottom: 8 }}>PC Number Not Found</h3>
            <p style={{ color: "#9ca3b5", fontSize: 14, marginBottom: 24 }}>
              Could not auto-extract the PC number from the uploaded document.
              Please enter the PC number manually in the email body before sending.
            </p>
            <button
              className="primary-btn"
              onClick={() => setShowPcWarningModal(false)}
              style={{ backgroundColor: "#f59e0b", color: "#000", minWidth: 160 }}
            >
              Acknowledged
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
