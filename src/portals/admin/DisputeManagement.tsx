import type { FC } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type DisputeReason =
  | "incorrect_charge"
  | "service_not_provided"
  | "quality_issue"
  | "safety_concern"
  | "other";

type DisputeRow = {
  id: string;
  user_id: string;
  type: "dispute";
  title: string;
  description: string;
  status: TicketStatus;
  admin_response: string | null;
  image_urls: string[] | null;
  booking_id: string | null;
  reason: DisputeReason | null;
  created_at: string;
  updated_at: string;
  profiles: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    call_sign: string | null;
  } | null;
  bookings: {
    id: string;
    location_name: string | null;
    payment_amount: number | null;
    scheduled_date: string | null;
    status: string | null;
    specialization: string | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      email: string;
      call_sign: string | null;
    } | null;
    pilot: {
      first_name: string | null;
      last_name: string | null;
      email: string;
      call_sign: string | null;
    } | null;
  } | null;
};

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "#f97316",
  in_progress: "#3b82f6",
  resolved: "#22c55e",
  closed: "#9ca3af",
};

const REASON_LABELS: Record<string, string> = {
  incorrect_charge: "Incorrect Charge",
  service_not_provided: "Service Not Provided",
  quality_issue: "Quality Issue",
  safety_concern: "Safety Concern",
  other: "Other",
};

const REASON_OPTIONS = [
  { value: "all", label: "All Reasons" },
  { value: "incorrect_charge", label: "Incorrect Charge" },
  { value: "service_not_provided", label: "Service Not Provided" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "other", label: "Other" },
];

const formatDate = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCurrency = (amount: number | null) => {
  if (amount == null) return "-";
  return `$${Number(amount).toFixed(2)}`;
};

const getPersonDisplay = (person: {
  first_name: string | null;
  last_name: string | null;
  email: string;
  call_sign: string | null;
} | null) => {
  if (!person) return "Unknown";
  if (person.call_sign) return person.call_sign;
  if (person.first_name || person.last_name)
    return [person.first_name, person.last_name].filter(Boolean).join(" ");
  return person.email;
};

const getUserDisplay = (row: DisputeRow) => {
  const p = row.profiles;
  if (!p) return "Unknown";
  if (p.call_sign) return p.call_sign;
  if (p.first_name || p.last_name)
    return [p.first_name, p.last_name].filter(Boolean).join(" ");
  return p.email;
};

export const DisputeManagement: FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (reasonFilter !== "all") {
      result = result.filter((r) => r.reason === reasonFilter);
    }
    const f = filter.trim().toLowerCase();
    if (f) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(f) ||
          getUserDisplay(r).toLowerCase().includes(f) ||
          (r.bookings?.location_name?.toLowerCase().includes(f) ?? false) ||
          (r.reason && REASON_LABELS[r.reason]?.toLowerCase().includes(f))
      );
    }
    return result;
  }, [rows, filter, statusFilter, reasonFilter]);

  const loadDisputes = async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabaseClient
        .from("ticket_reports")
        .select(
          `*, profiles!ticket_reports_user_id_fkey(email, first_name, last_name, call_sign),
           bookings(id, location_name, payment_amount, scheduled_date, status, specialization,
             customer:customer_id(first_name, last_name, email, call_sign),
             pilot:pilot_id(first_name, last_name, email, call_sign)
           )`
        )
        .eq("type", "dispute")
        .order("created_at", { ascending: false });

      if (gen !== fetchGenRef.current) return;

      if (error) {
        console.error("Failed to load disputes", error);
        setError("Could not load disputes. Please try again.");
      } else {
        setRows((data || []) as DisputeRow[]);
      }
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const updateStatus = async (id: string, status: TicketStatus) => {
    setSavingId(id);
    setError(null);
    try {
      const { error } = await supabaseClient
        .from("ticket_reports")
        .update({ status })
        .eq("id", id);

      if (error) {
        console.error("Failed to update status", error);
        setError("Unable to update status. Please try again.");
      } else {
        setRows((prev) =>
          prev.map((row) => (row.id === id ? { ...row, status } : row))
        );
      }
    } finally {
      setSavingId(null);
    }
  };

  const saveAdminResponse = async (id: string) => {
    setSavingId(id);
    setError(null);
    try {
      const { error } = await supabaseClient
        .from("ticket_reports")
        .update({ admin_response: adminResponse })
        .eq("id", id);

      if (error) {
        console.error("Failed to save response", error);
        setError("Unable to save response. Please try again.");
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, admin_response: adminResponse } : row
          )
        );
      }
    } finally {
      setSavingId(null);
    }
  };

  const toggleExpand = (row: DisputeRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
    } else {
      setExpandedId(row.id);
      setAdminResponse(row.admin_response || "");
    }
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <h1>Dispute Reports</h1>
          <p className="muted-text">
            Review and manage booking disputes filed by users.
          </p>
        </div>
        <button className="ghost-btn" onClick={loadDisputes} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="admin-list-actions">
        <input
          className="text-input"
          placeholder="Search by reason, user, or location"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="text-input"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TicketStatus | "all")
          }
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="text-input"
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
        >
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="muted-text" aria-live="polite">
          Showing {filteredRows.length} of {rows.length}
        </span>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading disputes...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Reason</th>
                <th>Filed By</th>
                <th>Booking Location</th>
                <th>Amount</th>
                <th>Date Filed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: STATUS_COLORS[row.status],
                            display: "inline-block",
                          }}
                        />
                        {STATUS_OPTIONS.find((o) => o.value === row.status)
                          ?.label ?? row.status}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontWeight: 500,
                          backgroundColor:
                            row.reason === "safety_concern"
                              ? "rgba(239, 68, 68, 0.15)"
                              : row.reason === "incorrect_charge"
                              ? "rgba(251, 191, 36, 0.15)"
                              : "rgba(107, 140, 174, 0.15)",
                          color:
                            row.reason === "safety_concern"
                              ? "#ef4444"
                              : row.reason === "incorrect_charge"
                              ? "#fbbf24"
                              : "#6b8cae",
                        }}
                      >
                        {row.reason
                          ? REASON_LABELS[row.reason] || row.reason
                          : row.title}
                      </span>
                    </td>
                    <td>{getUserDisplay(row)}</td>
                    <td
                      style={{
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.bookings?.location_name || ""}
                    >
                      {row.bookings?.location_name || "-"}
                    </td>
                    <td>{formatCurrency(row.bookings?.payment_amount ?? null)}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <select
                        className="text-input"
                        value={row.status}
                        onChange={(e) =>
                          updateStatus(row.id, e.target.value as TicketStatus)
                        }
                        disabled={savingId === row.id}
                        style={{ minWidth: 120 }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ghost-btn"
                        onClick={() => toggleExpand(row)}
                      >
                        {expandedId === row.id ? "Close" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={7}>
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--bg-muted, rgba(255,255,255,0.05))",
                            borderRadius: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                          }}
                        >
                          {/* Booking Details */}
                          {row.bookings && (
                            <div
                              style={{
                                padding: "12px 16px",
                                background: "rgba(107, 140, 174, 0.08)",
                                borderRadius: 8,
                                border: "1px solid rgba(107, 140, 174, 0.15)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 8,
                                }}
                              >
                                <strong>Booking Details</strong>
                                <button
                                  className="ghost-btn"
                                  style={{ fontSize: 12, padding: "4px 10px" }}
                                  onClick={() =>
                                    navigate(
                                      `/admin/bookings/${row.booking_id}`
                                    )
                                  }
                                >
                                  View Booking &rarr;
                                </button>
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                  gap: "8px 24px",
                                  fontSize: 14,
                                }}
                              >
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Location:{" "}
                                  </span>
                                  {row.bookings.location_name || "-"}
                                </div>
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Scheduled:{" "}
                                  </span>
                                  {formatDate(row.bookings.scheduled_date)}
                                </div>
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Amount:{" "}
                                  </span>
                                  {formatCurrency(row.bookings.payment_amount)}
                                </div>
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Booking Status:{" "}
                                  </span>
                                  {row.bookings.status || "-"}
                                </div>
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Customer:{" "}
                                  </span>
                                  {getPersonDisplay(row.bookings.customer)}
                                </div>
                                <div>
                                  <span style={{ color: "var(--muted)" }}>
                                    Pilot:{" "}
                                  </span>
                                  {getPersonDisplay(row.bookings.pilot)}
                                </div>
                                {row.bookings.specialization && (
                                  <div>
                                    <span style={{ color: "var(--muted)" }}>
                                      Specialization:{" "}
                                    </span>
                                    {row.bookings.specialization}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Dispute Reason */}
                          <div>
                            <strong>Dispute Reason</strong>
                            <p style={{ margin: "4px 0" }}>
                              {row.reason
                                ? REASON_LABELS[row.reason] || row.reason
                                : row.title}
                            </p>
                          </div>

                          {/* Description */}
                          <div>
                            <strong>Description</strong>
                            <p
                              style={{
                                whiteSpace: "pre-wrap",
                                margin: "4px 0",
                              }}
                            >
                              {row.description}
                            </p>
                          </div>

                          {/* Screenshots */}
                          {row.image_urls && row.image_urls.length > 0 && (
                            <div>
                              <strong>
                                Evidence ({row.image_urls.length})
                              </strong>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  marginTop: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                {row.image_urls.map((url, i) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt={`Evidence ${i + 1}`}
                                    style={{
                                      width: 200,
                                      height: 200,
                                      objectFit: "cover",
                                      borderRadius: 8,
                                      cursor: "pointer",
                                    }}
                                    onClick={() =>
                                      window.open(
                                        url,
                                        "_blank",
                                        "noopener,noreferrer"
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Admin Response */}
                          <div>
                            <strong>Admin Response</strong>
                            <textarea
                              className="text-input"
                              rows={3}
                              style={{ width: "100%", marginTop: 4 }}
                              value={
                                expandedId === row.id
                                  ? adminResponse
                                  : row.admin_response || ""
                              }
                              onChange={(e) => setAdminResponse(e.target.value)}
                            />
                            <button
                              className="primary-btn"
                              style={{ marginTop: 8 }}
                              disabled={savingId === row.id}
                              onClick={() => saveAdminResponse(row.id)}
                            >
                              {savingId === row.id
                                ? "Submitting..."
                                : "Submit Response"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    No disputes found.
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
