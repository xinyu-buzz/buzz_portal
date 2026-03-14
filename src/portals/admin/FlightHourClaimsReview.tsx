import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";

type FlightHourClaim = {
  id: string;
  pilot_id: string;
  claimed_flights: number;
  claimed_hours: number;
  notes: string | null;
  evidence_files: string[] | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  pilot_name?: string;
  pilot_email?: string;
};

type Filter = {
  status: string | null;
  searchQuery: string;
};

const STATUSES = ["pending", "approved", "rejected"];

export const FlightHourClaimsReview = () => {
  const navigate = useNavigate();

  const [allClaims, setAllClaims] = useState<FlightHourClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<FlightHourClaim | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>({
    status: "pending",
    searchQuery: "",
  });

  const loadClaims = async () => {
    setLoading(true);
    setPageError(null);

    try {
      let query = supabaseClient
        .from("flight_hour_claims")
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

      if (fetchError) throw fetchError;

      const results = (data || []).map((item: any) => {
        const firstName = item.pilot?.first_name || "";
        const lastName = item.pilot?.last_name || "";
        const pilotName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

        return {
          id: item.id,
          pilot_id: item.pilot_id,
          claimed_flights: item.claimed_flights,
          claimed_hours: item.claimed_hours,
          notes: item.notes,
          evidence_files: item.evidence_files,
          status: item.status,
          submitted_at: item.submitted_at,
          reviewed_at: item.reviewed_at,
          reviewed_by: item.reviewed_by,
          reviewer_notes: item.reviewer_notes,
          pilot_name: pilotName,
          pilot_email: item.pilot?.email || "",
        };
      }) as FlightHourClaim[];

      setAllClaims(results);
    } catch (err: any) {
      console.error("Failed to load claims", err);
      setPageError(err.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, [filter.status]);

  const openReviewModal = (claim: FlightHourClaim) => {
    setSelectedClaim(claim);
    setReviewerNotes(claim.reviewer_notes || "");
    setModalError(null);
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedClaim(null);
    setReviewerNotes("");
    setModalError(null);
  };

  const getAuthUserId = async () => {
    const { data: userData } = await supabaseClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Not authenticated. Please log in again.");
    return userId;
  };

  const calculateTier = (flightHours: number): number => {
    if (flightHours < 25) return 0;
    if (flightHours < 75) return 1;
    if (flightHours < 200) return 2;
    if (flightHours < 500) return 3;
    return 4;
  };

  const handleApprove = async () => {
    if (!selectedClaim) return;

    setSubmitting(true);
    setModalError(null);

    try {
      const userId = await getAuthUserId();

      // 1. Update claim status FIRST (with pending guard to prevent double-approval)
      const { data: updateData, error: updateError } = await supabaseClient
        .from("flight_hour_claims")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewerNotes.trim() || null,
        })
        .eq("id", selectedClaim.id)
        .eq("status", "pending")
        .select();

      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error("This claim has already been reviewed. Please refresh and try again.");
      }

      // 2. Update pilot_stats ONLY after claim ownership is confirmed
      const { data: statsData, error: statsError } = await supabaseClient
        .from("pilot_stats")
        .select("*")
        .eq("pilot_id", selectedClaim.pilot_id)
        .maybeSingle();

      if (statsError) throw statsError;

      if (statsData) {
        const newHours = (statsData.total_flight_hours || 0) + selectedClaim.claimed_hours;
        const newBookings = (statsData.completed_bookings || 0) + selectedClaim.claimed_flights;
        const newTier = calculateTier(newHours);

        const { error: updateStatsError } = await supabaseClient
          .from("pilot_stats")
          .update({
            total_flight_hours: newHours,
            completed_bookings: newBookings,
            tier: newTier,
          })
          .eq("pilot_id", selectedClaim.pilot_id);

        if (updateStatsError) throw updateStatsError;
      } else {
        const newTier = calculateTier(selectedClaim.claimed_hours);

        const { error: insertStatsError } = await supabaseClient
          .from("pilot_stats")
          .insert({
            pilot_id: selectedClaim.pilot_id,
            total_flight_hours: selectedClaim.claimed_hours,
            completed_bookings: selectedClaim.claimed_flights,
            tier: newTier,
          });

        if (insertStatsError) throw insertStatsError;
      }

      closeReviewModal();
      await loadClaims();
    } catch (err: any) {
      console.error("Failed to approve claim", err);
      setModalError(err.message || "Failed to approve claim");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim) return;

    if (!reviewerNotes.trim()) {
      setModalError("Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const userId = await getAuthUserId();

      const { data: updateData, error: updateError } = await supabaseClient
        .from("flight_hour_claims")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          reviewer_notes: reviewerNotes.trim(),
        })
        .eq("id", selectedClaim.id)
        .eq("status", "pending")
        .select();

      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error("This claim has already been reviewed. Please refresh and try again.");
      }

      closeReviewModal();
      await loadClaims();
    } catch (err: any) {
      console.error("Failed to reject claim", err);
      setModalError(err.message || "Failed to reject claim");
    } finally {
      setSubmitting(false);
    }
  };

  const getEvidenceUrl = (filePath: string) => {
    const { data } = supabaseClient.storage
      .from("flight-hour-claims")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "rgba(251, 191, 36, 0.2)", text: "#fbbf24", label: "Pending" },
      approved: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "Approved" },
      rejected: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444", label: "Rejected" },
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

  const claims = useMemo(() => {
    let results = allClaims;

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.pilot_name?.toLowerCase().includes(q) ||
          r.pilot_email?.toLowerCase().includes(q)
      );
    }

    return results;
  }, [allClaims, filter.searchQuery]);

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
        <h1>Flight Hour Claims</h1>
        <button className="primary-btn" onClick={loadClaims}>
          Refresh
        </button>
      </div>

      {pageError && (
        <div className="alert error" role="alert" style={{ marginBottom: 16 }}>
          {pageError}
        </div>
      )}

      {/* Filter Section */}
      <div className="claims-filter">
        <div className="claims-filter__row">
          <input
            type="text"
            placeholder="Search by pilot name or email..."
            value={filter.searchQuery}
            onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
            className="claims-filter__search"
          />
          {activeFilterCount > 0 && (
            <button
              className="ghost-btn"
              onClick={clearFilters}
              style={{ fontSize: 14 }}
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div>
          <label className="claims-filter__label">Status</label>
          <div className="claims-filter__status-group">
            <button
              className={`claims-filter__status-btn${filter.status === null ? " claims-filter__status-btn--active" : ""}`}
              onClick={() => setFilter({ ...filter, status: null })}
            >
              All
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                className={`claims-filter__status-btn${filter.status === status ? " claims-filter__status-btn--active" : ""}`}
                onClick={() => setFilter({ ...filter, status })}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading claims...</p>
      ) : claims.length === 0 ? (
        <div className="claims-empty">No claims found.</div>
      ) : (
        <>
          <p className="muted-text" style={{ marginBottom: 16 }} aria-live="polite">
            Showing {claims.length} claim
            {claims.length !== 1 ? "s" : ""}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pilot</th>
                  <th>Flights</th>
                  <th>Hours</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <div>{claim.pilot_name}</div>
                      <div style={{ fontSize: "12px", color: "#9ca3b5" }}>
                        {claim.pilot_email}
                      </div>
                    </td>
                    <td>{claim.claimed_flights}</td>
                    <td>{claim.claimed_hours}h</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {claim.notes || "-"}
                    </td>
                    <td>{getStatusBadge(claim.status)}</td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(claim.submitted_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {claim.status === "pending" && (
                          <button
                            className="primary-btn"
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              backgroundColor: "#6b8cae",
                            }}
                            onClick={() => openReviewModal(claim)}
                          >
                            Review
                          </button>
                        )}
                        {claim.status !== "pending" && (
                          <button
                            className="ghost-btn"
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => openReviewModal(claim)}
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedClaim && (
        <div className="modal-backdrop" onClick={() => { if (!submitting) closeReviewModal(); }} onKeyDown={(e) => { if (e.key === "Escape" && !submitting) closeReviewModal(); }}>
          <div className="modal-card" role="dialog" aria-modal="true" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ margin: 0 }}>Review Claim</h3>
              <button className="ghost-btn" onClick={closeReviewModal} disabled={submitting}>
                Close
              </button>
            </div>

            {modalError && (
              <div className="alert error" role="alert" style={{ marginBottom: 16 }}>
                {modalError}
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong>Pilot:</strong> {selectedClaim.pilot_name} ({selectedClaim.pilot_email})
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Claimed Flights:</strong> {selectedClaim.claimed_flights}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Claimed Hours:</strong> {selectedClaim.claimed_hours}h
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Status:</strong> {getStatusBadge(selectedClaim.status)}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong>Submitted:</strong> {formatDate(selectedClaim.submitted_at)}
              </div>
              {selectedClaim.notes && (
                <div style={{ marginBottom: "12px" }}>
                  <strong>Notes:</strong> {selectedClaim.notes}
                </div>
              )}
            </div>

            {/* Evidence Files */}
            {selectedClaim.evidence_files && selectedClaim.evidence_files.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <strong>Evidence Files:</strong>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                  }}
                >
                  {selectedClaim.evidence_files.map((file, index) => {
                    const url = getEvidenceUrl(file);
                    return (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          width: 120,
                          height: 120,
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        <img
                          src={url}
                          alt={`Evidence ${index + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedClaim.status === "pending" && (
              <>
                <div style={{ marginBottom: "24px" }}>
                  <label className="input-label">
                    Reviewer Notes (required for rejection)
                  </label>
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    className="text-input"
                    rows={4}
                    placeholder="Provide notes or a reason if rejecting this claim..."
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                  <button
                    className="ghost-btn"
                    onClick={closeReviewModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {selectedClaim.status !== "pending" && (
              <div>
                {selectedClaim.reviewer_notes && (
                  <div style={{ marginBottom: "12px" }}>
                    <strong>Reviewer Notes:</strong> {selectedClaim.reviewer_notes}
                  </div>
                )}
                {selectedClaim.reviewed_at && (
                  <div style={{ marginBottom: "12px", fontSize: "12px", color: "#9ca3b5" }}>
                    Reviewed: {formatDate(selectedClaim.reviewed_at)}
                  </div>
                )}
                <button className="ghost-btn" onClick={closeReviewModal}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
