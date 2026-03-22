import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type PageView = {
  id: string;
  page_path: string;
  referrer: string | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  language: string | null;
  session_id: string;
  created_at: string;
};

const BAR_COLORS = [
  "#6b8cae",
  "#8eaac9",
  "#ffa500",
  "#7ecb7e",
  "#c97ec9",
  "#e8746a",
];

function classifyDevice(width: number | null): string {
  if (width == null) return "Unknown";
  if (width < 768) return "Mobile";
  if (width <= 1024) return "Tablet";
  return "Desktop";
}

function cleanReferrer(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return referrer;
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

export const WebTraffic = () => {
  const [rows, setRows] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState<number | null>(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      let query = supabaseClient
        .from("website_page_views")
        .select(
          "id, page_path, referrer, user_agent, screen_width, screen_height, language, session_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10000);

      if (daysBack !== null) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        query = query.gte("created_at", cutoff.toISOString());
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError("Failed to load website traffic data.");
        console.error(fetchError);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };
    load();
  }, [daysBack]);

  /* ── Summary stats ── */
  const totalViews = rows.length;

  const uniqueSessions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.session_id);
    return set.size;
  }, [rows]);

  const pagesPerSession = uniqueSessions
    ? (totalViews / uniqueSessions).toFixed(1)
    : "0";

  const topPage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows)
      map.set(r.page_path, (map.get(r.page_path) || 0) + 1);
    let best = "/";
    let max = 0;
    for (const [path, count] of map) {
      if (count > max) {
        max = count;
        best = path;
      }
    }
    return best;
  }, [rows]);

  /* ── Daily views ── */
  const dailyViews = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const day = formatDate(r.created_at);
      map.set(day, (map.get(day) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const dailyMax = dailyViews.length
    ? Math.max(...dailyViews.map(([, c]) => c))
    : 0;

  /* ── Page counts ── */
  const pageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows)
      map.set(r.page_path, (map.get(r.page_path) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  /* ── Referrer counts ── */
  const referrerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const ref = cleanReferrer(r.referrer);
      map.set(ref, (map.get(ref) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  /* ── Device breakdown ── */
  const deviceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const device = classifyDevice(r.screen_width);
      map.set(device, (map.get(device) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const deviceTotal = useMemo(
    () => deviceCounts.reduce((s, [, c]) => s + c, 0),
    [deviceCounts],
  );

  /* ── Recent views (last 50) ── */
  const recentViews = useMemo(() => rows.slice(0, 50), [rows]);

  /* ── Range buttons ── */
  const rangeButtons: { label: string; value: number | null }[] = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "All time", value: null },
  ];

  return (
    <div className="page-card" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <h1>Web Traffic</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {rangeButtons.map((b) => (
            <button
              key={b.label}
              className="ghost-btn"
              style={
                daysBack === b.value
                  ? { background: "var(--primary)", color: "#fff" }
                  : undefined
              }
              onClick={() => setDaysBack(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              { label: "Total Page Views", value: totalViews.toLocaleString() },
              {
                label: "Unique Sessions",
                value: uniqueSessions.toLocaleString(),
              },
              { label: "Pages / Session", value: pagesPerSession },
              { label: "Top Page", value: topPage },
            ].map((card) => (
              <div
                key={card.label}
                className="chart-card"
                style={{ textAlign: "center", padding: "20px 12px" }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  {card.value}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Daily page views chart (vertical bars) ── */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div className="chart-card__header">
              <h3>Daily Page Views</h3>
            </div>
            {dailyViews.length > 0 ? (
              <div style={{ padding: "12px 16px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: dailyViews.length > 30 ? 1 : dailyViews.length > 14 ? 2 : 4,
                    height: 220,
                  }}
                >
                  {dailyViews.map(([day, count]) => {
                    const pct = dailyMax ? (count / dailyMax) * 100 : 0;
                    return (
                      <div
                        key={day}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                        title={`${day}: ${count} views`}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginBottom: 4,
                          }}
                        >
                          {dailyViews.length <= 14 ? count : ""}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 48,
                            height: `${Math.max(pct, 2)}%`,
                            background: "#6b8cae",
                            borderRadius: "4px 4px 0 0",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: dailyViews.length > 30 ? 1 : dailyViews.length > 14 ? 2 : 4,
                    marginTop: 6,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 6,
                  }}
                >
                  {dailyViews.map(([day], i) => (
                    <div
                      key={day}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 10,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dailyViews.length <= 14
                        ? day.slice(5) // MM-DD
                        : i % Math.ceil(dailyViews.length / 7) === 0
                          ? day.slice(5)
                          : ""}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p
                className="muted-text"
                style={{ margin: 0, padding: "12px 16px 16px" }}
              >
                No data to plot.
              </p>
            )}
          </div>

          {/* ── Two-column: Pages | Referrers ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Popular pages */}
            <div className="chart-card">
              <div className="chart-card__header">
                <h3>Popular Pages</h3>
              </div>
              <div style={{ padding: 16 }}>
                {pageCounts.map(([path, count], idx) => {
                  const max = pageCounts[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  return (
                    <div
                      key={path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 140,
                          flexShrink: 0,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {path}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          background: "#2c3039",
                          borderRadius: 4,
                          height: 20,
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            background: BAR_COLORS[idx % BAR_COLORS.length],
                            height: "100%",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: 48,
                          textAlign: "right",
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
                {pageCounts.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>No data</p>
                )}
              </div>
            </div>

            {/* Referrer sources */}
            <div className="chart-card">
              <div className="chart-card__header">
                <h3>Referrer Sources</h3>
              </div>
              <div style={{ padding: 16 }}>
                {referrerCounts.map(([ref, count], idx) => {
                  const max = referrerCounts[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  return (
                    <div
                      key={ref}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 140,
                          flexShrink: 0,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ref}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          background: "#2c3039",
                          borderRadius: 4,
                          height: 20,
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            background: BAR_COLORS[idx % BAR_COLORS.length],
                            height: "100%",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: 48,
                          textAlign: "right",
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
                {referrerCounts.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>No data</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Device breakdown ── */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div className="chart-card__header">
              <h3>Device Breakdown</h3>
            </div>
            <div style={{ padding: 16 }}>
              {deviceCounts.map(([device, count], idx) => {
                const max = deviceCounts[0]?.[1] || 1;
                const pct = (count / max) * 100;
                const percent = deviceTotal
                  ? ((count / deviceTotal) * 100).toFixed(1)
                  : "0";
                return (
                  <div
                    key={device}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 140,
                        flexShrink: 0,
                        fontSize: 13,
                      }}
                    >
                      {device}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#2c3039",
                        borderRadius: 4,
                        height: 20,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          background: BAR_COLORS[idx % BAR_COLORS.length],
                          height: "100%",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 48,
                        textAlign: "right",
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {percent}%
                    </div>
                  </div>
                );
              })}
              {deviceCounts.length === 0 && (
                <p style={{ color: "var(--muted)" }}>No data</p>
              )}
            </div>
          </div>

          {/* ── Recent page views table ── */}
          <div className="chart-card">
            <div className="chart-card__header">
              <h3>Recent Page Views</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Referrer</th>
                  <th>Device</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentViews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.page_path}</td>
                    <td>{cleanReferrer(r.referrer)}</td>
                    <td>{classifyDevice(r.screen_width)}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {recentViews.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center", color: "var(--muted)" }}
                    >
                      No recent page views
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
