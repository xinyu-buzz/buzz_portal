import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { supabaseClient } from "../../utility";
import { BookingMediaManager } from "../../components/BookingMediaManager";

const RANK_OPTIONS = [
  { value: "0", label: "Ensign" },
  { value: "1", label: "Sub Lieutenant" },
  { value: "2", label: "Lieutenant" },
  { value: "3", label: "Commander" },
  { value: "4", label: "Captain" },
];

type Booking = {
  id: string;
  customer_id: string;
  location_name: string;
  description: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  pilot_id: string | null;
  location_lat: number;
  location_lng: number;
  payment_amount: number;
  specialization: string | null;
  estimated_flight_hours: number | null;
  required_minimum_rank: number | null;
};

type EditorOption = {
  id: string;
  label: string;
};

type CrewMember = {
  id: string;
  pilot_id: string;
  role: "lead" | "crew";
  label: string;
};

export const BookingShow = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = useMemo(() => id || "", [id]);
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [editorOptions, setEditorOptions] = useState<EditorOption[]>([]);
  const [pilotOptions, setPilotOptions] = useState<EditorOption[]>([]);
  const [selectedPilot, setSelectedPilot] = useState<string>("");
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<string[]>([]);
  const [initialEditors, setInitialEditors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pilotSaving, setPilotSaving] = useState(false);
  const [showPilotPicker, setShowPilotPicker] = useState(false);
  const [showEditorPicker, setShowEditorPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pilotError, setPilotError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { title: string; subtitle?: string; latitude: number; longitude: number }[]
  >([]);
  const [editForm, setEditForm] = useState({
    customer_id: "",
    pilot_id: "",
    location_name: "",
    location_lat: "",
    location_lng: "",
    address: "",
    description: "",
    payment_amount: "",
    scheduled_date: "",
    specialization: "",
    estimated_flight_hours: "",
    required_minimum_rank: "0",
    status: "available",
  });

  useEffect(() => {
    setRole(localStorage.getItem("buzz_portal_role"));
  }, []);

  useEffect(() => {
    if (!bookingId) return;

    const loadBooking = async () => {
      setLoading(true);
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from("bookings")
        .select(
          "id,customer_id,location_name,description,status,scheduled_date,created_at,pilot_id,location_lat,location_lng,payment_amount,specialization,estimated_flight_hours,required_minimum_rank"
        )
        .eq("id", bookingId)
        .single();

      const { data: editorsData, error: editorsError } = await supabaseClient
        .from("booking_editors")
        .select("editor_id")
        .eq("booking_id", bookingId);

      const { data: optionsData, error: optionsError } = await supabaseClient
        .from("profiles")
        .select("id,email,first_name,last_name")
        .eq("user_type", "pilot")
        .order("email", { ascending: true });

      if (bookingError) {
        console.error(bookingError);
        setError("Could not load booking.");
      } else {
        setBooking(bookingData as Booking);
        setSelectedPilot(bookingData?.pilot_id || "");
      }

      if (editorsError) {
        console.error(editorsError);
        setError("Could not load assigned editors.");
      } else {
        const ids = (editorsData || []).map((row) => row.editor_id);
        setSelectedEditors(ids);
        setInitialEditors(ids);
      }

      if (optionsError) {
        console.error(optionsError);
        setError("Could not load editor list.");
      } else {
        const mapped =
          optionsData?.map((p) => ({
            id: p.id as string,
            label:
              [p.first_name, p.last_name].filter(Boolean).join(" ") ||
              (p.email as string),
          })) || [];
        setEditorOptions(mapped);
        setPilotOptions(mapped);
      }
      setLoading(false);
    };

    loadBooking();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId || booking?.specialization !== "automotive") {
      setCrew([]);
      return;
    }

    const loadCrew = async () => {
      const { data, error } = await supabaseClient
        .from("booking_crew")
        .select(
          "id,pilot_id,role,profiles:pilot_id(first_name,last_name,email)"
        )
        .eq("booking_id", bookingId);
      if (error) {
        console.error(error);
        return;
      }
      const members: CrewMember[] =
        data?.map((row: any) => ({
          id: row.id as string,
          pilot_id: row.pilot_id as string,
          role: row.role as "lead" | "crew",
          label:
            [row.profiles?.first_name, row.profiles?.last_name]
              .filter(Boolean)
              .join(" ") || row.profiles?.email || "Unknown pilot",
        })) || [];
      setCrew(members);
      if (members.some((m) => m.role === "lead")) {
        setSelectedPilot(
          members.find((m) => m.role === "lead")?.pilot_id || selectedPilot
        );
      }
    };

    loadCrew();
  }, [bookingId, booking?.specialization]);

  useEffect(() => {
    if (!booking) return;
    setEditForm({
      customer_id: booking.customer_id || "",
      pilot_id: booking.pilot_id || "",
      location_name: booking.location_name || "",
      location_lat: booking.location_lat?.toString() || "",
      location_lng: booking.location_lng?.toString() || "",
      address: "",
      description: booking.description || "",
      payment_amount: booking.payment_amount?.toString() || "",
      scheduled_date: booking.scheduled_date
        ? new Date(booking.scheduled_date).toISOString().slice(0, 16)
        : "",
      specialization: booking.specialization || "",
      estimated_flight_hours: booking.estimated_flight_hours?.toString() || "",
      required_minimum_rank:
        booking.required_minimum_rank !== null &&
        booking.required_minimum_rank !== undefined
          ? booking.required_minimum_rank.toString()
          : "0",
      status: booking.status || "available",
    });
  }, [booking]);

  const toggleEditor = (id: string) => {
    setSelectedEditors((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const saveEditors = async () => {
    if (!bookingId) return;
    setSaving(true);
    setError(null);
    let saveError: string | null = null;

    const toAdd = selectedEditors.filter((id) => !initialEditors.includes(id));
    const toRemove = initialEditors.filter((id) => !selectedEditors.includes(id));

    if (toAdd.length) {
      const { error: insertError } = await supabaseClient
        .from("booking_editors")
        .insert(
          toAdd.map((editorId) => ({
            booking_id: bookingId,
            editor_id: editorId,
          }))
        );
      if (insertError) {
        console.error(insertError);
        saveError = insertError.message;
      }
    }

    if (toRemove.length) {
      const { error: deleteError } = await supabaseClient
        .from("booking_editors")
        .delete()
        .eq("booking_id", bookingId)
        .in("editor_id", toRemove);
      if (deleteError) {
        console.error(deleteError);
        saveError = deleteError.message;
      }
    }

    if (!saveError) {
      setInitialEditors(selectedEditors);
      setShowEditorPicker(false);
    } else {
      setError(saveError);
    }

    setSaving(false);
  };

  const savePilot = async () => {
    if (!bookingId) return;
    setPilotSaving(true);
    setPilotError(null);
    const { data, error: pilotUpdateError } = await supabaseClient
      .from("bookings")
      .update({ pilot_id: selectedPilot || null })
      .eq("id", bookingId)
      .select(
        "id,customer_id,location_name,description,status,scheduled_date,created_at,pilot_id,location_lat,location_lng,payment_amount,specialization,estimated_flight_hours,required_minimum_rank"
      )
      .single();

    if (pilotUpdateError) {
      console.error(pilotUpdateError);
      setPilotError(pilotUpdateError.message);
      setPilotSaving(false);
      return;
    }

    setBooking(data as Booking);
    setPilotSaving(false);
    setShowPilotPicker(false);
  };

  const onFormChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!editForm.address || editForm.address.length < 3) {
        setSuggestions([]);
        return;
      }
      setSuggesting(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            editForm.address
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        if (!resp.ok) {
          setSuggesting(false);
          return;
        }
        const data = await resp.json();
        const items: {
          title: string;
          subtitle?: string;
          latitude: number;
          longitude: number;
        }[] = [];
        data.forEach((place: any) => {
          if (place.lat && place.lon) {
            items.push({
              title:
                place.name ||
                place.display_name?.split(",")[0] ||
                editForm.address,
              subtitle: place.display_name,
              latitude: parseFloat(place.lat),
              longitude: parseFloat(place.lon),
            });
          }
        });
        setSuggestions(items);
      } catch (err) {
        console.error("suggestions", err);
      } finally {
        setSuggesting(false);
      }
    };
    const t = setTimeout(fetchSuggestions, 400);
    return () => clearTimeout(t);
  }, [editForm.address]);

  const selectSuggestion = (s: {
    title: string;
    subtitle?: string;
    latitude: number;
    longitude: number;
  }) => {
    setEditForm((prev) => ({
      ...prev,
      address: s.subtitle || s.title,
      location_lat: s.latitude.toString(),
      location_lng: s.longitude.toString(),
      location_name: prev.location_name || s.title,
    }));
    setSuggestions([]);
  };

  const geocodeAddress = async () => {
    if (!editForm.address) {
      setEditError("Enter an address to look up coordinates.");
      return;
    }
    setGeocoding(true);
    setEditError(null);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          editForm.address
        )}&limit=1&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (!resp.ok) {
        setEditError("Geocoding failed. Please try again.");
        setGeocoding(false);
        return;
      }
      const data = await resp.json();
      if (data.length > 0 && data[0].lat && data[0].lon) {
        setEditForm((prev) => ({
          ...prev,
          location_lat: data[0].lat,
          location_lng: data[0].lon,
        }));
      } else {
        setEditError("No coordinates found for that address.");
      }
    } catch (err) {
      console.error(err);
      setEditError("Geocoding error. See console for details.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    setEditSaving(true);
    setEditError(null);

    if (
      !editForm.customer_id ||
      !editForm.location_name ||
      !editForm.location_lat ||
      !editForm.location_lng ||
      !editForm.payment_amount ||
      !editForm.specialization ||
      editForm.required_minimum_rank === ""
    ) {
      setEditError("Please fill all required fields.");
      setEditSaving(false);
      return;
    }

    const payload: Record<string, any> = {
      customer_id: editForm.customer_id,
      location_name: editForm.location_name,
      location_lat: parseFloat(editForm.location_lat),
      location_lng: parseFloat(editForm.location_lng),
      specialization: editForm.specialization,
      payment_amount: parseFloat(editForm.payment_amount),
      status: editForm.status || "available",
    };

    if (editForm.description) payload.description = editForm.description;
    if (editForm.pilot_id) payload.pilot_id = editForm.pilot_id;
    if (editForm.scheduled_date)
      payload.scheduled_date = new Date(editForm.scheduled_date).toISOString();
    else payload.scheduled_date = null;
    if (editForm.estimated_flight_hours)
      payload.estimated_flight_hours = parseFloat(editForm.estimated_flight_hours);
    if (editForm.required_minimum_rank !== "") {
      payload.required_minimum_rank = parseInt(editForm.required_minimum_rank, 10);
    }

    const { data, error: updateError } = await supabaseClient
      .from("bookings")
      .update(payload)
      .eq("id", bookingId)
      .select(
        "id,customer_id,location_name,description,status,scheduled_date,created_at,pilot_id,location_lat,location_lng,payment_amount,specialization,estimated_flight_hours,required_minimum_rank"
      )
      .single();

    if (updateError) {
      console.error(updateError);
      setEditError(updateError.message);
      setEditSaving(false);
      return;
    }

    setBooking(data as Booking);
    setShowEdit(false);
    setEditSaving(false);
  };

  const handleDelete = async () => {
    if (!bookingId) return;
    const confirmed = window.confirm(
      "Delete this booking? This action cannot be undone."
    );
    if (!confirmed) return;
    setDeleting(true);
    const { error: deleteError } = await supabaseClient
      .from("bookings")
      .delete()
      .eq("id", bookingId);
    setDeleting(false);
    if (deleteError) {
      console.error(deleteError);
      setEditError(deleteError.message);
      return;
    }
    navigate("/bookings");
  };

  if (!bookingId) {
    return <p>Booking not found.</p>;
  }

  if (loading || !booking) {
    return <p>Loading booking...</p>;
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <h1>Booking</h1>
          <p>{booking.location_name}</p>
        </div>
        {role === "admin" && (
          <button
            className="ghost-btn"
            onClick={() => setShowEdit(true)}
            aria-label="Edit booking"
            title="Edit booking"
          >
            Edit
          </button>
        )}
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <section style={{ marginBottom: 24 }}>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>
        <p>
          <strong>Scheduled:</strong>{" "}
          {booking.scheduled_date
            ? new Date(booking.scheduled_date).toLocaleString()
            : "TBD"}
        </p>
        <p>
          <strong>Description:</strong> {booking.description}
        </p>
        <p>
          <strong>Specialization:</strong>{" "}
          {booking.specialization ? booking.specialization : "—"}
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="media-card">
          <h3 style={{ marginTop: 0 }}>Pilots</h3>
          {pilotError && <p style={{ color: "red" }}>{pilotError}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {(booking.specialization === "automotive" && crew.length
              ? crew.sort((a, b) =>
                  a.role === "lead" ? -1 : b.role === "lead" ? 1 : 0,
                )
              : selectedPilot
              ? [
                  {
                    id: selectedPilot,
                    pilot_id: selectedPilot,
                    role: "lead" as const,
                    label:
                      pilotOptions.find((p) => p.id === selectedPilot)?.label ||
                      "Pilot",
                  },
                ]
              : []
            ).map((member) => (
              <div
                key={member.id}
                style={{
                  border: "1px solid #555a66",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: member.role === "lead" ? "#4a5261" : "#3a3f4a",
                  fontWeight: 700,
                }}
              >
                {member.label}{" "}
                <span style={{ color: "#9ca3b5", fontWeight: 600 }}>
                  ({member.role})
                </span>
              </div>
            ))}
            {role === "admin" && (
              <button
                className="ghost-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowPilotPicker(true)}
              >
                ➕ Add pilot
              </button>
            )}
          </div>
          {!selectedPilot &&
            booking.specialization !== "automotive" &&
            !crew.length && (
              <div
                style={{
                  border: "1px solid #555a66",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "#3a3f4a",
                  fontWeight: 700,
                  color: "#9ca3b5",
                  display: "inline-block",
                  marginTop: 8,
                }}
              >
                Unassigned
              </div>
            )}
        </div>
        {role === "admin" && showPilotPicker && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0 }}>Assign Pilot</h3>
                <button
                  className="ghost-btn"
                  onClick={() => setShowPilotPicker(false)}
                  disabled={pilotSaving}
                >
                  Close
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <label className="input-label">Pilot</label>
                <select
                  value={selectedPilot}
                  onChange={(e) => setSelectedPilot(e.target.value)}
                  className="text-input"
                >
                  <option value="">Unassigned</option>
                  {pilotOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={savePilot}
                  disabled={pilotSaving}
                  className="primary-btn"
                  type="button"
                >
                  {pilotSaving ? "Saving..." : "Save pilot"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowPilotPicker(false)}
                  disabled={pilotSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <div className="media-card">
          <h3 style={{ marginTop: 0 }}>Editors</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {selectedEditors.length ? (
              selectedEditors.map((id) => {
                const label =
                  editorOptions.find((opt) => opt.id === id)?.label || "Editor";
                return (
                  <div
                    key={id}
                    style={{
                      border: "1px solid #555a66",
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: "#3a3f4a",
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  border: "1px solid #555a66",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "#3a3f4a",
                  fontWeight: 700,
                  color: "#9ca3b5",
                }}
              >
                Unassigned
              </div>
            )}
            {role === "admin" && (
              <button
                className="ghost-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowEditorPicker(true)}
              >
                ➕ Add editors
              </button>
            )}
          </div>
          {role === "admin" && showEditorPicker && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Assign Editors</h3>
                  <button
                    className="ghost-btn"
                    onClick={() => setShowEditorPicker(false)}
                    disabled={saving}
                  >
                    Close
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {editorOptions.map((option) => (
                    <label
                      key={option.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        border: "1px solid #ddd",
                        padding: "6px 10px",
                        borderRadius: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEditors.includes(option.id)}
                        onChange={() => toggleEditor(option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                  {!editorOptions.length && <p>No editors found.</p>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={saveEditors} disabled={saving}>
                    {saving ? "Saving..." : "Save assignments"}
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setShowEditorPicker(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <BookingMediaManager bookingId={bookingId} uploaderRole="pilot" />

      {showEdit && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Edit Booking</h3>
              <button className="ghost-btn" onClick={() => setShowEdit(false)}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleUpdate}>
              {editError && <div className="alert error">{editError}</div>}

              <label className="input-label">
                Customer ID * (default to UUID of admin@buzzbuzzin.com)
              </label>
              <input
                name="customer_id"
                value={editForm.customer_id}
                onChange={onFormChange}
                className="text-input"
                placeholder="Customer UUID"
                required
              />

              <label className="input-label">Pilot ID (optional)</label>
              <input
                name="pilot_id"
                value={editForm.pilot_id}
                onChange={onFormChange}
                className="text-input"
                placeholder="Pilot UUID"
              />

              <label className="input-label">Specialization *</label>
              <select
                name="specialization"
                value={editForm.specialization}
                onChange={onFormChange}
                className="text-input"
                required
              >
                <option value="">Select specialization</option>
                <option value="automotive">Automotive</option>
                <option value="motion_picture">Motion picture</option>
                <option value="real_estate">Real estate</option>
                <option value="agriculture">Agriculture</option>
                <option value="inspections">Inspections</option>
                <option value="search_rescue">Search & Rescue</option>
                <option value="logistics">Logistics</option>
                <option value="drone_art">Drone art</option>
                <option value="surveillance_security">
                  Surveillance & Security
                </option>
              </select>

              <label className="input-label">Location name *</label>
              <input
                name="location_name"
                value={editForm.location_name}
                onChange={onFormChange}
                className="text-input"
                placeholder="e.g., Downtown Rooftop"
                required
              />

              <label className="input-label">Address (search)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  name="address"
                  value={editForm.address}
                  onChange={onFormChange}
                  className="text-input"
                  placeholder="Type address to fetch coordinates"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="primary-btn"
                  onClick={geocodeAddress}
                  disabled={geocoding}
                >
                  {geocoding ? "Looking..." : "Lookup"}
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map((s, idx) => (
                    <button
                      type="button"
                      key={`${s.title}-${idx}`}
                      className="suggestion-item"
                      onClick={() => selectSuggestion(s)}
                    >
                      <div className="suggestion-title">{s.title}</div>
                      {s.subtitle && (
                        <div className="suggestion-sub">{s.subtitle}</div>
                      )}
                    </button>
                  ))}
                  {suggesting && <div className="suggestion-sub">Loading…</div>}
                </div>
              )}
              <p style={{ margin: "4px 0", color: "#9ca3b5", fontSize: 12 }}>
                Uses OpenStreetMap for address lookup. Coordinates are set
                automatically.
              </p>

              <input
                type="hidden"
                name="location_lat"
                value={editForm.location_lat}
              />
              <input
                type="hidden"
                name="location_lng"
                value={editForm.location_lng}
              />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={editForm.description}
                onChange={onFormChange}
                className="text-input"
                rows={3}
                placeholder="Describe the booking"
              />

              <label className="input-label">Payment amount (USD) *</label>
              <input
                name="payment_amount"
                value={editForm.payment_amount}
                onChange={onFormChange}
                className="text-input"
                type="number"
                step="0.01"
                required
              />

              <label className="input-label">Scheduled date/time</label>
              <input
                name="scheduled_date"
                value={editForm.scheduled_date}
                onChange={onFormChange}
                className="text-input"
                type="datetime-local"
              />

              <label className="input-label">Estimated flight hours</label>
              <input
                name="estimated_flight_hours"
                value={editForm.estimated_flight_hours}
                onChange={onFormChange}
                className="text-input"
                type="number"
                step="0.1"
              />

              <label className="input-label">Required minimum rank *</label>
              <select
                name="required_minimum_rank"
                value={editForm.required_minimum_rank}
                onChange={onFormChange}
                className="text-input"
                required
              >
                {RANK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <label className="input-label">Status</label>
              <select
                name="status"
                value={editForm.status}
                onChange={onFormChange}
                className="text-input"
              >
                <option value="available">Available</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    background: "#b23b3b",
                    color: "#fff",
                    border: "1px solid #c24a4a",
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete booking"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowEdit(false)}
                  disabled={editSaving || deleting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
