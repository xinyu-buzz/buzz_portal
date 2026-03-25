import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HIGH_ACTIVITY_STATES = [
  "CA",
  "TX",
  "FL",
  "NY",
  "AZ",
  "CO",
  "WA",
  "GA",
  "NC",
  "OH",
];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function findColumnIndex(
  headers: string[],
  ...keywords: string[]
): number {
  return headers.findIndex((h) => {
    const upper = h.toUpperCase();
    return keywords.every((kw) => upper.includes(kw.toUpperCase()));
  });
}

function parseName(raw: string): { first: string; last: string } {
  if (!raw) return { first: "", last: "" };
  // Handle "LASTNAME, FIRSTNAME MIDDLE" format
  if (raw.includes(",")) {
    const [last, rest] = raw.split(",", 2);
    const first = (rest || "").trim().split(/\s+/)[0] || "";
    return { first: first.trim(), last: last.trim() };
  }
  // Handle "FIRSTNAME LASTNAME" format
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  return { first: raw.trim(), last: "" };
}

function isRemotePilot(value: string): boolean {
  if (!value) return false;
  const upper = value.toUpperCase().trim();
  // Certificate Type 'U' = Remote Pilot in FAA data
  // Also handle combined values like "U U" from duplicate column matching
  return upper === "U" || upper.split(/\s+/).includes("U") || upper.includes("REMOTE PILOT") || upper.includes("PART 107") || upper.includes("REM PILOT");
}

function generateFaaHash(
  lastName: string,
  firstName: string,
  city: string,
  state: string,
  zip: string
): string {
  const raw = `${lastName}|${firstName}|${city}|${state}|${zip}`.toLowerCase();
  return btoa(raw);
}

function isWithinLastTwoYears(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return date >= twoYearsAgo;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    )!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { batch_id, csv_content, column_mapping } = await req.json();

    if (!batch_id || !csv_content) {
      return new Response(
        JSON.stringify({ error: "batch_id and csv_content are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse CSV lines
    const lines = csv_content
      .split(/\r?\n/)
      .filter((line: string) => line.trim().length > 0);

    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have a header row and at least one data row" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const normalizedColumnMapping =
      column_mapping && typeof column_mapping === "object"
        ? (column_mapping as Record<string, string>)
        : {};

    const findMappedColumnIndex = (targetField: string): number => {
      const mappedHeader = normalizedColumnMapping[targetField];
      if (!mappedHeader) return -1;

      return headers.findIndex(
        (header) =>
          header.trim().toUpperCase() === mappedHeader.trim().toUpperCase()
      );
    };

    // Flexibly map columns
    const firstNameIdx = findColumnIndex(headers, "FIRST", "NAME");
    const lastNameIdx = findColumnIndex(headers, "LAST", "NAME");
    const mappedNameIdx = findMappedColumnIndex("Name");
    const fullNameIdx =
      mappedNameIdx >= 0 ? mappedNameIdx : findColumnIndex(headers, "NAME");
    const uniqueIdIdx = findColumnIndex(headers, "UNIQUE", "ID");
    const mappedCertificateIdx = findMappedColumnIndex("Certificate Type");
    const certificateIdx =
      mappedCertificateIdx >= 0
        ? mappedCertificateIdx
        : findColumnIndex(headers, "CERTIFICATE");
    const typeIdx = findColumnIndex(headers, "TYPE");
    const levelIdx = findColumnIndex(headers, "LEVEL");
    const ratingsIdx = findColumnIndex(headers, "RATING");
    const expireDateIdx = findColumnIndex(headers, "EXPIRE", "DATE");
    const street1Idx = findColumnIndex(headers, "STREET 1");
    const street2Idx = findColumnIndex(headers, "STREET 2");
    const mappedCityIdx = findMappedColumnIndex("City");
    const cityIdx =
      mappedCityIdx >= 0 ? mappedCityIdx : findColumnIndex(headers, "CITY");
    const mappedStateIdx = findMappedColumnIndex("State");
    const stateIdx =
      mappedStateIdx >= 0 ? mappedStateIdx : findColumnIndex(headers, "STATE");
    const mappedZipIdx = findMappedColumnIndex("Zip");
    const zipIdx =
      mappedZipIdx >= 0 ? mappedZipIdx : findColumnIndex(headers, "ZIP");
    const countryIdx = findColumnIndex(headers, "COUNTRY");
    const regionIdx = findColumnIndex(headers, "REGION");
    const medClassIdx = findColumnIndex(headers, "MED", "CLASS");
    const medDateIdx = findColumnIndex(headers, "MED", "DATE");
    const medExpIdx = findColumnIndex(headers, "MED", "EXP");

    let imported = 0;
    let duplicates = 0;
    let skipped = 0;
    const total = lines.length - 1;

    const pilotChunks: Record<string, unknown>[][] = [];
    const enrichmentRows: Record<string, unknown>[] = [];
    let currentChunk: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);
      if (fields.length < 2) {
        skipped++;
        continue;
      }

      // Check for Remote Pilot / Part 107
      const certValue = certificateIdx >= 0 ? fields[certificateIdx] || "" : "";
      const typeValue = typeIdx >= 0 ? fields[typeIdx] || "" : "";
      const levelValue = levelIdx >= 0 ? fields[levelIdx] || "" : "";
      const combinedCert = `${certValue} ${typeValue} ${levelValue}`;

      if (!isRemotePilot(combinedCert)) {
        skipped++;
        continue;
      }

      // Extract name
      let firstName = "";
      let lastName = "";

      if (firstNameIdx >= 0 && lastNameIdx >= 0) {
        firstName = (fields[firstNameIdx] || "").trim();
        lastName = (fields[lastNameIdx] || "").trim();
      } else if (fullNameIdx >= 0) {
        const parsed = parseName(fields[fullNameIdx] || "");
        firstName = parsed.first;
        lastName = parsed.last;
      }

      if (!firstName && !lastName) {
        skipped++;
        continue;
      }

      const city = cityIdx >= 0 ? (fields[cityIdx] || "").trim() : "";
      const state = stateIdx >= 0 ? (fields[stateIdx] || "").trim() : "";
      const zip = zipIdx >= 0 ? (fields[zipIdx] || "").trim() : "";
      const country = countryIdx >= 0 ? (fields[countryIdx] || "").trim() : "";
      const region = regionIdx >= 0 ? (fields[regionIdx] || "").trim() : "";
      const street1 = street1Idx >= 0 ? (fields[street1Idx] || "").trim() : "";
      const street2 = street2Idx >= 0 ? (fields[street2Idx] || "").trim() : "";
      const uniqueId =
        uniqueIdIdx >= 0 ? (fields[uniqueIdIdx] || "").trim() : "";
      const expireDate =
        expireDateIdx >= 0 ? (fields[expireDateIdx] || "").trim() : "";
      const ratings =
        ratingsIdx >= 0 ? (fields[ratingsIdx] || "").trim() : "";
      const medClass =
        medClassIdx >= 0 ? (fields[medClassIdx] || "").trim() : "";
      const medDate =
        medDateIdx >= 0 ? (fields[medDateIdx] || "").trim() : "";
      const medExpDate =
        medExpIdx >= 0 ? (fields[medExpIdx] || "").trim() : "";

      const faaHash = generateFaaHash(lastName, firstName, city, state, zip);

      // Calculate enrichment priority
      let priority = 0;
      if (HIGH_ACTIVITY_STATES.includes(state.toUpperCase())) {
        priority += 10;
      }
      if (isWithinLastTwoYears(expireDate) || isWithinLastTwoYears(medDate)) {
        priority += 5;
      }

      const faaName = `${lastName}, ${firstName}`;

      const pilotRecord: Record<string, unknown> = {
        faa_name: faaName,
        faa_hash: faaHash,
        first_name: firstName,
        last_name: lastName,
        city: city || null,
        state: state || null,
        zip: zip || null,
        certificate_type: certValue || typeValue || "U",
        certificate_number: uniqueId || null,
        ratings: ratings || levelValue || null,
        certificate_date: expireDate || null,
        import_batch_id: batch_id,
        enrichment_status: "pending",
        enrichment_priority: priority,
      };

      currentChunk.push(pilotRecord);
      enrichmentRows.push({
        faa_hash: faaHash,
        priority: priority,
      });

      if (currentChunk.length >= 500) {
        pilotChunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      pilotChunks.push(currentChunk);
    }

    // Insert pilots in chunks and track enrichment queue inserts
    for (const chunk of pilotChunks) {
      const { data, error: upsertError } = await supabase
        .from("outreach_faa_pilots")
        .upsert(chunk, { onConflict: "faa_hash", ignoreDuplicates: true })
        .select("id, faa_hash");

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        skipped += chunk.length;
        continue;
      }

      const insertedCount = data?.length || 0;
      imported += insertedCount;
      duplicates += chunk.length - insertedCount;

      // Insert enrichment queue entries for successfully inserted pilots
      if (data && data.length > 0) {
        const insertedHashes = new Set(data.map((d: { faa_hash: string }) => d.faa_hash));
        const enrichmentInserts = enrichmentRows
          .filter((er) => insertedHashes.has(er.faa_hash as string))
          .map((er) => {
            const pilot = data.find(
              (d: { faa_hash: string }) => d.faa_hash === er.faa_hash
            );
            return {
              faa_pilot_id: pilot?.id,
              status: "pending",
              priority: er.priority,
            };
          })
          .filter((er) => er.faa_pilot_id);

        if (enrichmentInserts.length > 0) {
          const { error: enrichError } = await supabase
            .from("outreach_enrichment_queue")
            .insert(enrichmentInserts);

          if (enrichError) {
            console.error("Enrichment queue insert error:", enrichError);
          }
        }
      }
    }

    // Update import batch record
    await supabase
      .from("outreach_import_batches")
      .update({
        status: "completed",
        imported_rows: imported,
        duplicate_rows: duplicates,
        skipped_rows: skipped,
        total_rows: total,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    return new Response(
      JSON.stringify({
        imported,
        duplicates,
        skipped,
        total,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("CSV parse error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to parse CSV" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
