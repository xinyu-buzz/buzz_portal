import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabaseClient } from "../../utility";

type Pilot = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  certificate_type: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  enrichment_status: string | null;
  outreach_status: string | null;
  import_batch_id: string | null;
  email: string | null;
  email_confidence: "high" | "medium" | "low" | null;
  phone: string | null;
  website: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  business_name: string | null;
  specializations: string[] | null;
  estimated_experience_level: string | null;
  enrichment_summary: string | null;
  created_at: string;
};

type PilotMessage = {
  id: string;
  channel: string;
  subject: string | null;
  review_status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
};

export const OutreachPilotDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [messages, setMessages] = useState<PilotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showChannelSelect, setShowChannelSelect] = useState(false);

  const loadPilot = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabaseClient
        .from("outreach_faa_pilots")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchErr) throw fetchErr;
      setPilot(data);

      const { data: msgs, error: msgsErr } = await supabaseClient
        .from("outreach_messages")
        .select("*")
        .eq("faa_pilot_id", id)
        .order("created_at", { ascending: false });

      if (msgsErr) throw msgsErr;
      setMessages(msgs || []);
    } catch (err: any) {
      console.error("Failed to load pilot", err);
      setError(err?.message || "Failed to load pilot data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPilot();
  }, [loadPilot]);

  const handleReEnrich = async () => {
    if (!id) return;
    setActionLoading("enrich");
    setAlertMsg(null);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "outreach-enrich-batch",
        { body: { pilot_ids: [id] } }
      );
      if (error) throw error;
      setAlertMsg({
        type: "success",
        text: data?.message || "Re-enrichment started.",
      });
      loadPilot();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err?.message || "Re-enrichment failed." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateMessage = async (channel: string) => {
    if (!id) return;
    setShowChannelSelect(false);
    setActionLoading("generate");
    setAlertMsg(null);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "outreach-generate-messages",
        { body: { pilot_ids: [id], channel } }
      );
      if (error) throw error;
      setAlertMsg({
        type: "success",
        text: data?.message || "Message generated successfully.",
      });
      loadPilot();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err?.message || "Failed to generate message." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDoNotContact = async () => {
    if (!id) return;
    setActionLoading("dnc");
    setAlertMsg(null);
    try {
      const { error } = await supabaseClient
        .from("outreach_faa_pilots")
        .update({ outreach_status: "do_not_contact" })
        .eq("id", id);
      if (error) throw error;
      setAlertMsg({ type: "success", text: "Marked as Do Not Contact." });
      loadPilot();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err?.message || "Failed to update status." });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status: string | null, colorMap?: Record<string, string>) => {
    const defaultColors: Record<string, string> = {
      pending: "#c9a227",
      completed: "#4a7c59",
      failed: "#b04040",
      email_sent: "#2a5a9a",
      email_opened: "#6b8cae",
      replied: "#4a7c59",
      converted: "#2e8b57",
      do_not_contact: "#b04040",
      approved: "#4a7c59",
      rejected: "#b04040",
      none: "#555",
    };
    const colors = colorMap || defaultColors;
    const s = status || "none";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "capitalize",
          background: colors[s] || "#555",
          color: "#fff",
        }}
      >
        {s.replace(/_/g, " ")}
      </span>
    );
  };

  const confidenceBadge = (confidence: Pilot["email_confidence"]) => {
    if (!confidence) return null;

    const colorMap: Record<NonNullable<Pilot["email_confidence"]>, string> = {
      high: "#4a7c59",
      medium: "#c9a227",
      low: "#b04040",
    };

    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: "600",
          marginLeft: "8px",
          background: colorMap[confidence],
          color: "#fff",
          textTransform: "capitalize",
        }}
      >
        {confidence}
      </span>
    );
  };

  const linkOrDash = (url: string | null, label: string) => {
    if (!url) return <span className="muted-text">—</span>;
    return (
      <a
        href={url.startsWith("http") ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)", textDecoration: "underline" }}
      >
        {label}
      </a>
    );
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            Loading pilot data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !pilot) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <Link
            to="/admin/outreach"
            style={{ color: "var(--accent)", textDecoration: "none", marginBottom: "16px", display: "inline-block" }}
          >
            &larr; Back to Dashboard
          </Link>
          <div className="alert error">{error || "Pilot not found."}</div>
        </div>
      </div>
    );
  }

  const fullName =
    `${pilot.first_name || ""} ${pilot.last_name || ""}`.trim() || "Unknown Pilot";

  return (
    <div className="page-shell">
      <Link
        to="/admin/outreach"
        style={{
          color: "var(--accent)",
          textDecoration: "none",
          marginBottom: "16px",
          display: "inline-block",
          fontSize: "14px",
        }}
      >
        &larr; Back to Dashboard
      </Link>

      {alertMsg && (
        <div className={`alert ${alertMsg.type}`} style={{ marginBottom: "16px" }}>
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

      {/* Pilot Info Card */}
      <div className="page-card">
        <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>{fullName}</h1>
        <p className="muted-text" style={{ marginBottom: "16px" }}>
          {[pilot.city, pilot.state, pilot.zip].filter(Boolean).join(", ") || "No location"}
        </p>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Certificate Type</span>
            <span>{pilot.certificate_type || "—"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Certificate Number</span>
            <span>{pilot.certificate_number || "—"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Certificate Date</span>
            <span>{pilot.certificate_date || "—"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Enrichment Status</span>
            <span>{statusBadge(pilot.enrichment_status)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Outreach Status</span>
            <span>{statusBadge(pilot.outreach_status)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Import Batch</span>
            <span className="muted-text" style={{ fontSize: "12px" }}>
              {pilot.import_batch_id || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Enriched Data Card */}
      {pilot.enrichment_status === "completed" && (
        <div className="page-card" style={{ marginTop: "16px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Enriched Data</h2>

          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Email</span>
              <span>
                {pilot.email || "—"}
                {pilot.email ? confidenceBadge(pilot.email_confidence) : null}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Phone</span>
              <span>{pilot.phone || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Website</span>
              <span>{linkOrDash(pilot.website, pilot.website || "")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">LinkedIn</span>
              <span>{linkOrDash(pilot.linkedin_url, "View Profile")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Instagram</span>
              <span>{linkOrDash(pilot.instagram_url, "View Profile")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">YouTube</span>
              <span>{linkOrDash(pilot.youtube_url, "View Channel")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Facebook</span>
              <span>{linkOrDash(pilot.facebook_url, "View Profile")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Business Name</span>
              <span>{pilot.business_name || "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Experience Level</span>
              <span style={{ textTransform: "capitalize" }}>
                {pilot.estimated_experience_level?.replace(/_/g, " ") || "—"}
              </span>
            </div>
          </div>

          {pilot.specializations && pilot.specializations.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <span className="detail-label" style={{ display: "block", marginBottom: "6px" }}>
                Specializations
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {pilot.specializations.map((spec) => (
                  <span
                    key={spec}
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: "rgba(255, 165, 0, 0.15)",
                      color: "var(--accent)",
                    }}
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pilot.enrichment_summary && (
            <div style={{ marginTop: "16px" }}>
              <span className="detail-label" style={{ display: "block", marginBottom: "6px" }}>
                Enrichment Summary
              </span>
              <div
                style={{
                  background: "rgba(0,0,0,0.15)",
                  padding: "14px",
                  borderRadius: "8px",
                  lineHeight: "1.6",
                  fontSize: "14px",
                  color: "var(--muted)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {pilot.enrichment_summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="page-card" style={{ marginTop: "16px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Actions</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", position: "relative" }}>
          <button
            className="primary-btn"
            onClick={handleReEnrich}
            disabled={actionLoading === "enrich"}
          >
            {actionLoading === "enrich" ? "Processing..." : "Re-enrich"}
          </button>

          <div style={{ position: "relative" }}>
            <button
              className="primary-btn"
              onClick={() => setShowChannelSelect(!showChannelSelect)}
              disabled={actionLoading === "generate"}
            >
              {actionLoading === "generate" ? "Generating..." : "Generate Message"}
            </button>
            {showChannelSelect && (
              <div className="channel-dropdown">
                {["email", "instagram_dm", "linkedin_dm", "facebook_dm"].map((ch) => (
                  <button
                    key={ch}
                    className="channel-option"
                    onClick={() => handleGenerateMessage(ch)}
                  >
                    {ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="ghost-btn"
            style={{ color: "#e05050" }}
            onClick={handleDoNotContact}
            disabled={actionLoading === "dnc" || pilot.outreach_status === "do_not_contact"}
          >
            {actionLoading === "dnc"
              ? "Updating..."
              : pilot.outreach_status === "do_not_contact"
              ? "Marked DNC"
              : "Mark Do Not Contact"}
          </button>
        </div>
      </div>

      {/* Outreach History */}
      <div className="page-card" style={{ marginTop: "16px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Outreach History</h2>
        {messages.length === 0 ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "24px 0" }}>
            No messages yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent At</th>
                <th>Opened</th>
                <th>Clicked</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "capitalize",
                        background:
                          m.channel === "email"
                            ? "#2a5a9a"
                            : m.channel === "instagram_dm"
                            ? "#a13d7e"
                            : "#4a6a7a",
                        color: "#fff",
                      }}
                    >
                      {m.channel.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>{m.subject || "—"}</td>
                  <td>{statusBadge(m.review_status)}</td>
                  <td>{formatDate(m.sent_at)}</td>
                  <td>{m.opened_at ? formatDate(m.opened_at) : "—"}</td>
                  <td>{m.clicked_at ? formatDate(m.clicked_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .channel-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          z-index: 10;
          min-width: 180px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .channel-option {
          display: block;
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: var(--text);
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          transition: background 120ms ease;
        }

        .channel-option:hover {
          background: rgba(255, 165, 0, 0.1);
        }
      `}</style>
    </div>
  );
};
