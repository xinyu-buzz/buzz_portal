import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabaseClient } from "../../../utility";

const FLIGHT_PLANS_BUCKET = "flight-plans";

type FlightPlan = {
  id: string;
  booking_id: string;
  pilot_id: string;
  pilot_name: string;
  pilot_license_number: string | null;
  call_sign: string;
  drone_manufacturer: string | null;
  drone_model: string | null;
  drone_serial_number: string | null;
  drone_registration_number: string | null;
  takeoff_date_time: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  regulatory_authority: string;
  max_altitude_feet: number;
  airspace_class: string;
  laanc_grid_ceiling: number | null;
  laanc_authorization_status: string;
  flight_over_people: boolean;
  flight_over_people_explanation: string | null;
  vlos_type: string;
  part107_compliant: boolean;
  part107_non_compliance_explanation: string | null;
  requires_waiver: boolean;
  waiver_safety_mitigations: string | null;
  waiver_operational_procedures: string | null;
  waiver_risk_analysis: string | null;
  certification_regulation: string;
  signature_date: string | null;
  pdf_url: string;
  generated_at: string;
  created_at: string;
  pilot_email?: string;
  pilot_call_sign?: string;
};

export const FlightPlanList = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = id || "";
  const [plans, setPlans] = useState<FlightPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FlightPlan | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Extract storage path from full Supabase URL or use as-is if it's just a path
  const extractStoragePath = useCallback((url: string): string => {
    // Check if it's a full Supabase URL
    const publicMatch = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    if (publicMatch) {
      return publicMatch[1];
    }
    const signedMatch = url.match(/\/storage\/v1\/object\/sign\/[^/]+\/(.+)\?/);
    if (signedMatch) {
      return signedMatch[1];
    }
    // If not a full URL, assume it's already a storage path
    return url;
  }, []);

  // Generate signed URL for PDF
  const generateSignedUrl = useCallback(async (pdfUrl: string) => {
    setPdfLoading(true);
    setSignedPdfUrl(null);

    const storagePath = extractStoragePath(pdfUrl);

    const { data, error: signedError } = await supabaseClient.storage
      .from(FLIGHT_PLANS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

    if (signedError) {
      console.error("Error generating signed URL:", signedError);
      setPdfLoading(false);
      return;
    }

    if (data?.signedUrl) {
      setSignedPdfUrl(data.signedUrl);
    }
    setPdfLoading(false);
  }, [extractStoragePath]);

  // When a plan is selected, generate signed URL for its PDF
  useEffect(() => {
    if (selectedPlan?.pdf_url) {
      generateSignedUrl(selectedPlan.pdf_url);
    } else {
      setSignedPdfUrl(null);
    }
  }, [selectedPlan, generateSignedUrl]);

  useEffect(() => {
    if (!bookingId) return;

    const loadFlightPlans = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabaseClient
        .from("flight_plans")
        .select(
          `
          *,
          profiles:pilot_id(email, call_sign)
          `
        )
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error loading flight plans:", fetchError);
        setError("Failed to load flight plans.");
      } else {
        const transformedPlans = (data || []).map((plan: any) => ({
          ...plan,
          pilot_email: plan.profiles?.email,
          pilot_call_sign: plan.profiles?.call_sign,
        }));
        setPlans(transformedPlans);
      }
      setLoading(false);
    };

    loadFlightPlans();
  }, [bookingId]);

  if (!bookingId) {
    return <p>Booking ID not found.</p>;
  }

  if (loading) {
    return (
      <div className="page-card">
        <h1>Flight Plans</h1>
        <p>Loading flight plans...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-card">
        <h1>Flight Plans</h1>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Auto-Approved":
        return "#4a6148";
      case "Pending":
        return "#6a5a48";
      case "Manual FAA Review Required":
      case "No LAANC - Manual Auth Required":
        return "#5a4a61";
      case "Not Permitted Under Part 107":
        return "#614a4a";
      default:
        return "#4a5261";
    }
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Flight Plans</h1>
        <button
          className="ghost-btn"
          onClick={() => window.history.back()}
        >
          ← Back to Booking
        </button>
      </div>

      {plans.length === 0 ? (
        <p style={{ color: "#9ca3b5", marginTop: 16 }}>
          No flight plans have been created for this booking.
        </p>
      ) : (
        <div style={{ marginTop: 24 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                border: "1px solid #555a66",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                background: "#2a2f3a",
                cursor: "pointer",
              }}
              onClick={() => setSelectedPlan(plan)}
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
                    Flight Plan - {plan.pilot_name || plan.pilot_call_sign || plan.pilot_email || "Unknown Pilot"}
                  </h3>
                  <p style={{ margin: 0, color: "#9ca3b5", fontSize: 14 }}>
                    Created: {new Date(plan.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: getStatusColor(plan.laanc_authorization_status),
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {plan.laanc_authorization_status}
                </span>
              </div>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Takeoff:</strong>{" "}
                {new Date(plan.takeoff_date_time).toLocaleString()}
              </p>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Location:</strong> {plan.location}
              </p>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Max Altitude:</strong> {plan.max_altitude_feet} ft AGL
              </p>
              <p style={{ margin: "8px 0", color: "#e8ecf4" }}>
                <strong>Type:</strong> {plan.vlos_type} | <strong>Airspace:</strong> Class {plan.airspace_class}
              </p>
              <button
                className="primary-btn"
                style={{ marginTop: 8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan(plan);
                }}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedPlan && (
        <div className="modal-backdrop" onClick={() => setSelectedPlan(null)} onKeyDown={(e) => { if (e.key === "Escape") setSelectedPlan(null); }}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
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
              <h2 style={{ margin: 0 }}>Flight Plan Details</h2>
              <button className="ghost-btn" onClick={() => setSelectedPlan(null)}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  DOCUMENT
                </h3>
                {pdfLoading && (
                  <p style={{ color: "#9ca3b5" }}>Loading PDF...</p>
                )}
                {!pdfLoading && signedPdfUrl && (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(signedPdfUrl)}&embedded=true`}
                    title="Flight Plan PDF"
                    style={{
                      width: "100%",
                      height: 1000,
                      border: "1px solid #555a66",
                      borderRadius: 8,
                    }}
                  />
                )}
                {!pdfLoading && !signedPdfUrl && selectedPlan.pdf_url && (
                  <p style={{ color: "#ff6b6b" }}>Failed to load PDF document.</p>
                )}
                {signedPdfUrl && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={signedPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ghost-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      Open PDF in New Tab
                    </a>
                  </div>
                )}
                {selectedPlan.signature_date && (
                  <p style={{ marginTop: 8, fontSize: 14, color: "#9ca3b5" }}>
                    Signed on: {new Date(selectedPlan.signature_date).toLocaleString()}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  PILOT INFORMATION
                </h3>
                <p>
                  <strong>Name:</strong> {selectedPlan.pilot_name}
                </p>
                <p>
                  <strong>Callsign:</strong> {selectedPlan.call_sign}
                </p>
                {selectedPlan.pilot_license_number && (
                  <p>
                    <strong>License Number:</strong> {selectedPlan.pilot_license_number}
                  </p>
                )}
                {selectedPlan.pilot_email && (
                  <p>
                    <strong>Email:</strong> {selectedPlan.pilot_email}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  DRONE DETAILS
                </h3>
                {selectedPlan.drone_manufacturer && (
                  <p>
                    <strong>Manufacturer:</strong> {selectedPlan.drone_manufacturer}
                  </p>
                )}
                {selectedPlan.drone_model && (
                  <p>
                    <strong>Model:</strong> {selectedPlan.drone_model}
                  </p>
                )}
                {selectedPlan.drone_serial_number && (
                  <p>
                    <strong>Serial Number:</strong> {selectedPlan.drone_serial_number}
                  </p>
                )}
                {selectedPlan.drone_registration_number && (
                  <p>
                    <strong>Registration Number:</strong> {selectedPlan.drone_registration_number}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  FLIGHT DETAILS
                </h3>
                <p>
                  <strong>Takeoff (Zulu):</strong>{" "}
                  {(() => {
                    const dt = new Date(selectedPlan.takeoff_date_time);
                    const zuluStr = dt.toISOString().replace('T', ' ').substring(0, 16) + 'Z';
                    return zuluStr;
                  })()}
                </p>
                <p>
                  <strong>Takeoff (Local):</strong>{" "}
                  {(() => {
                    const dt = new Date(selectedPlan.takeoff_date_time);
                    const year = dt.getFullYear();
                    const month = String(dt.getMonth() + 1).padStart(2, '0');
                    const day = String(dt.getDate()).padStart(2, '0');
                    const timeStr = dt.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZoneName: 'short'
                    });
                    return `${year}-${month}-${day}, ${timeStr}`;
                  })()}
                </p>
                <p>
                  <strong>Location:</strong> {selectedPlan.location}
                </p>
                {selectedPlan.latitude && selectedPlan.longitude && (
                  <p>
                    <strong>Coordinates:</strong> {selectedPlan.latitude}, {selectedPlan.longitude}
                  </p>
                )}
                <p>
                  <strong>Max Altitude:</strong> {selectedPlan.max_altitude_feet} ft AGL
                </p>
                <p>
                  <strong>Airspace Class:</strong> {selectedPlan.airspace_class}
                </p>
                {selectedPlan.laanc_grid_ceiling && (
                  <p>
                    <strong>Grid Ceiling:</strong> {selectedPlan.laanc_grid_ceiling} ft
                  </p>
                )}
                <p>
                  <strong>VLOS Type:</strong> {selectedPlan.vlos_type}
                </p>
                <p>
                  <strong>Flight Over People:</strong> {selectedPlan.flight_over_people ? "Yes" : "No"}
                </p>
                {selectedPlan.flight_over_people && selectedPlan.flight_over_people_explanation && (
                  <p>
                    <strong>Explanation:</strong> {selectedPlan.flight_over_people_explanation}
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                  REGULATORY COMPLIANCE
                </h3>
                <p>
                  <strong>Regulatory Authority:</strong> {selectedPlan.regulatory_authority}
                </p>
                <p>
                  <strong>Certification Regulation:</strong> {selectedPlan.certification_regulation}
                </p>
                <p>
                  <strong>Authorization Status:</strong>{" "}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: getStatusColor(selectedPlan.laanc_authorization_status),
                      fontSize: 12,
                    }}
                  >
                    {selectedPlan.laanc_authorization_status}
                  </span>
                </p>
                <p>
                  <strong>Civil Regulatory Compliant:</strong> {selectedPlan.part107_compliant ? "Yes" : "No"}
                </p>
                {!selectedPlan.part107_compliant && selectedPlan.part107_non_compliance_explanation && (
                  <p>
                    <strong>Non-Compliance Explanation:</strong> {selectedPlan.part107_non_compliance_explanation}
                  </p>
                )}
                <p>
                  <strong>Requires Waiver:</strong> {selectedPlan.requires_waiver ? "Yes" : "No"}
                </p>
              </section>

              {selectedPlan.requires_waiver && (
                <section>
                  <h3 style={{ marginTop: 0, color: "#9ca3b5", fontSize: 14 }}>
                    WAIVER DETAILS
                  </h3>
                  {selectedPlan.waiver_safety_mitigations && (
                    <p>
                      <strong>Safety Mitigations:</strong> {selectedPlan.waiver_safety_mitigations}
                    </p>
                  )}
                  {selectedPlan.waiver_operational_procedures && (
                    <p>
                      <strong>Operational Procedures:</strong> {selectedPlan.waiver_operational_procedures}
                    </p>
                  )}
                  {selectedPlan.waiver_risk_analysis && (
                    <p>
                      <strong>Risk Analysis:</strong> {selectedPlan.waiver_risk_analysis}
                    </p>
                  )}
                </section>
              )}

              <section style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, color: "#9ca3b5" }}>
                  <strong>Generated:</strong>{" "}
                  {new Date(selectedPlan.generated_at).toLocaleString()}
                </p>
                <p style={{ fontSize: 12, color: "#9ca3b5" }}>
                  <strong>Created:</strong>{" "}
                  {new Date(selectedPlan.created_at).toLocaleString()}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
