import { useEffect, useState } from "react";
import { useNavigation } from "@refinedev/core";
import { supabaseClient } from "../../utility";

type BookingRow = {
  id: string;
  location_name: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  description: string;
};

const DEFAULT_CUSTOMER_ID = "4374b3b2-4a28-4a3e-beec-5729b1d779fb";
const RANK_OPTIONS = [
  { value: "0", label: "Ensign" },
  { value: "1", label: "Sub Lieutenant" },
  { value: "2", label: "Lieutenant" },
  { value: "3", label: "Commander" },
  { value: "4", label: "Captain" },
];

export const BookingList = () => {
  const { show } = useNavigation();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { title: string; subtitle?: string; latitude: number; longitude: number }[]
  >([]);
  const [suggesting, setSuggesting] = useState(false);
  const [form, setForm] = useState({
    customer_id: DEFAULT_CUSTOMER_ID,
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
    const load = async () => {
      setLoading(true);
      const storedRole = localStorage.getItem("buzz_portal_role");
      setRole(storedRole);

      if (storedRole === "pilot") {
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData?.user) {
          console.error("No user session", userError);
          setRows([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabaseClient
          .from("bookings")
          .select(
            "id,location_name,status,scheduled_date,created_at,description"
          )
          .eq("pilot_id", userData.user.id)
          .eq("status", "accepted")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Failed to load bookings", error);
        } else {
          setRows(data || []);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabaseClient
        .from("bookings")
        .select("id,location_name,status,scheduled_date,created_at,description")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Failed to load bookings", error);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    load();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!form.address || form.address.length < 3) {
        setSuggestions([]);
        return;
      }
      setSuggesting(true);
      try {
        // Use OpenStreetMap Nominatim for free geocoding (no API key needed)
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            form.address
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
              title: place.name || place.display_name?.split(",")[0] || form.address,
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
    const t = setTimeout(fetchSuggestions, 400); // Slightly longer delay for Nominatim rate limiting
    return () => clearTimeout(t);
  }, [form.address]);

  const selectSuggestion = (s: {
    title: string;
    subtitle?: string;
    latitude: number;
    longitude: number;
  }) => {
    setForm((prev) => ({
      ...prev,
      address: s.subtitle || s.title,
      location_lat: s.latitude.toString(),
      location_lng: s.longitude.toString(),
      location_name: prev.location_name || s.title,
    }));
    setSuggestions([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateError(null);

    if (
      !form.customer_id ||
      !form.location_name ||
      !form.location_lat ||
      !form.location_lng ||
      !form.payment_amount ||
      !form.specialization ||
      form.required_minimum_rank === ""
    ) {
      setCreateError("Please fill all required fields.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, any> = {
      customer_id: form.customer_id,
      location_name: form.location_name,
      location_lat: parseFloat(form.location_lat),
      location_lng: parseFloat(form.location_lng),
      specialization: form.specialization,
      payment_amount: parseFloat(form.payment_amount),
      status: form.status || "available",
    };

    if (form.description) payload.description = form.description;
    if (form.pilot_id) payload.pilot_id = form.pilot_id;
    if (form.scheduled_date) payload.scheduled_date = new Date(form.scheduled_date).toISOString();
    if (form.estimated_flight_hours) payload.estimated_flight_hours = parseFloat(form.estimated_flight_hours);
    if (form.required_minimum_rank !== "") {
      payload.required_minimum_rank = parseInt(form.required_minimum_rank, 10);
    }

    const { error } = await supabaseClient.from("bookings").insert(payload);
    if (error) {
      console.error(error);
      setCreateError(error.message);
      setSubmitting(false);
      return;
    }

    // refresh list
    setShowCreate(false);
    setSubmitting(false);
    setForm({
      customer_id: DEFAULT_CUSTOMER_ID,
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
    // reload bookings
    setLoading(true);
    const storedRole = localStorage.getItem("buzz_portal_role");
    if (storedRole === "pilot") {
      const { data: userData } = await supabaseClient.auth.getUser();
      const { data } = await supabaseClient
        .from("bookings")
        .select("id,location_name,status,scheduled_date,created_at,description")
        .eq("pilot_id", userData?.user?.id || "")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows(data || []);
    } else {
      const { data } = await supabaseClient
        .from("bookings")
        .select("id,location_name,status,scheduled_date,created_at,description")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows(data || []);
    }
    setLoading(false);
  };

  const geocodeAddress = async () => {
    if (!form.address) {
      setCreateError("Enter an address to look up coordinates.");
      return;
    }
    setGeocoding(true);
    setCreateError(null);
    try {
      // Use OpenStreetMap Nominatim for free geocoding (no API key needed)
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          form.address
        )}&limit=1&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (!resp.ok) {
        setCreateError("Geocoding failed. Please try again.");
        setGeocoding(false);
        return;
      }
      const data = await resp.json();
      if (data.length > 0 && data[0].lat && data[0].lon) {
        setForm((prev) => ({
          ...prev,
          location_lat: data[0].lat,
          location_lng: data[0].lon,
        }));
      } else {
        setCreateError("No coordinates found for that address.");
      }
    } catch (err) {
      console.error(err);
      setCreateError("Geocoding error. See console for details.");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Bookings</h1>
        <p>
          {role === "pilot"
            ? "Click booking to upload your drone videos."
            : "Assign editors and manage media per booking."}
        </p>
        {role === "admin" && (
          <button className="primary-btn" onClick={() => setShowCreate(true)}>
            + New booking
          </button>
        )}
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.location_name}</td>
                <td>{row.status}</td>
                <td>
                  {row.scheduled_date
                    ? new Date(row.scheduled_date).toLocaleString()
                    : "—"}
                </td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => show("bookings", row.id)}>Open</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>
                  No bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Create Booking</h3>
              <button className="ghost-btn" onClick={() => setShowCreate(false)}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleCreate}>
              {createError && <div className="alert error">{createError}</div>}
              <label className="input-label">Customer ID * (default to UUID of admin@buzzbuzzin.com)</label>
              <input
                name="customer_id"
                value={form.customer_id}
                onChange={onChange}
                className="text-input"
                placeholder="Customer UUID"
                required
              />

              <label className="input-label">Pilot ID (optional)</label>
              <input
                name="pilot_id"
                value={form.pilot_id}
                onChange={onChange}
                className="text-input"
                placeholder="Pilot UUID"
              />

              <label className="input-label">Specialization *</label>
              <select
                name="specialization"
                value={form.specialization}
                onChange={onChange}
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
                <option value="surveillance_security">Surveillance & Security</option>
              </select>

              <label className="input-label">Location name *</label>
              <input
                name="location_name"
                value={form.location_name}
                onChange={onChange}
                className="text-input"
                placeholder="e.g., Downtown Rooftop"
                required
              />

              <label className="input-label">Address (search)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  name="address"
                  value={form.address}
                  onChange={onChange}
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
                Uses OpenStreetMap for address lookup. Coordinates are set automatically.
              </p>

              <input type="hidden" name="location_lat" value={form.location_lat} />
              <input type="hidden" name="location_lng" value={form.location_lng} />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                className="text-input"
                rows={3}
                placeholder="Describe the booking"
              />

              <label className="input-label">Payment amount (USD) *</label>
              <input
                name="payment_amount"
                value={form.payment_amount}
                onChange={onChange}
                className="text-input"
                type="number"
                step="0.01"
                required
              />

              <label className="input-label">Scheduled date/time</label>
              <input
                name="scheduled_date"
                value={form.scheduled_date}
                onChange={onChange}
                className="text-input"
                type="datetime-local"
              />

              <label className="input-label">Estimated flight hours</label>
              <input
                name="estimated_flight_hours"
                value={form.estimated_flight_hours}
                onChange={onChange}
                className="text-input"
                type="number"
                step="0.1"
              />

              <label className="input-label">Required minimum rank *</label>
              <select
                name="required_minimum_rank"
                value={form.required_minimum_rank}
                onChange={onChange}
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
              <select name="status" value={form.status} onChange={onChange} className="text-input">
                <option value="available">Available</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Creating..." : "Create booking"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowCreate(false)}
                  disabled={submitting}
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
