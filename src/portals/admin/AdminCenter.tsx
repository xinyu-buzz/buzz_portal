import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../utility";

type EmployeeRole = "employee" | "editor" | "admin" | "owner";

type EmployeeProfile = {
  id: string;
  email: string;
  name: string | null;
  role: EmployeeRole;
  created_at?: string | null;
  updated_at?: string | null;
};

const ROLE_OPTIONS: { value: EmployeeRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const deriveNameFromEmail = (email: string) => {
  const base = email.split("@")[0] || "";
  const cleaned = base.replace(/[._-]/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const AdminCenter: FC = () => {
  const [role, setRole] = useState<EmployeeRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<EmployeeRole>("employee");
  const [creating, setCreating] = useState(false);

  const filteredRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(f));
  }, [filter, rows]);

  const allowedRolesForActor: EmployeeRole[] =
    role === "owner"
      ? ["owner", "admin", "editor", "employee"]
      : ["editor", "employee"];

  useEffect(() => {
    const loadRole = async () => {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const email = data?.user?.email?.toLowerCase();
        if (!email) {
          setRole(null);
          return;
        }
        const { data: emp } = await supabaseClient
          .from("employee_profiles")
          .select("role")
          .eq("email", email)
          .maybeSingle();
        if (emp?.role) {
          setRole(emp.role as EmployeeRole);
          localStorage.setItem("buzz_portal_role", emp.role);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Failed to load current role", err);
        setRole(null);
      }
    };
    loadRole();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabaseClient
      .from("employee_profiles")
      .select("id,email,name,role,created_at,updated_at")
      .order("email", { ascending: true });

    if (error) {
      console.error("Failed to load employees", error);
      setError("Could not load employees. Please try again.");
    } else {
      setRows((data || []) as EmployeeProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const updateRole = async (id: string, nextRole: EmployeeRole) => {
    if (!role) return;
    if (role !== "owner" && !["employee", "editor"].includes(nextRole)) {
      setError("Admins can only assign employee or editor roles.");
      return;
    }
    if (role !== "owner") {
      const target = rows.find((r) => r.id === id);
      if (target && ["admin", "owner"].includes(target.role)) {
        setError("Admins cannot change admin/owner roles.");
        return;
      }
    }
    setSavingId(id);
    setError(null);
    const { error } = await supabaseClient
      .from("employee_profiles")
      .update({ role: nextRole })
      .eq("id", id);

    if (error) {
      console.error("Failed to update role", error);
      setError("Unable to update role. Please try again.");
    } else {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, role: nextRole } : row))
      );
    }
    setSavingId(null);
  };

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(newEmail);
    if (!email.endsWith("@buzzbuzzin.com")) {
      setError("Employees must use a buzzbuzzin.com email.");
      return;
    }
    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }
    if (role !== "owner" && !["employee", "editor"].includes(newRole)) {
      setError("Admins can only create employee or editor roles.");
      return;
    }
    setCreating(true);
    setError(null);

    const { error } = await supabaseClient.from("employee_profiles").upsert(
      [
        {
          email,
          name: newName.trim(),
          role: newRole,
        },
      ],
      { onConflict: "email" }
    );

    if (error) {
      console.error("Failed to add employee", error);
      setError("Unable to save employee. Please try again.");
      setCreating(false);
      return;
    }

    setNewEmail("");
    setNewName("");
    setNewRole("employee");
    setCreating(false);
    await loadEmployees();
  };

  if (role === null) {
    return (
      <div className="page-card">
        <h1>Admin Center</h1>
        <p>Checking your access...</p>
      </div>
    );
  }

  if (role && role !== "admin" && role !== "owner") {
    return (
      <div className="page-card">
        <h1>Admin Center</h1>
        <p>You need admin or owner access to manage employee permissions.</p>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <h1>Admin Center</h1>
          <p className="muted-text">
            Manage internal employee access levels for the Buzz portal.
          </p>
        </div>
        <button className="ghost-btn" onClick={loadEmployees} disabled={loading}>
          Refresh
        </button>
      </div>

      <form className="admin-form" onSubmit={addEmployee}>
        <div className="admin-form__row">
          <label className="input-label" htmlFor="employee-name">
            Name
          </label>
          <input
            id="employee-name"
            className="text-input"
            type="text"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
        </div>
        <div className="admin-form__row">
          <label className="input-label" htmlFor="employee-email">
            Employee email
          </label>
          <input
            id="employee-email"
            className="text-input"
            type="email"
            placeholder="name@buzzbuzzin.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
        </div>
        <div className="admin-form__row">
          <label className="input-label" htmlFor="employee-role">
            Role
          </label>
          <select
            id="employee-role"
            className="text-input"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as EmployeeRole)}
          >
            {ROLE_OPTIONS.filter((opt) => allowedRolesForActor.includes(opt.value)).map(
              (opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              )
            )}
          </select>
        </div>
        <div className="admin-form__actions">
          <button className="primary-btn" type="submit" disabled={creating}>
            {creating ? "Saving..." : "Save employee"}
          </button>
        </div>
      </form>

      <div className="admin-list-actions">
        <input
          className="text-input"
          placeholder="Search by email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="muted-text">
          Showing {filteredRows.length} of {rows.length}
        </span>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p>Loading employees...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name?.trim() || deriveNameFromEmail(row.email)}</td>
                <td>{row.email}</td>
                <td>
                  <select
                    className="text-input"
                    value={row.role}
                    onChange={(e) => updateRole(row.id, e.target.value as EmployeeRole)}
                    disabled={
                      savingId === row.id ||
                      (role !== "owner" && ["admin", "owner"].includes(row.role))
                    }
                  >
                    {ROLE_OPTIONS.filter((opt) =>
                      role === "owner"
                        ? true
                        : opt.value === "employee" ||
                          opt.value === "editor" ||
                          opt.value === row.role
                    ).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center" }}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};




