import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility";
import { useIsOwner } from "../../hooks/useIsOwner";

type PilotProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  call_sign: string | null;
  email: string | null;
  phone: string | null;
  user_type: string | null;
  selected_region: string | null;
  profile_picture_url: string | null;
  last_location_lat: number | null;
  last_location_lng: number | null;
  last_location_update: string | null;
  created_at: string | null;
};

type SpecialRoles = {
  flight_reviewer: boolean;
  roc_a_examiner: boolean;
  dual_citizen_pilot: boolean;
  faa: boolean;
  tc: boolean;
};

const TIER_LABELS: Record<number, string> = {
  0: "Ensign",
  1: "Sub Lieutenant",
  2: "Lieutenant",
  3: "Commander",
  4: "Captain",
};

const ROLE_LABELS: { key: keyof SpecialRoles; label: string }[] = [
  { key: "flight_reviewer", label: "Flight Reviewer" },
  { key: "roc_a_examiner", label: "ROC-A Examiner" },
  { key: "dual_citizen_pilot", label: "Dual Citizen Pilot" },
  { key: "faa", label: "FAA" },
  { key: "tc", label: "TC" },
];

const formatFullDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diffMs = Date.now() - d;
  if (diffMs < 0) return "in the future";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

export const PilotDetail = () => {
  const { pilotId } = useParams<{ pilotId: string }>();
  const { isOwner, loading: ownerLoading } = useIsOwner();
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [roles, setRoles] = useState<SpecialRoles | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pilotId) return;
    if (!isOwner) return;
    setLoading(true);
    setError(null);

    try {
      const [profileRes, rolesRes, statsRes, signInRes] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select(
            "id, first_name, last_name, call_sign, email, phone, user_type, selected_region, profile_picture_url, last_location_lat, last_location_lng, last_location_update, created_at",
          )
          .eq("id", pilotId)
          .maybeSingle(),
        supabaseClient
          .from("pilot_special_roles")
          .select(
            "flight_reviewer, roc_a_examiner, dual_citizen_pilot, faa, tc",
          )
          .eq("pilot_id", pilotId)
          .maybeSingle(),
        supabaseClient
          .from("pilot_stats")
          .select("tier")
          .eq("pilot_id", pilotId)
          .maybeSingle(),
        supabaseClient.rpc("admin_get_pilot_last_sign_in", {
          p_pilot_id: pilotId,
        }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (!profileRes.data) throw new Error("Pilot not found.");
      setProfile(profileRes.data as PilotProfile);

      if (rolesRes.error && rolesRes.error.code !== "PGRST116") {
        console.warn("Failed to load pilot roles:", rolesRes.error.message);
      }
      setRoles((rolesRes.data as SpecialRoles) || null);

      if (statsRes.error && statsRes.error.code !== "PGRST116") {
        console.warn("Failed to load pilot tier:", statsRes.error.message);
      }
      setTier(statsRes.data?.tier ?? null);

      if (signInRes.error) {
        console.warn(
          "Failed to load last sign-in:",
          signInRes.error.message,
        );
        setLastSignIn(null);
      } else {
        setLastSignIn((signInRes.data as string | null) || null);
      }
    } catch (err: any) {
      console.error("Failed to load pilot detail", err);
      setError(err?.message || "Failed to load pilot detail.");
    } finally {
      setLoading(false);
    }
  }, [pilotId, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const fullName = useMemo(() => {
    if (!profile) return "Unknown";
    return (
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "Unknown"
    );
  }, [profile]);

  const lat = profile?.last_location_lat ?? null;
  const lng = profile?.last_location_lng ?? null;
  const hasLocation = lat !== null && lng !== null;

  const mapEmbedUrl = useMemo(() => {
    if (!hasLocation) return null;
    const delta = 0.01; // ~1 km window
    const bbox = `${lng! - delta},${lat! - delta},${lng! + delta},${lat! + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  }, [hasLocation, lat, lng]);

  const mapViewUrl = useMemo(() => {
    if (!hasLocation) return null;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  }, [hasLocation, lat, lng]);

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <Link
            to="/admin/pilot-accounts"
            style={{ fontSize: 13, color: "#9ca3b5", textDecoration: "none" }}
          >
            &#8592; Back to Pilot Accounts
          </Link>
          <h1 style={{ marginTop: 8 }}>Pilot Detail</h1>
        </div>
        <button className="primary-btn" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {ownerLoading ? (
        <p>Checking access...</p>
      ) : !isOwner ? (
        <div
          className="alert error"
          role="alert"
          style={{ marginBottom: 16 }}
        >
          You do not have access to this page.
        </div>
      ) : loading ? (
        <p>Loading pilot detail...</p>
      ) : !profile ? (
        <p style={{ color: "#9ca3b5" }}>Pilot not found.</p>
      ) : (
        <>
          {/* Pilot header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: 20,
              backgroundColor: "rgba(107, 140, 174, 0.1)",
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.08)",
                backgroundImage: profile.profile_picture_url
                  ? `url(${profile.profile_picture_url})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
              aria-hidden
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{fullName}</h2>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 6,
                  color: "#9ca3b5",
                  fontSize: 14,
                  flexWrap: "wrap",
                }}
              >
                {profile.call_sign && (
                  <span>
                    <strong style={{ color: "#d9dde4" }}>Call Sign:</strong>{" "}
                    {profile.call_sign}
                  </span>
                )}
                {profile.selected_region && (
                  <span>
                    <strong style={{ color: "#d9dde4" }}>Region:</strong>{" "}
                    {profile.selected_region}
                  </span>
                )}
                {profile.email && (
                  <span>
                    <strong style={{ color: "#d9dde4" }}>Email:</strong>{" "}
                    {profile.email}
                  </span>
                )}
                {tier !== null && (
                  <span>
                    <strong style={{ color: "#d9dde4" }}>Rank:</strong>{" "}
                    {TIER_LABELS[tier] ?? "Unknown"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Activity card */}
            <div
              style={{
                padding: 20,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
                Activity
              </h3>

              <ActivityRow
                label="Last sign-in"
                iso={lastSignIn}
                hint="Authenticated with email / OAuth"
              />
              <ActivityRow
                label="Last app use"
                iso={profile.last_location_update}
                hint="Updated on app launch or foreground"
              />
              <ActivityRow
                label="Account created"
                iso={profile.created_at}
              />
            </div>

            {/* Special roles card */}
            <div
              style={{
                padding: 20,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
                Special Roles
              </h3>
              {roles ? (
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                >
                  {ROLE_LABELS.map(({ key, label }) => (
                    <RoleBadge
                      key={key}
                      label={label}
                      active={roles[key]}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9ca3b5", margin: 0 }}>
                  No special roles assigned.
                </p>
              )}
            </div>
          </div>

          {/* Location card */}
          <div
            style={{
              padding: 20,
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Last Known Location</h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    color: "#9ca3b5",
                  }}
                >
                  {hasLocation
                    ? `${lat!.toFixed(5)}°, ${lng!.toFixed(5)}° · updated ${formatRelative(profile.last_location_update)}`
                    : "No location recorded for this pilot."}
                </p>
              </div>
              {mapViewUrl && (
                <a
                  href={mapViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-btn"
                  style={{ textDecoration: "none" }}
                >
                  Open in OpenStreetMap
                </a>
              )}
            </div>

            {hasLocation && mapEmbedUrl ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 420,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <iframe
                  title={`Location of ${fullName}`}
                  src={mapEmbedUrl}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  loading="lazy"
                />
              </div>
            ) : (
              <p style={{ color: "#9ca3b5", margin: 0 }}>
                This pilot has not shared a location yet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ActivityRow = ({
  label,
  iso,
  hint,
}: {
  label: string;
  iso: string | null;
  hint?: string;
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 12, color: "#6d7689", marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 14, color: "#d9dde4" }}>
        {formatFullDate(iso)}
      </div>
      {iso && (
        <div style={{ fontSize: 12, color: "#9ca3b5", marginTop: 2 }}>
          {formatRelative(iso)}
        </div>
      )}
    </div>
  </div>
);

const RoleBadge = ({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) => (
  <span
    style={{
      padding: "6px 12px",
      borderRadius: 16,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: active
        ? "rgba(34, 197, 94, 0.2)"
        : "rgba(107, 114, 128, 0.15)",
      color: active ? "#22c55e" : "#6d7689",
      border: active
        ? "1px solid rgba(34, 197, 94, 0.4)"
        : "1px solid rgba(107, 114, 128, 0.25)",
    }}
  >
    {label}
  </span>
);
