import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabaseClient } from "../../../utility";

type IncidentLog = {
  id: string;
  booking_id: string;
  pilot_id: string;
  name: string;
  phone_number: string;
  date_of_incident: string;
  date_of_report: string;
  job_title: string | null;
  operation_name: string | null;
  organization: string | null;
  pic: string | null;
  region: string | null;
  airspace_class: string | null;
  reported_to_police: boolean;
  reported_to_atc: boolean;
  location_of_incident: string;
  description_of_incident: string;
  name_of_witness: string | null;
  signature_data: string;
  signature_date: string;
  created_at: string;
  is_locked: boolean;
  pilot_email?: string;
  pilot_call_sign?: string;
};

export const IncidentLogList = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = id || "";
  const [logs, setLogs] = useState<IncidentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<IncidentLog | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const loadIncidentLogs = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabaseClient
        .from("incident_logs")
        .select(
          `
          *,
          profiles:pilot_id(email, call_sign)
          `
        )
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error loading incident logs:", fetchError);
        setError("Failed to load incident logs.");
      } else {
        const transformedLogs = (data || []).map((log: any) => ({
          ...log,
          pilot_email: log.profiles?.email,
          pilot_call_sign: log.profiles?.call_sign,
        }));
        setLogs(transformedLogs);
      }
      setLoading(false);
    };

    loadIncidentLogs();
  }, [bookingId]);

  if (!bookingId) {
    return <p>Booking ID not found.</p>;
  }

  if (loading) {
    return (
      <div className="page-card">
        <h1>Incident Logs</h1>
        <p>Loading incident logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-card">
        <h1>Incident Logs</h1>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Incident Logs</h1>
        <button
          className="ghost-btn"
          onClick={() => window.history.back()}
        >
          ← Back to Booking
        </button>
      </div>

      {logs.length === 0 ? (
        <p style={{ color: "#9ca3b5", marginTop: 16 }}>
          No incident logs have been submitted for this booking.
        </p>
      ) : (
        <div style={{ marginTop: 24 }}>
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                border: "1px solid #555a66",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                background: "#2a2f3a",
                cursor: "pointer",
              }}
              onClick={() => setSelectedLog(log)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, marginBottom: 4 }}>
                    Incident Report by {log.pilot_call_sign || log.pilot_email || "Unknown"}
                  </h3>
                  <p style={{ margin: 0, color: "#9ca3b5", fontSize: 14 }}>
                    Submitted: {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: log.is_locked ? "#4a5261" : "#5a4a61",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {log.is_locked ? "Locked" : "Draft"}
                </span>
              </div>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Incident Date:</strong>{" "}
                {new Date(log.date_of_incident).toLocaleString()}
              </p>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Location:</strong> {log.location_of_incident}
              </p>
              <p
                style={{
                  margin: "8px 0",
                  color: "#9ca3b5",
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {log.description_of_incident}
              </p>
              <button
                className="primary-btn"
                style={{ marginTop: 8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLog(log);
                }}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 800, maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0 }}>Incident Log Details</h2>
              <button className="ghost-btn" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  REPORTER INFORMATION
                </h3>
                <p>
                  <strong>Name:</strong> {selectedLog.name}
                </p>
                <p>
                  <strong>Phone:</strong> {selectedLog.phone_number}
                </p>
                <p>
                  <strong>Pilot:</strong>{" "}
                  {selectedLog.pilot_call_sign || selectedLog.pilot_email || "Unknown"}
                </p>
                {selectedLog.job_title && (
                  <p>
                    <strong>Job Title:</strong> {selectedLog.job_title}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  INCIDENT DETAILS
                </h3>
                <p>
                  <strong>Date of Incident:</strong>{" "}
                  {new Date(selectedLog.date_of_incident).toLocaleString()}
                </p>
                <p>
                  <strong>Date of Report:</strong>{" "}
                  {new Date(selectedLog.date_of_report).toLocaleString()}
                </p>
                <p>
                  <strong>Location:</strong> {selectedLog.location_of_incident}
                </p>
                {selectedLog.operation_name && (
                  <p>
                    <strong>Operation Name:</strong> {selectedLog.operation_name}
                  </p>
                )}
                {selectedLog.organization && (
                  <p>
                    <strong>Organization:</strong> {selectedLog.organization}
                  </p>
                )}
                {selectedLog.pic && (
                  <p>
                    <strong>PIC:</strong> {selectedLog.pic}
                  </p>
                )}
                {selectedLog.region && (
                  <p>
                    <strong>Region:</strong> {selectedLog.region}
                  </p>
                )}
                {selectedLog.airspace_class && (
                  <p>
                    <strong>Airspace Class:</strong> {selectedLog.airspace_class}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  REPORTING
                </h3>
                <p>
                  <strong>Reported to Police:</strong>{" "}
                  {selectedLog.reported_to_police ? "Yes" : "No"}
                </p>
                <p>
                  <strong>Reported to ATC:</strong>{" "}
                  {selectedLog.reported_to_atc ? "Yes" : "No"}
                </p>
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  DESCRIPTION
                </h3>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {selectedLog.description_of_incident}
                </p>
              </section>

              {selectedLog.name_of_witness && (
                <section>
                  <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                    WITNESS
                  </h3>
                  <p>
                    <strong>Witness Name:</strong> {selectedLog.name_of_witness}
                  </p>
                </section>
              )}

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  SIGNATURE
                </h3>
                {selectedLog.signature_data && (
                  <div
                    style={{
                      border: "1px solid #555a66",
                      borderRadius: 8,
                      padding: 8,
                      background: "#fff",
                    }}
                  >
                    <img
                      src={selectedLog.signature_data}
                      alt="Signature"
                      style={{ maxWidth: "100%", height: "auto" }}
                    />
                  </div>
                )}
                <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3b5" }}>
                  Signed on: {new Date(selectedLog.signature_date).toLocaleString()}
                </p>
              </section>

              <section style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: "#9ca3b5" }}>
                  <strong>Status:</strong> {selectedLog.is_locked ? "Locked" : "Draft"}
                </p>
                <p style={{ fontSize: 12, color: "#9ca3b5" }}>
                  <strong>Created:</strong>{" "}
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

