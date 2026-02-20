import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";
import { UserLocationMap } from "./UserLocationMap/UserLocationMap";

type UsageLog = {
  id: string;
  user_id: string;
  component_name: string;
  section_name: string;
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

export const AppAnalytics = () => {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState<number | null>(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      let query = supabaseClient
        .from("cockpit_usage_logs")
        .select("id, user_id, component_name, section_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (daysBack !== null) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        query = query.gte("created_at", cutoff.toISOString());
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError("Failed to load usage data.");
        console.error(fetchError);
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    };
    load();
  }, [daysBack]);

  /* ── Component counts ── */
  const componentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      map.set(l.component_name, (map.get(l.component_name) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [logs]);

  /* ── Section counts ── */
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      map.set(l.section_name, (map.get(l.section_name) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [logs]);

  /* ── Component bar chart data (vertical) ── */
  const componentBarMax = componentCounts.length
    ? componentCounts[0][1]
    : 0;

  /* ── Recent activity (last 50) ── */
  const recentLogs = useMemo(() => logs.slice(0, 50), [logs]);

  const sectionTotal = useMemo(
    () => sectionCounts.reduce((s, [, c]) => s + c, 0),
    [sectionCounts],
  );

  /* ── Render helpers ── */
  const rangeButtons: { label: string; value: number | null }[] = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "All time", value: null },
  ];

  return (
    <div className="page-card" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <h1>App Analytics</h1>
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
          {/* ── Two-column: Components | Sections ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Component bar chart */}
            <div className="chart-card">
              <div className="chart-card__header">
                <h3>Component Popularity</h3>
              </div>
              <div style={{ padding: 16 }}>
                {componentCounts.map(([name, count], idx) => {
                  const max = componentCounts[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  return (
                    <div
                      key={name}
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
                        {name}
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
                            background:
                              BAR_COLORS[idx % BAR_COLORS.length],
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
                {componentCounts.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>No data</p>
                )}
              </div>
            </div>

            {/* Section breakdown */}
            <div className="chart-card">
              <div className="chart-card__header">
                <h3>Usage by Section</h3>
              </div>
              <div style={{ padding: 16 }}>
                {sectionCounts.map(([name, count], idx) => {
                  const max = sectionCounts[0]?.[1] || 1;
                  const pct = (count / max) * 100;
                  const percent = sectionTotal
                    ? ((count / sectionTotal) * 100).toFixed(1)
                    : "0";
                  return (
                    <div
                      key={name}
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
                        {name}
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
                            background:
                              BAR_COLORS[idx % BAR_COLORS.length],
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
                {sectionCounts.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>No data</p>
                )}
              </div>
            </div>
          </div>

          {/* ── User location map ── */}
          <UserLocationMap />

          {/* ── Component usage bar chart (vertical) ── */}
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div className="chart-card__header">
              <h3>Component Usage</h3>
            </div>
            {componentCounts.length > 0 ? (
              <div style={{ padding: "12px 16px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: componentCounts.length > 12 ? 2 : 6,
                    height: 220,
                  }}
                >
                  {componentCounts.map(([name, count], idx) => {
                    const pct = componentBarMax
                      ? (count / componentBarMax) * 100
                      : 0;
                    return (
                      <div
                        key={name}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginBottom: 4,
                          }}
                        >
                          {count}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 48,
                            height: `${Math.max(pct, 2)}%`,
                            background: BAR_COLORS[idx % BAR_COLORS.length],
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
                    gap: componentCounts.length > 12 ? 2 : 6,
                    marginTop: 6,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 6,
                  }}
                >
                  {componentCounts.map(([name]) => (
                    <div
                      key={name}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
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

          {/* ── Recent activity table ── */}
          <div className="chart-card">
            <div className="chart-card__header">
              <h3>Recent Activity</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Section</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.component_name}</td>
                    <td>{l.section_name}</td>
                    <td>{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No recent activity
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
