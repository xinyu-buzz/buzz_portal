import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type ProfileRow = {
  id: string;
  email: string | null;
  user_type: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  call_sign?: string | null;
};

export const NewAccountsList = () => {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [daysBack, setDaysBack] = useState(30);
  const [showAll, setShowAll] = useState(true);

  const cutoffISO = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toISOString();
  }, [daysBack]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const query = supabaseClient
        .from("profiles")
        .select("id,email,user_type,created_at,first_name,last_name,call_sign")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!showAll) {
        query.gte("created_at", cutoffISO);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to load profiles", error);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };
    load();
  }, [cutoffISO, showAll]);

  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const entries = Array.from(counts.entries()).sort((a, b) =>
      a[0] > b[0] ? 1 : -1
    );

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let runningTotal = 0;
    const cumulative = entries.map(([month, count]) => {
      runningTotal += count;
      const [, monthNum] = month.split("-");
      const monthLabel = monthNames[parseInt(monthNum, 10) - 1];
      return [monthLabel, runningTotal] as [string, number];
    });

    const max = cumulative.reduce((m, [, c]) => Math.max(m, c), 0);

    const points = cumulative.map(([_, total], idx) => {
      const x = cumulative.length <= 1 ? 0 : (idx / (cumulative.length - 1)) * 100;
      const y = max ? 100 - (total / max) * 100 : 100;
      return `${x},${y}`;
    });

    return { entries: cumulative, points: points.join(" "), max };
  }, [rows]);

  const chartPath = useMemo(() => {
    const pts = chartData.points
      .split(" ")
      .filter(Boolean)
      .map((p) => {
        const [x, y] = p.split(",").map(Number);
        return { x, y };
      });
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

    const d: string[] = [];
    d.push(`M ${pts[0].x},${pts[0].y}`);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[0];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

      const smoothing = 0.15;
      const cp1x = p1.x + (p2.x - p0.x) * smoothing;
      const cp1y = p1.y + (p2.y - p0.y) * smoothing;
      const cp2x = p2.x - (p3.x - p1.x) * smoothing;
      const cp2y = p2.y - (p3.y - p1.y) * smoothing;

      d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
    }
    return d.join(" ");
  }, [chartData.points]);

  const yTicks = useMemo(() => {
    const steps = 4;
    const max = chartData.max || 0;
    if (max === 0) return [];
    const tick = Math.max(1, Math.ceil(max / steps));
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += tick) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  }, [chartData.max]);

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>New Accounts</h1>
        <div className="filters">
          <button
            className="ghost-btn"
            style={{ marginRight: 8 }}
            onClick={() => setShowAll(true)}
          >
            All
          </button>
          <label>
            Created in last{" "}
            <input
              type="number"
              min={1}
              max={365}
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value) || 30)}
              style={{ width: 80, marginLeft: 8, marginRight: 8 }}
              disabled={showAll}
            />
            days
          </label>
          {showAll && (
            <button
              className="ghost-btn"
              style={{ marginLeft: 8 }}
              onClick={() => setShowAll(false)}
            >
              Apply filter
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>User Type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>
                  {(row.user_type === "pilot" && row.call_sign) ||
                    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </td>
                <td>{row.user_type}</td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  No accounts in this window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="chart-card">
        <div className="chart-card__header">
          <div>
            <h3 style={{ margin: 0 }}>New accounts over time</h3>
            <p className="muted-text" style={{ margin: "4px 0 0 0" }}>
              Showing {chartData.entries.length || 0} month(s) from current
              results
            </p>
          </div>
          <div className="muted-text">
            Total: {chartData.max || 0} accounts
          </div>
        </div>
        {chartData.entries.length ? (
          <div className="line-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6b8cae" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#6b8cae" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {yTicks.map((val) => {
                const y = chartData.max ? 100 - (val / chartData.max) * 100 : 100;
                return (
                  <line
                    key={val}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="0.6"
                    opacity="0.4"
                  />
                );
              })}
              <line
                x1="0"
                y1="100"
                x2="100"
                y2="100"
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.8"
              />
              {chartPath && (
                <g>
                  <path
                    d={`${chartPath} L 100 100 L 0 100 Z`}
                    fill="url(#areaGradient)"
                    stroke="none"
                  />
                  <path
                    d={chartPath}
                    fill="none"
                    stroke="#8eaac9"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </svg>
            <div className="chart-axis">
              <span>{chartData.entries[0][0]}</span>
              <span>
                {
                  chartData.entries[
                    Math.max(0, Math.floor(chartData.entries.length / 2))
                  ][0]
                }
              </span>
              <span>{chartData.entries[chartData.entries.length - 1][0]}</span>
            </div>
          </div>
        ) : (
          <p className="muted-text" style={{ margin: 0 }}>
            No data to plot.
          </p>
        )}
      </div>
    </div>
  );
};

