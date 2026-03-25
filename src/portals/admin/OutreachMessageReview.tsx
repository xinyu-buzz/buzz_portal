import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type PilotInfo = {
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  enrichment_summary: string | null;
};

type OutreachMessage = {
  id: string;
  faa_pilot_id: string;
  channel: string;
  subject: string | null;
  body_text: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  outreach_faa_pilots: PilotInfo | null;
};

type EditForm = {
  subject: string;
  body_text: string;
};

export const OutreachMessageReview: FC = () => {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{ id: string; form: EditForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingApproved, setSendingApproved] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    let query = supabaseClient
      .from("outreach_messages")
      .select(
        "*, outreach_faa_pilots(first_name, last_name, city, state, email, enrichment_summary)"
      )
      .order("created_at", { ascending: false });

    if (channelFilter !== "all") {
      query = query.eq("channel", channelFilter);
    }
    if (statusFilter !== "all") {
      query = query.eq("review_status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load messages", error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [channelFilter, statusFilter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filteredMessages = messages.filter((m) => {
    if (!search.trim()) return true;
    const pilot = m.outreach_faa_pilots;
    const name = `${pilot?.first_name || ""} ${pilot?.last_name || ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pendingCount = messages.filter((m) => m.review_status === "pending").length;
  const approvedCount = messages.filter((m) => m.review_status === "approved").length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredMessages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  const updateStatus = async (id: string, reviewStatus: string) => {
    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error } = await supabaseClient
        .from("outreach_messages")
        .update({
          review_status: reviewStatus,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      loadMessages();
    } catch (err: any) {
      console.error("Failed to update status", err);
      setAlertMsg({ type: "error", text: err?.message || "Failed to update status." });
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error } = await supabaseClient
        .from("outreach_messages")
        .update({
          review_status: "approved",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", Array.from(selected));

      if (error) throw error;
      setSelected(new Set());
      setAlertMsg({ type: "success", text: `${selected.size} messages approved.` });
      loadMessages();
    } catch (err: any) {
      console.error("Bulk approve failed", err);
      setAlertMsg({ type: "error", text: err?.message || "Bulk approve failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendAllApproved = async () => {
    const approvedIds = messages
      .filter((m) => m.review_status === "approved")
      .map((m) => m.id);

    if (approvedIds.length === 0) {
      setAlertMsg({ type: "error", text: "No approved messages to send." });
      return;
    }

    setSendingApproved(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "outreach-send-email",
        { body: { message_ids: approvedIds } }
      );
      if (error) throw error;
      setAlertMsg({
        type: "success",
        text: data?.message || `Sent ${approvedIds.length} messages.`,
      });
      loadMessages();
    } catch (err: any) {
      console.error("Send failed", err);
      setAlertMsg({ type: "error", text: err?.message || "Failed to send messages." });
    } finally {
      setSendingApproved(false);
    }
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const { error } = await supabaseClient
        .from("outreach_messages")
        .update({
          subject: editModal.form.subject.trim() || null,
          body_text: editModal.form.body_text.trim(),
        })
        .eq("id", editModal.id);

      if (error) throw error;
      setEditModal(null);
      loadMessages();
    } catch (err: any) {
      console.error("Edit save failed", err);
      setAlertMsg({ type: "error", text: err?.message || "Failed to save edit." });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#c9a227",
      approved: "#4a7c59",
      rejected: "#b04040",
      sent: "#2a5a9a",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "capitalize",
          background: colors[status] || "#555",
          color: "#fff",
        }}
      >
        {status}
      </span>
    );
  };

  const channelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      email: "#2a5a9a",
      instagram_dm: "#a13d7e",
      linkedin_dm: "#4a6a7a",
      facebook_dm: "#3b5998",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "capitalize",
          background: colors[channel] || "#555",
          color: "#fff",
        }}
      >
        {channel.replace(/_/g, " ")}
      </span>
    );
  };

  const pilotName = (pilot: PilotInfo | null) => {
    if (!pilot) return "Unknown";
    return `${pilot.first_name || ""} ${pilot.last_name || ""}`.trim() || "Unknown";
  };

  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="page-header">
          <div>
            <h1>Message Review</h1>
            <p className="muted-text">
              {pendingCount} pending · {approvedCount} approved · {messages.length} total
            </p>
          </div>
        </div>

        {alertMsg && (
          <div
            className={`alert ${alertMsg.type}`}
            style={{ marginTop: "12px" }}
          >
            {alertMsg.text}
            <button
              className="ghost-btn"
              style={{ marginLeft: "12px", fontSize: "12px" }}
              onClick={() => setAlertMsg(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-bar" style={{ marginTop: "20px" }}>
          <div className="filter-group">
            <label className="input-label" htmlFor="filter-channel">
              Channel
            </label>
            <select
              id="filter-channel"
              className="text-input"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="email">Email</option>
              <option value="instagram_dm">Instagram DM</option>
              <option value="linkedin_dm">LinkedIn DM</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="input-label" htmlFor="filter-status">
              Status
            </label>
            <select
              id="filter-status"
              className="text-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="input-label" htmlFor="filter-search">
              Search Pilot
            </label>
            <input
              id="filter-search"
              type="text"
              className="text-input"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="bulk-bar" style={{ marginTop: "16px" }}>
            <span className="muted-text">{selected.size} selected</span>
            <button
              className="primary-btn"
              onClick={handleBulkApprove}
              disabled={saving}
            >
              {saving ? "Approving..." : "Approve Selected"}
            </button>
            <button
              className="ghost-btn"
              onClick={handleSendAllApproved}
              disabled={sendingApproved}
            >
              {sendingApproved ? "Sending..." : "Send All Approved"}
            </button>
          </div>
        )}

        {/* Messages table */}
        {loading ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            Loading messages...
          </p>
        ) : filteredMessages.length === 0 ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            No messages found.
          </p>
        ) : (
          <table className="data-table" style={{ marginTop: "20px" }}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={selected.size === filteredMessages.length && filteredMessages.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Pilot Name</th>
                <th>City / State</th>
                <th>Channel</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((m) => {
                const isExpanded = expandedId === m.id;
                const pilot = m.outreach_faa_pilots;
                return (
                  <tr key={m.id} style={{ cursor: "pointer" }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                      />
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {pilotName(pilot)}
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {pilot ? `${pilot.city || "—"}, ${pilot.state || "—"}` : "—"}
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {channelBadge(m.channel)}
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {m.subject
                        ? m.subject.length > 40
                          ? m.subject.slice(0, 40) + "..."
                          : m.subject
                        : "—"}
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {statusBadge(m.review_status)}
                    </td>
                    <td onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                      {formatDate(m.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Expanded row detail */}
        {expandedId && (() => {
          const m = messages.find((msg) => msg.id === expandedId);
          if (!m) return null;
          const pilot = m.outreach_faa_pilots;
          return (
            <div className="expanded-detail" style={{ marginTop: "16px" }}>
              <div className="page-card" style={{ background: "rgba(255,255,255,0.03)" }}>
                <h3 style={{ marginBottom: "12px" }}>Message Detail</h3>
                {m.subject && (
                  <p style={{ marginBottom: "8px" }}>
                    <strong>Subject:</strong> {m.subject}
                  </p>
                )}
                <div
                  className="message-body"
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    padding: "16px",
                    borderRadius: "8px",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    lineHeight: "1.6",
                    marginBottom: "16px",
                  }}
                >
                  {m.body_text}
                </div>

                {pilot?.enrichment_summary && (
                  <div style={{ marginBottom: "16px" }}>
                    <p className="muted-text" style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Enrichment Summary
                    </p>
                    <p style={{ fontSize: "14px", color: "var(--muted)" }}>
                      {pilot.enrichment_summary}
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="primary-btn"
                    onClick={() => updateStatus(m.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="ghost-btn"
                    style={{ color: "#e05050" }}
                    onClick={() => updateStatus(m.id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() =>
                      setEditModal({
                        id: m.id,
                        form: {
                          subject: m.subject || "",
                          body_text: m.body_text,
                        },
                      })
                    }
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div
          className="modal-backdrop"
          onClick={() => setEditModal(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditModal(null);
          }}
        >
          <div
            className="modal-card edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Edit Message</h2>
              <button
                className="modal-close"
                onClick={() => setEditModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="edit-form">
              <div className="form-group">
                <label className="input-label" htmlFor="edit-subject">
                  Subject
                </label>
                <input
                  id="edit-subject"
                  type="text"
                  className="text-input"
                  value={editModal.form.subject}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? { ...prev, form: { ...prev.form, subject: e.target.value } }
                        : null
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="edit-body">
                  Body
                </label>
                <textarea
                  id="edit-body"
                  className="text-input"
                  value={editModal.form.body_text}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            form: { ...prev.form, body_text: e.target.value },
                          }
                        : null
                    )
                  }
                  rows={12}
                  style={{ resize: "vertical", minHeight: "200px", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button className="ghost-btn" onClick={() => setEditModal(null)}>
                  Cancel
                </button>
                <button
                  className="primary-btn"
                  onClick={handleEditSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .filter-bar {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 160px;
        }

        .filter-group select {
          appearance: auto;
        }

        .bulk-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 165, 0, 0.08);
          border: 1px solid var(--accent);
          border-radius: 8px;
        }

        .edit-modal {
          max-width: 680px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .modal-close {
          background: transparent;
          border: none;
          font-size: 32px;
          color: var(--muted);
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 120ms ease, color 120ms ease;
        }

        .modal-close:hover {
          background: var(--border);
          color: var(--text);
        }

        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      `}</style>
    </div>
  );
};
