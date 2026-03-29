import type { FC } from "react";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getPreferredOutreachLabel, isPilotEmailSendable, supabaseClient } from "../../utility";

type FaaPilot = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  certificate_type: string | null;
  enrichment_status: string | null;
  outreach_status: string | null;
  email: string | null;
  email_confidence: string | null;
  email_source_type: string | null;
  deliverability_status: string | null;
  preferred_outreach_channel: string | null;
  has_public_contact_path: boolean;
  estimated_experience_level: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 100;

export const OutreachPilotTable: FC = () => {
  const [pilots, setPilots] = useState<FaaPilot[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [enrichmentFilter, setEnrichmentFilter] = useState("");
  const [outreachFilter, setOutreachFilter] = useState("");

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabaseClient
        .from("outreach_faa_pilots")
        .select(
          "id, first_name, last_name, city, state, certificate_type, enrichment_status, outreach_status, email, email_confidence, email_source_type, deliverability_status, preferred_outreach_channel, has_public_contact_path, estimated_experience_level, created_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
        );
      }
      if (stateFilter) {
        query = query.eq("state", stateFilter);
      }
      if (enrichmentFilter) {
        query = query.eq("enrichment_status", enrichmentFilter);
      }
      if (outreachFilter) {
        query = query.eq("outreach_status", outreachFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setPilots(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("Failed to load pilot table", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, stateFilter, enrichmentFilter, outreachFilter]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStateFilter("");
    setEnrichmentFilter("");
    setOutreachFilter("");
    setPage(0);
  };

  const hasFilters = search || stateFilter || enrichmentFilter || outreachFilter;

  const statusBadge = (status: string | null) => {
    if (!status) return <span className="muted-text">—</span>;
    const colors: Record<string, string> = {
      completed: "#22c55e",
      pending: "#eab308",
      queued: "#3b82f6",
      in_progress: "#8b5cf6",
      failed: "#ef4444",
      skipped: "#6b7280",
      not_started: "#6b7280",
      ready: "#3b82f6",
      email_sent: "#8b5cf6",
      email_opened: "#f59e0b",
      replied: "#22c55e",
      converted: "#10b981",
      opted_out: "#ef4444",
      bounced: "#ef4444",
      do_not_contact: "#dc2626",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 600,
          background: `${colors[status] ?? "#6b7280"}20`,
          color: colors[status] ?? "#6b7280",
          textTransform: "capitalize",
        }}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const contactBadge = (pilot: FaaPilot) => {
    const label = getPreferredOutreachLabel(pilot);
    const canEmail = isPilotEmailSendable(pilot);

    const color = canEmail
      ? "#22c55e"
      : pilot.has_public_contact_path
      ? "#3b82f6"
      : "#6b7280";

    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 600,
          background: `${color}20`,
          color,
          textTransform: "capitalize",
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-card" style={{ maxWidth: 1400 }}>
        <div className="page-header">
          <div>
            <h1>FAA Pilot Records</h1>
            <p className="muted-text">
              {totalCount.toLocaleString()} records
              {hasFilters ? " (filtered)" : ""}
            </p>
          </div>
          <Link className="ghost-btn" to="/admin/outreach">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "16px",
          }}
        >
          <input
            type="text"
            placeholder="Search name, email, city..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="form-input"
            style={{ flex: "1 1 220px", minWidth: 180 }}
          />
          <button className="primary-btn" onClick={handleSearch}>
            Search
          </button>

          <select
            className="form-input"
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(0);
            }}
            style={{ width: 120 }}
          >
            <option value="">All States</option>
            {["CA", "TX", "FL", "NY", "IL", "PA", "OH", "GA", "NC", "MI", "AZ", "WA", "CO", "VA", "NJ"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>

          <select
            className="form-input"
            value={enrichmentFilter}
            onChange={(e) => {
              setEnrichmentFilter(e.target.value);
              setPage(0);
            }}
            style={{ width: 150 }}
          >
            <option value="">All Enrichment</option>
            {["pending", "queued", "in_progress", "completed", "failed", "skipped"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={outreachFilter}
            onChange={(e) => {
              setOutreachFilter(e.target.value);
              setPage(0);
            }}
            style={{ width: 150 }}
          >
            <option value="">All Outreach</option>
            {[
              "not_started",
              "ready",
              "email_sent",
              "email_opened",
              "replied",
              "converted",
              "opted_out",
              "bounced",
              "do_not_contact",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button className="ghost-btn" onClick={handleClearFilters}>
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ marginTop: "16px", overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Certificate</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Experience</th>
                <th>Enrichment</th>
                <th>Outreach</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                    Loading...
                  </td>
                </tr>
              ) : pilots.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)" }}>
                    No records found
                  </td>
                </tr>
              ) : (
                pilots.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>
                      {[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td>
                      {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {p.certificate_type?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td>
                      {contactBadge(p)}
                    </td>
                    <td>
                      {p.email ? (
                        <span title={p.email}>
                          {p.email.length > 25 ? p.email.slice(0, 25) + "…" : p.email}
                          {p.email_confidence && (
                            <span
                              style={{
                                marginLeft: 4,
                                fontSize: "10px",
                                color:
                                  p.email_confidence === "high"
                                    ? "#22c55e"
                                    : p.email_confidence === "medium"
                                    ? "#eab308"
                                    : "#ef4444",
                              }}
                            >
                              ({p.email_confidence})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="muted-text">
                          {p.has_public_contact_path ? "fallback only" : "—"}
                        </span>
                      )}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {p.estimated_experience_level?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td>{statusBadge(p.enrichment_status)}</td>
                    <td>{statusBadge(p.outreach_status)}</td>
                    <td>
                      <Link
                        className="ghost-btn"
                        to={`/admin/outreach/pilots/${p.id}`}
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
            }}
          >
            <span className="muted-text" style={{ fontSize: "13px" }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
              {totalCount.toLocaleString()}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="ghost-btn"
                disabled={page === 0}
                onClick={() => setPage(0)}
                style={{ padding: "4px 10px", fontSize: "13px" }}
              >
                First
              </button>
              <button
                className="ghost-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "4px 10px", fontSize: "13px" }}
              >
                &larr; Prev
              </button>
              <span style={{ padding: "4px 8px", fontSize: "13px" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="ghost-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "4px 10px", fontSize: "13px" }}
              >
                Next &rarr;
              </button>
              <button
                className="ghost-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                style={{ padding: "4px 10px", fontSize: "13px" }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
