import type { FC } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabaseClient } from "../../utility";

type PipelineRow = {
  status: string;
  count: number;
};

type StateRow = {
  state: string;
  count: number;
};

type AnalyticsEvent = {
  id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export const OutreachDashboard: FC = () => {
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const [enrichedCount, setEnrichedCount] = useState<number | null>(null);
  const [emailsFound, setEmailsFound] = useState<number | null>(null);
  const [messagesSent, setMessagesSent] = useState<number | null>(null);
  const [enrichmentPipeline, setEnrichmentPipeline] = useState<PipelineRow[]>([]);
  const [outreachPipeline, setOutreachPipeline] = useState<PipelineRow[]>([]);
  const [topStates, setTopStates] = useState<StateRow[]>([]);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [totalRes, enrichedRes, emailRes, sentRes] = await Promise.all([
          supabaseClient
            .from("outreach_faa_pilots")
            .select("*", { count: "exact", head: true }),
          supabaseClient
            .from("outreach_faa_pilots")
            .select("*", { count: "exact", head: true })
            .eq("enrichment_status", "completed"),
          supabaseClient
            .from("outreach_faa_pilots")
            .select("*", { count: "exact", head: true })
            .not("email", "is", null),
          supabaseClient
            .from("outreach_faa_pilots")
            .select("*", { count: "exact", head: true })
            .in("outreach_status", ["email_sent", "email_opened", "replied", "converted"]),
        ]);

        setTotalRecords(totalRes.count ?? 0);
        setEnrichedCount(enrichedRes.count ?? 0);
        setEmailsFound(emailRes.count ?? 0);
        setMessagesSent(sentRes.count ?? 0);

        // Enrichment pipeline breakdown
        const { data: allPilots } = await supabaseClient
          .from("outreach_faa_pilots")
          .select("enrichment_status, outreach_status");

        if (allPilots) {
          const enrichMap: Record<string, number> = {};
          const outreachMap: Record<string, number> = {};
          for (const p of allPilots) {
            const es = p.enrichment_status || "pending";
            enrichMap[es] = (enrichMap[es] || 0) + 1;
            const os = p.outreach_status || "none";
            outreachMap[os] = (outreachMap[os] || 0) + 1;
          }
          setEnrichmentPipeline(
            Object.entries(enrichMap).map(([status, count]) => ({ status, count }))
          );
          setOutreachPipeline(
            Object.entries(outreachMap).map(([status, count]) => ({ status, count }))
          );

          // Top states
          const stateMap: Record<string, number> = {};
          for (const p of allPilots as Array<{ enrichment_status: string; outreach_status: string; state?: string }>) {
            // We need state data - refetch with state column
          }
        }

        // Top states (separate query with state)
        const { data: stateData } = await supabaseClient
          .from("outreach_faa_pilots")
          .select("state");

        if (stateData) {
          const stateMap: Record<string, number> = {};
          for (const row of stateData) {
            const s = row.state || "Unknown";
            stateMap[s] = (stateMap[s] || 0) + 1;
          }
          const sorted = Object.entries(stateMap)
            .map(([state, count]) => ({ state, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
          setTopStates(sorted);
        }

        // Recent events
        const { data: events } = await supabaseClient
          .from("outreach_analytics_events")
          .select("id, event_type, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(20);

        if (events) {
          setRecentEvents(events);
        }
      } catch (err) {
        console.error("Failed to load outreach dashboard", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleStartEnrichment = async () => {
    setEnrichLoading(true);
    setEnrichResult(null);
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "outreach-enrich-batch"
      );
      if (error) throw error;
      setEnrichResult(
        data?.message || `Enrichment started. ${data?.processed ?? 0} records queued.`
      );
    } catch (err: any) {
      console.error("Enrichment failed", err);
      setEnrichResult(`Error: ${err?.message || "Failed to start enrichment."}`);
    } finally {
      setEnrichLoading(false);
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

  const statCard = (value: number | null, label: string) => (
    <div className="stat-card">
      <div className="stat-card__value">
        {value !== null ? value.toLocaleString() : "—"}
      </div>
      <div className="stat-card__label">{label}</div>
    </div>
  );

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            Loading outreach data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="page-header">
          <div>
            <h1>Pilot Outreach</h1>
            <p className="muted-text">
              {totalRecords !== null
                ? `${totalRecords.toLocaleString()} total FAA records`
                : "Loading..."}
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div
          className="card-grid"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: "24px" }}
        >
          {statCard(totalRecords, "Total FAA Records")}
          {statCard(enrichedCount, "Enriched")}
          {statCard(emailsFound, "Emails Found")}
          {statCard(messagesSent, "Messages Sent")}
        </div>

        {/* Quick actions */}
        <div className="outreach-actions" style={{ marginTop: "24px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Quick Actions</h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link className="primary-btn" to="/admin/outreach/import">
              Import FAA Data
            </Link>
            <button
              className="primary-btn"
              onClick={handleStartEnrichment}
              disabled={enrichLoading}
            >
              {enrichLoading ? "Processing..." : "Start Enrichment"}
            </button>
            <Link className="ghost-btn" to="/admin/outreach/messages">
              Review Messages
            </Link>
          </div>
          {enrichResult && (
            <div
              className={`alert ${enrichResult.startsWith("Error") ? "error" : "success"}`}
              style={{ marginTop: "12px" }}
            >
              {enrichResult}
            </div>
          )}
        </div>

        {/* Pipeline breakdown */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Pipeline Breakdown</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <h3 style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "8px" }}>
                Enrichment Status
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichmentPipeline.map((row) => (
                    <tr key={row.status}>
                      <td style={{ textTransform: "capitalize" }}>
                        {row.status.replace(/_/g, " ")}
                      </td>
                      <td>{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {enrichmentPipeline.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ color: "var(--muted)", textAlign: "center" }}>
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "8px" }}>
                Outreach Status
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {outreachPipeline.map((row) => (
                    <tr key={row.status}>
                      <td style={{ textTransform: "capitalize" }}>
                        {row.status.replace(/_/g, " ")}
                      </td>
                      <td>{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                  {outreachPipeline.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ color: "var(--muted)", textAlign: "center" }}>
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top States */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Top States</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>State</th>
                <th>Pilot Count</th>
              </tr>
            </thead>
            <tbody>
              {topStates.map((row, idx) => (
                <tr key={row.state}>
                  <td>{idx + 1}</td>
                  <td>{row.state}</td>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              ))}
              {topStates.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: "var(--muted)", textAlign: "center" }}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Activity */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Recent Activity</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((evt) => (
                <tr key={evt.id}>
                  <td style={{ textTransform: "capitalize" }}>
                    {evt.event_type.replace(/_/g, " ")}
                  </td>
                  <td>{formatDate(evt.created_at)}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ color: "var(--muted)", textAlign: "center" }}>
                    No recent events
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .stat-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .stat-card__value {
          font-size: 32px;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 4px;
        }
        .stat-card__label {
          font-size: 14px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
};
