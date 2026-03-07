import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "../../utility";

type PilotSpecialRole = {
  pilot_id: string;
  first_name: string | null;
  last_name: string | null;
  call_sign: string | null;
  region: string | null;
  flight_reviewer: boolean;
  roc_a_examiner: boolean;
  dual_citizen_pilot: boolean;
  faa: boolean;
  tc: boolean;
};

type RoleFilter =
  | "all"
  | "flight_reviewer"
  | "roc_a_examiner"
  | "dual_citizen_pilot"
  | "faa"
  | "tc";

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flight_reviewer", label: "Flight Reviewer" },
  { key: "roc_a_examiner", label: "ROC-A Examiner" },
  { key: "dual_citizen_pilot", label: "Dual Citizen Pilot" },
  { key: "faa", label: "FAA" },
  { key: "tc", label: "TC" },
];

type ProfileSearchResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  call_sign: string | null;
  selected_region: string | null;
};

type EditForm = {
  pilot_id: string;
  first_name: string;
  last_name: string;
  call_sign: string;
  region: string;
  flight_reviewer: boolean;
  roc_a_examiner: boolean;
  dual_citizen_pilot: boolean;
  faa: boolean;
  tc: boolean;
  tier: number;
};

const TIER_LABELS: Record<number, string> = {
  0: "Ensign",
  1: "Sub Lieutenant",
  2: "Lieutenant",
  3: "Commander",
  4: "Captain",
};

const ROLE_KEYS: { key: keyof Pick<EditForm, "flight_reviewer" | "roc_a_examiner" | "dual_citizen_pilot" | "faa" | "tc">; label: string }[] = [
  { key: "flight_reviewer", label: "Flight Reviewer" },
  { key: "roc_a_examiner", label: "ROC-A Examiner" },
  { key: "dual_citizen_pilot", label: "Dual Citizen Pilot" },
  { key: "faa", label: "FAA" },
  { key: "tc", label: "TC" },
];

export const PilotAccounts = () => {
  const [allPilots, setAllPilots] = useState<PilotSpecialRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<RoleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSearch, setEditSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [tierMap, setTierMap] = useState<Record<string, number>>({});

  const loadPilots = async () => {
    setLoading(true);
    setError(null);

    try {
      const [rolesResult, statsResult] = await Promise.all([
        supabaseClient.from("pilot_special_roles").select("*"),
        supabaseClient.from("pilot_stats").select("pilot_id, tier"),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (statsResult.error) throw statsResult.error;

      setAllPilots((rolesResult.data || []) as PilotSpecialRole[]);

      const map: Record<string, number> = {};
      for (const row of statsResult.data || []) {
        map[row.pilot_id] = row.tier;
      }
      setTierMap(map);
    } catch (err: any) {
      console.error("Failed to load pilot accounts", err);
      setError(err.message || "Failed to load pilot accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPilots();
  }, []);

  const filteredPilots = useMemo(() => {
    let results = allPilots;

    if (activeRole !== "all") {
      results = results.filter((p) => p[activeRole]);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (p) =>
          p.first_name?.toLowerCase().includes(q) ||
          p.last_name?.toLowerCase().includes(q) ||
          p.call_sign?.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q)
      );
    }

    return results;
  }, [allPilots, activeRole, searchQuery]);

  const openEditModal = () => {
    setShowEditModal(true);
    setEditSearch("");
    setSearchResults([]);
    setEditForm(null);
    setEditError(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditSearch("");
    setSearchResults([]);
    setEditForm(null);
    setEditError(null);
  };

  const handleEditSearch = async () => {
    const q = editSearch.trim();
    if (!q) return;

    setSearching(true);
    setEditError(null);
    setEditForm(null);

    try {
      const { data, error: fetchError } = await supabaseClient
        .from("profiles")
        .select("id, first_name, last_name, call_sign, selected_region")
        .or(
          `call_sign.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
        )
        .limit(20);

      if (fetchError) throw fetchError;

      setSearchResults((data || []) as ProfileSearchResult[]);
    } catch (err: any) {
      console.error("Failed to search pilots", err);
      setEditError(err.message || "Failed to search pilots");
    } finally {
      setSearching(false);
    }
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showEditModal || editForm) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!editSearch.trim()) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      handleEditSearch();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editSearch, showEditModal, editForm]);

  const selectPilotForEdit = async (profile: ProfileSearchResult) => {
    setEditError(null);

    // Check if this pilot already has a pilot_special_roles row
    const existing = allPilots.find((p) => p.pilot_id === profile.id);

    // Fetch current tier from pilot_stats
    const currentTier = tierMap[profile.id] ?? 0;

    setEditForm({
      pilot_id: profile.id,
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      call_sign: profile.call_sign || "",
      region: profile.selected_region || "",
      flight_reviewer: existing?.flight_reviewer ?? false,
      roc_a_examiner: existing?.roc_a_examiner ?? false,
      dual_citizen_pilot: existing?.dual_citizen_pilot ?? false,
      faa: existing?.faa ?? false,
      tc: existing?.tc ?? false,
      tier: currentTier,
    });
  };

  const openEditForPilot = (pilot: PilotSpecialRole) => {
    setShowEditModal(true);
    setEditSearch("");
    setSearchResults([]);
    setEditError(null);
    setEditForm({
      pilot_id: pilot.pilot_id,
      first_name: pilot.first_name || "",
      last_name: pilot.last_name || "",
      call_sign: pilot.call_sign || "",
      region: pilot.region || "",
      flight_reviewer: pilot.flight_reviewer,
      roc_a_examiner: pilot.roc_a_examiner,
      dual_citizen_pilot: pilot.dual_citizen_pilot,
      faa: pilot.faa,
      tc: pilot.tc,
      tier: tierMap[pilot.pilot_id] ?? 0,
    });
  };

  const handleSaveRoles = async () => {
    if (!editForm) return;

    setSubmitting(true);
    setEditError(null);

    try {
      const { error: upsertError } = await supabaseClient
        .from("pilot_special_roles")
        .upsert(
          {
            pilot_id: editForm.pilot_id,
            first_name: editForm.first_name || null,
            last_name: editForm.last_name || null,
            call_sign: editForm.call_sign || null,
            region: editForm.region || null,
            flight_reviewer: editForm.flight_reviewer,
            roc_a_examiner: editForm.roc_a_examiner,
            dual_citizen_pilot: editForm.dual_citizen_pilot,
            faa: editForm.faa,
            tc: editForm.tc,
          },
          { onConflict: "pilot_id" }
        );

      if (upsertError) throw upsertError;

      // Auto-complete tests for newly enabled special roles
      const existingPilot = allPilots.find(p => p.pilot_id === editForm.pilot_id);
      const wasFlightReviewer = existingPilot?.flight_reviewer ?? false;
      const wasRocAExaminer = existingPilot?.roc_a_examiner ?? false;

      if (editForm.flight_reviewer && !wasFlightReviewer) {
        const { error: autoCompleteError } = await supabaseClient
          .rpc('auto_complete_tests_for_role', {
            p_pilot_id: editForm.pilot_id,
            p_role_type: 'flight_reviewer',
          });
        if (autoCompleteError) {
          console.warn('Auto-complete tests warning (flight_reviewer):', autoCompleteError.message);
        }
      }
      if (editForm.roc_a_examiner && !wasRocAExaminer) {
        const { error: autoCompleteError } = await supabaseClient
          .rpc('auto_complete_tests_for_role', {
            p_pilot_id: editForm.pilot_id,
            p_role_type: 'roc_a_examiner',
          });
        if (autoCompleteError) {
          console.warn('Auto-complete tests warning (roc_a_examiner):', autoCompleteError.message);
        }
      }

      // Revoke auto-completed tests for roles that were turned OFF
      if (!editForm.flight_reviewer && wasFlightReviewer) {
        const { error: revokeError } = await supabaseClient
          .rpc('revoke_auto_completed_tests_for_role', {
            p_pilot_id: editForm.pilot_id,
            p_role_type: 'flight_reviewer',
          });
        if (revokeError) {
          console.warn('Revoke auto-completed tests warning (flight_reviewer):', revokeError.message);
        }
      }
      if (!editForm.roc_a_examiner && wasRocAExaminer) {
        const { error: revokeError } = await supabaseClient
          .rpc('revoke_auto_completed_tests_for_role', {
            p_pilot_id: editForm.pilot_id,
            p_role_type: 'roc_a_examiner',
          });
        if (revokeError) {
          console.warn('Revoke auto-completed tests warning (roc_a_examiner):', revokeError.message);
        }
      }

      // Update pilot tier in pilot_stats (check existence first to respect RLS)
      const { data: existingStats, error: statsError } = await supabaseClient
        .from("pilot_stats")
        .select("tier")
        .eq("pilot_id", editForm.pilot_id)
        .maybeSingle();

      if (statsError) throw statsError;

      if (!existingStats) {
        const { data: inserted, error: insertError } = await supabaseClient
          .from("pilot_stats")
          .insert({ pilot_id: editForm.pilot_id, tier: editForm.tier })
          .select("tier")
          .maybeSingle();

        if (insertError) throw insertError;
        if (!inserted) throw new Error("Failed to create pilot stats record.");
      } else if (existingStats.tier !== editForm.tier) {
        const { data: updated, error: updateError } = await supabaseClient
          .from("pilot_stats")
          .update({ tier: editForm.tier })
          .eq("pilot_id", editForm.pilot_id)
          .select("tier")
          .maybeSingle();

        if (updateError) throw updateError;
        if (!updated) throw new Error("Failed to update pilot rank — no row was modified.");
      }

      closeEditModal();
      await loadPilots();
    } catch (err: any) {
      console.error("Failed to save pilot roles", err);
      setEditError(err.message || "Failed to save pilot roles");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (value: boolean) => {
    const style = value
      ? { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e", label: "Yes" }
      : { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444", label: "No" };

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 600,
          backgroundColor: style.bg,
          color: style.text,
        }}
      >
        {style.label}
      </span>
    );
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Pilot Accounts</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="primary-btn" onClick={openEditModal}>
            Edit
          </button>
          <button className="primary-btn" onClick={loadPilots}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filter Section */}
      <div
        style={{
          backgroundColor: "rgba(107, 140, 174, 0.1)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search by name, call sign, or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: "250px",
              padding: "10px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              color: "white",
              fontSize: "14px",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Role
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ROLE_FILTERS.map((rf) => (
              <button
                key={rf.key}
                onClick={() => setActiveRole(rf.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor:
                    activeRole === rf.key
                      ? "#6b8cae"
                      : "rgba(255, 255, 255, 0.1)",
                  color: activeRole === rf.key ? "white" : "#9ca3b5",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading pilot accounts...</p>
      ) : (
        <>
          <p style={{ marginBottom: "16px", color: "#9ca3b5" }}>
            Showing {filteredPilots.length} pilot
            {filteredPilots.length !== 1 ? "s" : ""}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pilot Name</th>
                  <th>Call Sign</th>
                  <th>Region</th>
                  <th>Rank</th>
                  {(activeRole === "all" || activeRole === "flight_reviewer") && <th>Flight Reviewer</th>}
                  {(activeRole === "all" || activeRole === "roc_a_examiner") && <th>ROC-A Examiner</th>}
                  {(activeRole === "all" || activeRole === "dual_citizen_pilot") && <th>Dual Citizen</th>}
                  {(activeRole === "all" || activeRole === "faa") && <th>FAA</th>}
                  {(activeRole === "all" || activeRole === "tc") && <th>TC</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPilots.map((pilot) => {
                  const name = [pilot.first_name, pilot.last_name]
                    .filter(Boolean)
                    .join(" ") || "Unknown";

                  return (
                    <tr key={pilot.pilot_id} onClick={() => openEditForPilot(pilot)} style={{ cursor: "pointer" }}>
                      <td>{name}</td>
                      <td>{pilot.call_sign || "-"}</td>
                      <td>{pilot.region || "-"}</td>
                      <td>{TIER_LABELS[tierMap[pilot.pilot_id] ?? 0] ?? "Ensign"}</td>
                      {(activeRole === "all" || activeRole === "flight_reviewer") && <td>{getRoleBadge(pilot.flight_reviewer)}</td>}
                      {(activeRole === "all" || activeRole === "roc_a_examiner") && <td>{getRoleBadge(pilot.roc_a_examiner)}</td>}
                      {(activeRole === "all" || activeRole === "dual_citizen_pilot") && <td>{getRoleBadge(pilot.dual_citizen_pilot)}</td>}
                      {(activeRole === "all" || activeRole === "faa") && <td>{getRoleBadge(pilot.faa)}</td>}
                      {(activeRole === "all" || activeRole === "tc") && <td>{getRoleBadge(pilot.tc)}</td>}
                    </tr>
                  );
                })}
                {filteredPilots.length === 0 && (
                  <tr>
                    <td colSpan={activeRole === "all" ? 9 : 5} style={{ textAlign: "center" }}>
                      No pilot accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ margin: 0 }}>Edit Pilot Roles</h3>
              <button className="ghost-btn" onClick={closeEditModal}>
                Close
              </button>
            </div>

            {editError && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                {editError}
              </div>
            )}

            {/* Search for pilot */}
            {!editForm && (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    placeholder="Type a call sign or name to search..."
                    value={editSearch}
                    onChange={(e) => setEditSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                    }}
                  />
                  {searching && (
                    <p style={{ color: "#9ca3b5", fontSize: "13px", marginTop: "8px" }}>
                      Searching...
                    </p>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Call Sign</th>
                          <th>Region</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((p) => {
                          const name =
                            [p.first_name, p.last_name]
                              .filter(Boolean)
                              .join(" ") || "Unknown";
                          return (
                            <tr key={p.id}>
                              <td>{name}</td>
                              <td>{p.call_sign || "-"}</td>
                              <td>{p.selected_region || "-"}</td>
                              <td>
                                <button
                                  className="primary-btn"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    backgroundColor: "#6b8cae",
                                  }}
                                  onClick={() => selectPilotForEdit(p)}
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {searchResults.length === 0 && editSearch && !searching && (
                  <p style={{ color: "#9ca3b5", textAlign: "center" }}>
                    No pilots found. Try a different search term.
                  </p>
                )}
              </>
            )}

            {/* Role checkboxes */}
            {editForm && (
              <>
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <strong>Pilot:</strong>{" "}
                    {[editForm.first_name, editForm.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unknown"}
                  </div>
                  {editForm.call_sign && (
                    <div style={{ marginBottom: "12px" }}>
                      <strong>Call Sign:</strong> {editForm.call_sign}
                    </div>
                  )}
                  {editForm.region && (
                    <div style={{ marginBottom: "12px" }}>
                      <strong>Region:</strong> {editForm.region}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "12px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Rank
                  </label>
                  <select
                    value={editForm.tier}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tier: Number(e.target.value) })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    {Object.entries(TIER_LABELS).map(([value, label]) => (
                      <option key={value} value={value} style={{ color: "black" }}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "16px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Special Roles
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {ROLE_KEYS.map((role) => (
                      <label
                        key={role.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editForm[role.key]}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              [role.key]: e.target.checked,
                            })
                          }
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#6b8cae",
                            cursor: "pointer",
                          }}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="primary-btn"
                    onClick={handleSaveRoles}
                    disabled={submitting}
                    style={{ backgroundColor: "#22c55e" }}
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setEditForm(null);
                      setEditError(null);
                    }}
                    disabled={submitting}
                  >
                    Back to Search
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={closeEditModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
