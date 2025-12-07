import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { supabaseClient } from "../../utility";
import { BookingMediaManager } from "../../components/BookingMediaManager";

type Booking = {
  id: string;
  location_name: string;
  description: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  pilot_id: string | null;
};

type EditorOption = {
  id: string;
  label: string;
};

export const BookingShow = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = useMemo(() => id || "", [id]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [editorOptions, setEditorOptions] = useState<EditorOption[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<string[]>([]);
  const [initialEditors, setInitialEditors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const loadBooking = async () => {
      setLoading(true);
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from("bookings")
        .select(
          "id,location_name,description,status,scheduled_date,created_at,pilot_id"
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
        setEditorOptions(
          (optionsData || []).map((p) => ({
            id: p.id as string,
            label:
              [p.first_name, p.last_name].filter(Boolean).join(" ") ||
              (p.email as string),
          }))
        );
      }
      setLoading(false);
    };

    loadBooking();
  }, [bookingId]);

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
    } else {
      setError(saveError);
    }

    setSaving(false);
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
        <h1>Booking</h1>
        <p>{booking.location_name}</p>
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
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Editors</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
        <div style={{ marginTop: 12 }}>
          <button onClick={saveEditors} disabled={saving}>
            {saving ? "Saving..." : "Save assignments"}
          </button>
        </div>
      </section>

      <BookingMediaManager bookingId={bookingId} uploaderRole="pilot" />
    </div>
  );
};
