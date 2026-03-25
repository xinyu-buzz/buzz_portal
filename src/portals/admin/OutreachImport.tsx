import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type PreviewRow = Record<string, string>;

type ImportBatch = {
  id: string;
  file_name: string;
  total_rows: number | null;
  imported_rows: number | null;
  duplicate_rows: number | null;
  skipped_rows: number | null;
  status: string;
  created_at: string;
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export const OutreachImport: FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [faaBasicFile, setFaaBasicFile] = useState<File | null>(null);
  const [faaCertFile, setFaaCertFile] = useState<File | null>(null);
  const [faaProcessing, setFaaProcessing] = useState(false);
  const [faaProgress, setFaaProgress] = useState("");

  const targetFields = ["Name", "City", "State", "Zip", "Certificate Type"];

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    const { data, error } = await supabaseClient
      .from("outreach_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load import batches", error);
    } else {
      setBatches(data || []);
    }
    setLoadingBatches(false);
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleFaaImport = async () => {
    if (!faaBasicFile || !faaCertFile) return;

    setFaaProcessing(true);
    setImportError(null);
    setImportResult(null);

    try {
      // Step 1: Read both CSV files
      setFaaProgress("Reading PILOT_BASIC.csv...");
      const basicText = await faaBasicFile.text();

      setFaaProgress("Reading PILOT_CERT.csv...");
      const certText = await faaCertFile.text();

      // Step 2: Parse PILOT_CERT to find Remote Pilot IDs (Type 'U')
      setFaaProgress("Filtering Part 107 Remote Pilots...");
      const certLines = certText.split(/\r?\n/).filter((l: string) => l.trim());
      const certHeaders = parseCSV(certLines[0] || "").headers;

      // Find cert column indices
      const findIdx = (headers: string[], ...names: string[]) =>
        headers.findIndex((h) => names.some((n) => h.toUpperCase().trim().includes(n.toUpperCase())));

      const certUidIdx = findIdx(certHeaders, "UNIQUE ID", "UNIQUE_ID");
      // FAA uses just "TYPE" for certificate type, not "CERTIFICATE TYPE"
      let certTypeIdx = findIdx(certHeaders, "CERTIFICATE TYPE", "CERTIFICATE_TYPE");
      if (certTypeIdx === -1) {
        // Exact match on "TYPE" to avoid matching "TYPERATING1" etc.
        certTypeIdx = certHeaders.findIndex((h) => h.trim().toUpperCase() === "TYPE");
      }
      let certLevelIdx = findIdx(certHeaders, "CERTIFICATE LEVEL", "CERTIFICATE_LEVEL");
      if (certLevelIdx === -1) {
        certLevelIdx = certHeaders.findIndex((h) => h.trim().toUpperCase() === "LEVEL");
      }
      // FAA splits ratings into RATING1-RATING11; collect first one
      let ratingsIdx = findIdx(certHeaders, "RATINGS");
      if (ratingsIdx === -1) {
        ratingsIdx = certHeaders.findIndex((h) => h.trim().toUpperCase() === "RATING1");
      }
      const certExpIdx = findIdx(certHeaders, "EXPIRE DATE", "CERTIFICATE EXPIRE");

      if (certUidIdx === -1 || certTypeIdx === -1) {
        throw new Error(`Cannot find UNIQUE ID or TYPE columns in PILOT_CERT.csv. Found headers: ${certHeaders.slice(0, 10).join(", ")}...`);
      }

      // Find all RATING columns (RATING1-RATING11) for combining
      const ratingIndices: number[] = [];
      certHeaders.forEach((h, idx) => {
        const upper = h.trim().toUpperCase();
        if (upper.match(/^RATING\d+$/)) ratingIndices.push(idx);
      });

      const remotePilotMap = new Map<string, { level: string; ratings: string; expireDate: string }>();

      for (let i = 1; i < certLines.length; i++) {
        const fields = parseCSV(certLines[i]).headers; // reuse parser for single line
        const certType = (fields[certTypeIdx] || "").trim().toUpperCase();
        if (certType === "U") {
          const uid = (fields[certUidIdx] || "").trim();
          if (uid) {
            // Combine all RATING columns into one string
            const allRatings = ratingIndices.length > 0
              ? ratingIndices.map((idx) => (fields[idx] || "").trim()).filter(Boolean).join(", ")
              : ratingsIdx >= 0 ? (fields[ratingsIdx] || "").trim() : "";
            remotePilotMap.set(uid, {
              level: certLevelIdx >= 0 ? (fields[certLevelIdx] || "").trim() : "",
              ratings: allRatings,
              expireDate: certExpIdx >= 0 ? (fields[certExpIdx] || "").trim() : "",
            });
          }
        }
      }

      setFaaProgress(`Found ${remotePilotMap.size} Remote Pilot certificates. Joining with address data...`);

      // Step 3: Parse PILOT_BASIC and join with Remote Pilots
      const basicLines = basicText.split(/\r?\n/).filter((l: string) => l.trim());
      const basicHeaders = parseCSV(basicLines[0] || "").headers;

      const bUidIdx = findIdx(basicHeaders, "UNIQUE ID", "UNIQUE_ID");
      const bFirstIdx = findIdx(basicHeaders, "FIRST NAME", "FIRST & MIDDLE");
      const bLastIdx = findIdx(basicHeaders, "LAST NAME", "LAST NAME & SUFFIX");
      const bCityIdx = findIdx(basicHeaders, "CITY");
      const bStateIdx = findIdx(basicHeaders, "STATE");
      const bZipIdx = findIdx(basicHeaders, "ZIP CODE", "ZIP_CODE", "ZIP");
      const bCountryIdx = findIdx(basicHeaders, "COUNTRY", "COUNTRY-NAME");

      if (bUidIdx === -1) throw new Error("Cannot find UNIQUE ID column in PILOT_BASIC.csv");

      // Build CSV content for the edge function (only Remote Pilots)
      const csvRows: string[] = [];
      csvRows.push("FIRST NAME,LAST NAME,CITY,STATE,ZIP,CERTIFICATE TYPE,CERTIFICATE NUMBER,RATINGS,CERTIFICATE DATE");

      let skippedCount = 0;

      for (let i = 1; i < basicLines.length; i++) {
        const fields = parseCSV(basicLines[i]).headers;
        const uid = (fields[bUidIdx] || "").trim();
        const certInfo = remotePilotMap.get(uid);
        if (!certInfo) continue;

        const firstName = bFirstIdx >= 0 ? (fields[bFirstIdx] || "").trim() : "";
        const lastName = bLastIdx >= 0 ? (fields[bLastIdx] || "").trim() : "";
        const city = bCityIdx >= 0 ? (fields[bCityIdx] || "").trim() : "";
        const state = bStateIdx >= 0 ? (fields[bStateIdx] || "").trim() : "";
        const zip = bZipIdx >= 0 ? (fields[bZipIdx] || "").trim() : "";
        const country = bCountryIdx >= 0 ? (fields[bCountryIdx] || "").trim() : "";

        if (!state || (country && !country.toUpperCase().includes("US"))) { skippedCount++; continue; }
        if (!firstName && !lastName) { skippedCount++; continue; }

        const escapeCsv = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        csvRows.push([firstName, lastName, city, state, zip, "U", uid, certInfo.ratings, certInfo.expireDate].map(escapeCsv).join(","));
      }

      const totalPilots = csvRows.length - 1;
      setFaaProgress(`Matched ${totalPilots} US Remote Pilots (skipped ${skippedCount} non-US). Uploading in chunks...`);

      // Step 4: Send in chunks of 5000 rows to avoid Edge Function memory limits
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data: batch, error: batchError } = await supabaseClient
        .from("outreach_import_batches")
        .insert({
          file_name: `FAA Part 107 (${faaBasicFile.name} + ${faaCertFile.name})`,
          total_rows: totalPilots,
          status: "processing",
          imported_by: userId,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const CHUNK_SIZE = 5000;
      const header = csvRows[0];
      const dataRows = csvRows.slice(1);
      let totalImported = 0;
      let totalDuplicates = 0;
      let chunkErrors: string[] = [];

      for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
        const chunkRows = dataRows.slice(i, i + CHUNK_SIZE);
        const chunkCsv = [header, ...chunkRows].join("\n");
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(dataRows.length / CHUNK_SIZE);

        setFaaProgress(`Uploading chunk ${chunkNum}/${totalChunks} (${Math.min(i + CHUNK_SIZE, dataRows.length)}/${dataRows.length} pilots)...`);

        try {
          const { data, error } = await supabaseClient.functions.invoke(
            "outreach-parse-csv",
            { body: { batch_id: batch.id, csv_content: chunkCsv } }
          );

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          totalImported += data?.imported ?? 0;
          totalDuplicates += data?.duplicates ?? 0;
        } catch (chunkErr: any) {
          console.error(`Chunk ${chunkNum} failed:`, chunkErr);
          chunkErrors.push(`Chunk ${chunkNum}: ${chunkErr.message}`);
        }
      }

      // Update batch with final totals
      await supabaseClient
        .from("outreach_import_batches")
        .update({
          status: chunkErrors.length === 0 ? "completed" : "failed",
          imported_rows: totalImported,
          duplicate_rows: totalDuplicates,
          skipped_rows: skippedCount,
          error_message:
            chunkErrors.length > 0 ? chunkErrors.join(" | ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      const errorNote = chunkErrors.length > 0 ? ` (${chunkErrors.length} chunks had errors)` : "";
      setImportResult(
        `FAA import complete! ${totalImported} Remote Pilots imported, ${totalDuplicates} duplicates, ${skippedCount} non-US skipped. Total Part 107 in FAA: ${remotePilotMap.size}.${errorNote}`
      );

      setFaaBasicFile(null);
      setFaaCertFile(null);
      loadBatches();
    } catch (err: any) {
      console.error("FAA import failed", err);
      setImportError(err?.message || "FAA import failed. Please try again.");
    } finally {
      setFaaProcessing(false);
      setFaaProgress("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);

      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setTotalRows(rows.length);

      const preview = rows.slice(0, 10).map((row) => {
        const obj: PreviewRow = {};
        h.forEach((header, idx) => {
          obj[header] = row[idx] || "";
        });
        return obj;
      });
      setPreviewRows(preview);

      // Auto-map columns by name similarity
      const autoMap: Record<string, string> = {};
      for (const field of targetFields) {
        const lower = field.toLowerCase();
        const match = h.find(
          (col) =>
            col.toLowerCase() === lower ||
            col.toLowerCase().replace(/[_\s-]/g, "").includes(lower.replace(/\s/g, ""))
        );
        if (match) {
          autoMap[field] = match;
        }
      }
      setColumnMap(autoMap);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      // Create batch record
      const { data: batch, error: batchError } = await supabaseClient
        .from("outreach_import_batches")
        .insert({
          file_name: fileName,
          total_rows: totalRows,
          status: "processing",
          imported_by: userId,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Call edge function to parse and import
      const { data, error } = await supabaseClient.functions.invoke(
        "outreach-parse-csv",
        {
          body: {
            batch_id: batch.id,
            csv_content: csvContent,
            column_mapping: columnMap,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setImportResult(
        `Import complete. ${data?.imported ?? 0} imported, ${data?.duplicates ?? 0} duplicates, ${data?.skipped ?? 0} skipped.`
      );

      // Reset form
      setCsvContent(null);
      setFileName(null);
      setHeaders([]);
      setPreviewRows([]);
      setTotalRows(0);
      setColumnMap({});

      // Refresh batches
      loadBatches();
    } catch (err: any) {
      console.error("Import failed", err);
      setImportError(err?.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      processing: "#c9a227",
      completed: "#4a7c59",
      failed: "#b04040",
      pending: "#6b8cae",
    };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "capitalize",
          background: colors[status] || "#555",
          color: "#fff",
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="page-header">
          <div>
            <h1>Import FAA Data</h1>
            <p className="muted-text">
              Fetch Part 107 Remote Pilot data directly from the FAA, or upload a CSV manually
            </p>
          </div>
        </div>

        {importResult && (
          <div className="alert success" style={{ marginTop: "16px" }}>{importResult}</div>
        )}
        {importError && (
          <div className="alert error" style={{ marginTop: "16px" }}>{importError}</div>
        )}

        {/* FAA Import section */}
        <div className="faa-fetch-section" style={{ marginTop: "20px" }}>
          <h3 style={{ margin: "0 0 8px" }}>Import from FAA Registry</h3>
          <p className="muted-text" style={{ margin: "0 0 12px", fontSize: "13px" }}>
            <strong>Step 1:</strong> Download the latest FAA Airmen CSV database from{" "}
            <a
              href="https://www.faa.gov/licenses_certificates/airmen_certification/releasable_airmen_download"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              FAA Registry
            </a>{" "}
            (choose "Comma Separated" format). Unzip the file.
          </p>
          <p className="muted-text" style={{ margin: "0 0 12px", fontSize: "13px" }}>
            <strong>Step 2:</strong> Upload the two pilot CSV files below. The system will automatically
            find all Part 107 Remote Pilots and import them.
          </p>

          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label className="input-label" htmlFor="faa-basic">PILOT_BASIC.csv</label>
              <input
                id="faa-basic"
                type="file"
                accept=".csv,.txt"
                className="text-input"
                style={{ padding: "8px" }}
                onChange={(e) => setFaaBasicFile(e.target.files?.[0] || null)}
                disabled={faaProcessing}
              />
              {faaBasicFile && <span className="muted-text" style={{ fontSize: "12px" }}>{faaBasicFile.name} ({(faaBasicFile.size / 1024 / 1024).toFixed(1)} MB)</span>}
            </div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label className="input-label" htmlFor="faa-cert">PILOT_CERT.csv</label>
              <input
                id="faa-cert"
                type="file"
                accept=".csv,.txt"
                className="text-input"
                style={{ padding: "8px" }}
                onChange={(e) => setFaaCertFile(e.target.files?.[0] || null)}
                disabled={faaProcessing}
              />
              {faaCertFile && <span className="muted-text" style={{ fontSize: "12px" }}>{faaCertFile.name} ({(faaCertFile.size / 1024 / 1024).toFixed(1)} MB)</span>}
            </div>
          </div>

          {faaProgress && (
            <div className="muted-text" style={{ marginBottom: "12px", fontSize: "13px" }}>
              {faaProgress}
            </div>
          )}

          <button
            className="primary-btn"
            onClick={handleFaaImport}
            disabled={!faaBasicFile || !faaCertFile || faaProcessing || importing}
          >
            {faaProcessing ? "Processing..." : "Import Part 107 Remote Pilots"}
          </button>
        </div>

        <div style={{ margin: "24px 0", borderTop: "1px solid var(--border)", position: "relative" }}>
          <span style={{
            position: "absolute",
            top: "-10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--card)",
            padding: "0 12px",
            color: "var(--muted)",
            fontSize: "13px",
          }}>
            or upload manually
          </span>
        </div>

        {/* File upload area */}
        <div className="upload-zone" style={{ marginTop: "20px" }}>
          <label className="drop-zone" htmlFor="csv-upload">
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <div className="drop-zone__content">
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>+</div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {fileName ? fileName : "Click to select a CSV file"}
              </p>
              <p className="muted-text" style={{ margin: "4px 0 0" }}>
                {fileName
                  ? `${totalRows.toLocaleString()} rows detected`
                  : "Accepts .csv files"}
              </p>
            </div>
          </label>
        </div>

        {/* Column mapping */}
        {headers.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Column Mapping</h2>
            <div className="mapping-grid">
              {targetFields.map((field) => (
                <div key={field} className="mapping-row">
                  <label className="input-label" htmlFor={`map-${field}`}>
                    {field}
                  </label>
                  <select
                    id={`map-${field}`}
                    className="text-input"
                    value={columnMap[field] || ""}
                    onChange={(e) =>
                      setColumnMap((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                  >
                    <option value="">— Select column —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview table */}
        {previewRows.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>
              Preview (first {previewRows.length} rows)
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      {headers.map((h) => (
                        <td key={h}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import button */}
        {csvContent && (
          <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
            <button
              className="primary-btn"
              onClick={handleImport}
              disabled={importing || !csvContent}
            >
              {importing ? "Importing..." : `Import ${totalRows.toLocaleString()} rows`}
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                setCsvContent(null);
                setFileName(null);
                setHeaders([]);
                setPreviewRows([]);
                setTotalRows(0);
                setColumnMap({});
                setImportResult(null);
                setImportError(null);
              }}
            >
              Clear
            </button>
          </div>
        )}

        {importResult && (
          <div className="alert success" style={{ marginTop: "12px" }}>
            {importResult}
          </div>
        )}
        {importError && (
          <div className="alert error" style={{ marginTop: "12px" }}>
            {importError}
          </div>
        )}
      </div>

      {/* Import History */}
      <div className="page-card" style={{ marginTop: "24px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Import History</h2>
        {loadingBatches ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "24px 0" }}>
            Loading import history...
          </p>
        ) : batches.length === 0 ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "24px 0" }}>
            No imports yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Total Rows</th>
                <th>Imported</th>
                <th>Duplicates</th>
                <th>Skipped</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.file_name || "—"}</td>
                  <td>{batch.total_rows?.toLocaleString() ?? "—"}</td>
                  <td>{batch.imported_rows?.toLocaleString() ?? "—"}</td>
                  <td>{batch.duplicate_rows?.toLocaleString() ?? "—"}</td>
                  <td>{batch.skipped_rows?.toLocaleString() ?? "—"}</td>
                  <td>{statusBadge(batch.status)}</td>
                  <td>{formatDate(batch.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .drop-zone {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed var(--border);
          border-radius: 12px;
          padding: 40px 24px;
          cursor: pointer;
          transition: border-color 200ms ease, background 200ms ease;
          background: transparent;
        }

        .drop-zone:hover {
          border-color: var(--accent);
          background: rgba(255, 165, 0, 0.04);
        }

        .drop-zone__content {
          text-align: center;
          color: var(--text);
        }

        .mapping-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .mapping-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mapping-row select {
          appearance: auto;
        }
      `}</style>
    </div>
  );
};
