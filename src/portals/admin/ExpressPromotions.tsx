import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type ExpressPromotionApp = {
  id: string;
  pilot_id: string;
  promotion_type: "lieutenant" | "commander";
  document_type: "aviation_degree" | "ppl" | "ground_school_test";
  document_urls: string[];
  status: "pending" | "in_review" | "verified" | "rejected";
  target_tier: 2 | 3;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  pilot_name?: string;
  pilot_email?: string;
};

type Filter = {
  status: string | null;
  promotionType: string | null;
  searchQuery: string;
};

const STATUSES = ["pending", "in_review", "verified", "rejected"];
const PROMOTION_TYPES = ["lieutenant", "commander"];

export const ExpressPromotions = () => {
  const [allApplications, setAllApplications] = useState<ExpressPromotionApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<ExpressPromotionApp | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    status: "pending",
    promotionType: null,
    searchQuery: "",
  });

  const loadApplications = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabaseClient
        .from("express_promotion_applications")
        .select(`
          *,
          pilot:pilot_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
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
          promotion_type: item.promotion_type,
          document_type: item.document_type,
          document_urls: item.document_urls || [],
          status: item.status,
          target_tier: item.target_tier,
          submitted_at: item.submitted_at,
          reviewed_at: item.reviewed_at,
          reviewed_by: item.reviewed_by,
          rejection_reason: item.rejection_reason,
          created_at: item.created_at,
          updated_at: item.updated_at,
          pilot_name: pilotName,
          pilot_email: item.pilot?.email || "",
        };
      }) as ExpressPromotionApp[];

      setAllApplications(results);
    } catch (err: any) {
      console.error("Failed to load applications", err);
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [filter.status]);

  const openReviewModal = (app: ExpressPromotionApp) => {
    setSelectedApp(app);
    setRejectionReason(app.rejection_reason || "");
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedApp(null);
    setRejectionReason("");
    setError(null);
  };

  const getAuthUserId = async () => {
    const { data: userData } = await supabaseClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated. Please log in again.");
    return userId;
  };

  const handleMarkInReview = async () => {
    if (!selectedApp) return;

    setSubmitting(true);
    setError(null);

    try {
      const userId = await getAuthUserId();

      const { error: updateError } = await supabaseClient
        .from("express_promotion_applications")
        .update({
          status: "in_review",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
        })
        .eq("id", selectedApp.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      closeReviewModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to mark as in review", err);
      setError(err.message || "Failed to update application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedApp) return;

    setSubmitting(true);
    setError(null);

    try {
      const userId = await getAuthUserId();

      // 1. Promote pilot tier first (before marking verified, so partial failure is safe)
      const { data: stats, error: statsError } = await supabaseClient
        .from("pilot_stats")
        .select("tier")
        .eq("pilot_id", selectedApp.pilot_id)
        .maybeSingle();

      if (statsError) throw statsError;

      if (!stats) {
        // No pilot_stats row — create one with the target tier
        const { data: inserted, error: insertError } = await supabaseClient
          .from("pilot_stats")
          .insert({
            pilot_id: selectedApp.pilot_id,
            tier: selectedApp.target_tier,
          })
          .select("tier")
          .maybeSingle();

        if (insertError) throw insertError;
        if (!inserted) throw new Error("Failed to create pilot stats record.");
      } else if (stats.tier < selectedApp.target_tier) {
        const { data: updated, error: tierError } = await supabaseClient
          .from("pilot_stats")
          .update({ tier: selectedApp.target_tier })
          .eq("pilot_id", selectedApp.pilot_id)
          .select("tier")
          .maybeSingle();

        if (tierError) throw tierError;
        if (!updated) throw new Error("Failed to update pilot tier — no row was modified.");
      }

      // 2. Mark application as verified (tier is already promoted at this point)
      const { error: updateError } = await supabaseClient
        .from("express_promotion_applications")
        .update({
          status: "verified",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          rejection_reason: null,
        })
        .eq("id", selectedApp.id)
        .in("status", ["pending", "in_review"]);

      if (updateError) throw updateError;

      closeReviewModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to verify application", err);
      setError(err.message || "Failed to verify application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;

    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const userId = await getAuthUserId();

      const { error: updateError } = await supabaseClient
        .from("express_promotion_applications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedApp.id)
        .in("status", ["pending", "in_review"]);

      if (updateError) throw updateError;

      closeReviewModal();
      await loadApplications();
    } catch (err: any) {
      console.error("Failed to reject application", err);
      setError(err.message || "Failed to reject application");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadFile = async (url: string) => {
    try {
      const urlParts = url.split("/express-promotion-docs/");
      if (urlParts.length !== 2) {
        throw new Error("Invalid file URL format");
      }
      const storagePath = urlParts[1];

      const { data, error: signedError } = await supabaseClient.storage
        .from("express-promotion-docs")
        .createSignedUrl(storagePath, 60 * 60);

      if (signedError) throw signedError;

      const signedUrl = data?.signedUrl;
      if (!signedUrl) {
        throw new Error("Failed to generate signed URL");
      }

      window.open(signedUrl, "_blank");
    } catch (err) {
      console.error("Failed to open file", err);
      setError(err instanceof Error ? err.message : "Failed to open file");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      pending: { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24" },
      in_review: { bg: "rgba(96, 165, 250, 0.2)", text: "#60a5fa" },
      verified: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
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
        {status.replace("_", " ")}
      </span>
    );
  };

  const applications = useMemo(() => {
    let results = allApplications;

    if (filter.promotionType) {
      results = results.filter((r) => r.promotion_type === filter.promotionType);
    }

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.pilot_name?.toLowerCase().includes(q) ||
          r.pilot_email?.toLowerCase().includes(q)
      );
    }

    return results;
  }, [allApplications, filter.promotionType, filter.searchQuery]);

  const clearFilters = () => {
    setFilter({
      status: null,
      promotionType: null,
      searchQuery: "",
    });
  };

  const activeFilterCount = [
    filter.status,
    filter.promotionType,
    filter.searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const formatLabel = (str: string) =>
    str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Express Promotions</h1>
        <button className="primary-btn" onClick={loadApplications}>
          Refresh
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

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Promotion Type Filter */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Promotion Type
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                onClick={() => setFilter({ ...filter, promotionType: null })}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    filter.promotionType === null
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: filter.promotionType === null ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                All
              </button>
              {PROMOTION_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter({ ...filter, promotionType: type })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: "none",
                    backgroundColor:
                      filter.promotionType === type
                        ? "#6b8cae"
                        : "rgba(255, 255, 255, 0.1)",
                    color: filter.promotionType === type ? "white" : "#9ca3b5",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
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
                  <th>Promotion Type</th>
                  <th>Document Type</th>
                  <th>Target Tier</th>
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
                    <td style={{ textTransform: "capitalize" }}>
                      {app.promotion_type}
                    </td>
                    <td>{formatLabel(app.document_type)}</td>
                    <td>Tier {app.target_tier}</td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(app.submitted_at)}
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(app.reviewed_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(app.status === "pending" ||
                          app.status === "in_review") && (
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
                        {app.document_urls.length > 0 && (
                          <button
                            className="ghost-btn"
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => downloadFile(app.document_urls[0])}
                          >
                            View Doc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>
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
              <h3 style={{ margin: 0 }}>Review Express Promotion</h3>
              <button className="ghost-btn" onClick={closeReviewModal}>
                Close
              </button>
            </div>

            {error && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong>Pilot:</strong> {selectedApp.pilot_name} (
                {selectedApp.pilot_email})
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Promotion Type:</strong>{" "}
                <span style={{ textTransform: "capitalize" }}>
                  {selectedApp.promotion_type}
                </span>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Document Type:</strong>{" "}
                {formatLabel(selectedApp.document_type)}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Target Tier:</strong> Tier {selectedApp.target_tier}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Current Status:</strong>{" "}
                {getStatusBadge(selectedApp.status)}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Submitted:</strong>{" "}
                {formatDate(selectedApp.submitted_at)}
              </div>
              {selectedApp.rejection_reason && (
                <div style={{ marginBottom: "12px" }}>
                  <strong>Previous Rejection Reason:</strong>{" "}
                  {selectedApp.rejection_reason}
                </div>
              )}
            </div>

            {selectedApp.document_urls.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <strong style={{ display: "block", marginBottom: "12px" }}>
                  Submitted Documents:
                </strong>
                {selectedApp.document_urls.map((url, index) => (
                  <div key={index} style={{ marginBottom: "8px" }}>
                    <button
                      className="ghost-btn"
                      onClick={() => downloadFile(url)}
                      style={{ fontSize: "14px" }}
                    >
                      Document {index + 1}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <label className="input-label">
                Rejection Reason (required for rejection)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="text-input"
                rows={4}
                placeholder="Provide a reason if rejecting this application..."
              />
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {selectedApp.status === "pending" && (
                <button
                  className="primary-btn"
                  onClick={handleMarkInReview}
                  disabled={submitting}
                  style={{ backgroundColor: "#60a5fa" }}
                >
                  {submitting ? "Processing..." : "Mark In Review"}
                </button>
              )}
              {(selectedApp.status === "pending" ||
                selectedApp.status === "in_review") && (
                <>
                  <button
                    className="primary-btn"
                    onClick={handleVerify}
                    disabled={submitting}
                    style={{ backgroundColor: "#22c55e" }}
                  >
                    {submitting ? "Processing..." : "Verify & Promote"}
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
