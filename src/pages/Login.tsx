import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabaseClient } from "../utility";
import {
  PERMISSION_ERROR_MESSAGE,
  portalBasePath,
  validatePortalSelection,
} from "../portals/shared/role";

const roles = ["admin", "pilot", "editor", "client"] as const;

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<typeof roles[number]>("pilot");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem("buzz_portal_email");
    const savedRole = localStorage.getItem("buzz_portal_role") as
      | typeof roles[number]
      | null;
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
    if (savedRole && roles.includes(savedRole)) {
      setRole(savedRole);
    }
  }, []);

  useEffect(() => {
    const locationError =
      (location.state as { error?: string } | null)?.error || null;
    if (locationError) {
      setError(locationError);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data?.user) {
      setError(signInError?.message || "Unable to sign in");
      setLoading(false);
      return;
    }

    const { role: resolvedRole, error: roleError } =
      await validatePortalSelection(role as any);

    if (roleError || !resolvedRole) {
      setError(roleError || PERMISSION_ERROR_MESSAGE);
      setLoading(false);
      return;
    }

    if (remember) {
      localStorage.setItem("buzz_portal_email", email);
    } else {
      localStorage.removeItem("buzz_portal_email");
    }

    const destination = portalBasePath(resolvedRole as any);
    navigate(destination === "/login" ? "/login" : destination);
    setLoading(false);
  };

  const portalLabel =
    role === "admin"
      ? "Admin Portal"
      : role === "pilot"
      ? "Pilot Portal"
      : role === "editor"
      ? "Editor Portal"
      : role === "client"
      ? "Client Portal"
      : "Buzz Portal";
  const subhead =
    role === "admin"
      ? "Sign in to the admin portal"
      : role === "pilot"
      ? "Sign in to your pilot account"
      : role === "editor"
      ? "Sign in to the editor portal"
      : role === "client"
      ? "Sign in to the client portal"
      : "Sign in to your Buzz account";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="/android-chrome-512x512.png"
            alt="Buzz"
            className="logo-img"
          />
          <div>
            <p className="eyebrow">{portalLabel}</p>
            <h1>Buzz</h1>
            <p className="subhead">{subhead}</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert error">{error}</div>}

          <label className="input-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
            className="text-input"
          />

          <label className="input-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            className="text-input"
          />

          <label className="input-label">Role</label>
          <div className="role-grid">
            {roles.map((r) => (
              <label key={r} className={`role-pill ${role === r ? "active" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                />
                <span className="pill-label">{r.charAt(0).toUpperCase() + r.slice(1)}</span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <Link to="#" style={{ color: "#aab2c6", fontSize: 13 }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};
