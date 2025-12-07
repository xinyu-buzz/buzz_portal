import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type ProfileRow = {
  id: string;
  email: string | null;
  user_type: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
};

export const NewAccountsList = () => {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [daysBack, setDaysBack] = useState(30);
  const [showAll, setShowAll] = useState(false);

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
        .select("id,email,user_type,created_at,first_name,last_name")
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
                  {[row.first_name, row.last_name].filter(Boolean).join(" ") ||
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
    </div>
  );
};
