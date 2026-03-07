import type { FC } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type TicketRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  status: TicketStatus;
  admin_response: string | null;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
  profiles: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    call_sign: string | null;
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

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getUserDisplay = (row: TicketRow) => {
  const p = row.profiles;
  if (!p) return "Unknown";
  if (p.call_sign) return p.call_sign;
  if (p.first_name || p.last_name)
    return [p.first_name, p.last_name].filter(Boolean).join(" ");
  return p.email;
};

export const TicketManagement: FC = () => {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    const f = filter.trim().toLowerCase();
    if (f) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(f) ||
          getUserDisplay(r).toLowerCase().includes(f)
      );
    }
    return result;
  }, [rows, filter, statusFilter]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabaseClient
      .from("ticket_reports")
      .select(
        "*, profiles!ticket_reports_user_id_fkey(email, first_name, last_name, call_sign)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load tickets", error);
      setError("Could not load tickets. Please try again.");
    } else {
      setRows((data || []) as TicketRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const updateStatus = async (id: string, status: TicketStatus) => {
    setSavingId(id);
    setError(null);
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
    setSavingId(null);
  };

  const saveAdminResponse = async (id: string) => {
    setSavingId(id);
    setError(null);
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
    setSavingId(null);
  };

  const toggleExpand = (row: TicketRow) => {
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
          <h1>Bug Reports</h1>
          <p className="muted-text">
            View and manage user-submitted bug reports.
          </p>
        </div>
        <button className="ghost-btn" onClick={loadTickets} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="admin-list-actions">
        <input
          className="text-input"
          placeholder="Search by title or user"
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
        <span className="muted-text">
          Showing {filteredRows.length} of {rows.length}
        </span>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p>Loading tickets...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Title</th>
              <th>Submitted By</th>
              <th>Date</th>
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
                  <td
                    style={{
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={row.title}
                  >
                    {row.title}
                  </td>
                  <td>{getUserDisplay(row)}</td>
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
                    <td colSpan={5}>
                      <div
                        style={{
                          padding: "12px 16px",
                          background: "var(--bg-muted, rgba(255,255,255,0.05))",
                          borderRadius: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div>
                          <strong>Description</strong>
                          <p style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>
                            {row.description}
                          </p>
                        </div>
                        {row.image_urls && row.image_urls.length > 0 && (
                          <div>
                            <strong>Screenshots ({row.image_urls.length})</strong>
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
                                  alt={`Screenshot ${i + 1}`}
                                  style={{
                                    width: 200,
                                    height: 200,
                                    objectFit: "cover",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                  }}
                                  onClick={() => window.open(url, "_blank")}
                                />
                              ))}
                            </div>
                          </div>
                        )}
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
                            {savingId === row.id ? "Saving..." : "Save Response"}
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
                <td colSpan={5} style={{ textAlign: "center" }}>
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};
