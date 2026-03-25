import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ZipReader, BlobReader, TextWriter } from "https://esm.sh/@zip.js/zip.js@2.7.34";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches the FAA Airmen Certification database directly from registry.faa.gov,
 * extracts PILOT_BASIC.csv and PILOT_CERT.csv, joins them on UNIQUE ID,
 * filters for Certificate Type 'U' (Remote Pilot / Part 107),
 * and imports into outreach_faa_pilots.
 *
 * FAA CSV format (from HelpComm.pdf):
 *   PILOT_BASIC.csv: UNIQUE ID, FIRST NAME, LAST NAME, STREET 1, STREET 2, CITY, STATE, ZIP CODE, COUNTRY, REGION, ...
 *   PILOT_CERT.csv:  UNIQUE ID, RECORD TYPE, CERTIFICATE TYPE, CERTIFICATE LEVEL, CERTIFICATE EXPIRE DATE, RATINGS
 *   Certificate Type 'U' = Remote Pilot (Part 107)
 *   Join key = UNIQUE ID
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    )!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const userId = body.user_id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine FAA download URL (format: CSMMYYYY.zip, updated monthly)
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const faaUrl = `https://registry.faa.gov/database/CS${month}${year}.zip`;

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from("outreach_import_batches")
      .insert({
        file_name: `FAA_CS${month}${year}.zip (auto-fetched)`,
        status: "processing",
        imported_by: userId,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      throw new Error(
        `Failed to create batch: ${batchError?.message || "unknown"}`
      );
    }

    const batchId = batch.id;

    // Step 1: Download ZIP from FAA
    console.log(`Fetching FAA data from ${faaUrl}...`);
    const faaResponse = await fetch(faaUrl);

    if (!faaResponse.ok) {
      // Try previous month if current month's file isn't available yet
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonthStr = String(prevMonth).padStart(2, "0");
      const fallbackUrl = `https://registry.faa.gov/database/CS${prevMonthStr}${prevYear}.zip`;

      console.log(
        `Current month not available, trying fallback: ${fallbackUrl}`
      );
      const fallbackResponse = await fetch(fallbackUrl);

      if (!fallbackResponse.ok) {
        throw new Error(
          `Failed to download FAA data from both ${faaUrl} and ${fallbackUrl}`
        );
      }

      return await processZip(fallbackResponse, supabase, batchId);
    }

    return await processZip(faaResponse, supabase, batchId);
  } catch (error) {
    console.error("FAA fetch error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch FAA data" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function processZip(
  response: Response,
  supabase: any,
  batchId: string
) {
  // Step 2: Extract ZIP contents
  const zipBlob = await response.blob();
  const zipReader = new ZipReader(new BlobReader(zipBlob));
  const entries = await zipReader.getEntries();

  let basicCsv = "";
  let certCsv = "";

  for (const entry of entries) {
    const name = entry.filename.toUpperCase();
    if (name.includes("PILOT_BASIC") && name.endsWith(".CSV")) {
      basicCsv = await entry.getData!(new TextWriter());
    } else if (name.includes("PILOT_CERT") && name.endsWith(".CSV")) {
      certCsv = await entry.getData!(new TextWriter());
    }
  }
  await zipReader.close();

  if (!basicCsv || !certCsv) {
    throw new Error(
      "Could not find PILOT_BASIC.csv or PILOT_CERT.csv in FAA ZIP"
    );
  }

  // Step 3: Parse PILOT_CERT.csv to find all UNIQUE IDs with Certificate Type 'U' (Remote Pilot)
  const certLines = certCsv.split("\n");
  const certHeader = parseCsvLine(certLines[0]);

  // Find column indices
  const uniqueIdIdx = findColumnIndex(certHeader, [
    "UNIQUE ID",
    "UNIQUE_ID",
    "UNIQUEID",
  ]);
  const certTypeIdx = findColumnIndex(certHeader, [
    "CERTIFICATE TYPE",
    "CERTIFICATE_TYPE",
    "CERTIFICATETYPE",
  ]);
  const certLevelIdx = findColumnIndex(certHeader, [
    "CERTIFICATE LEVEL",
    "CERTIFICATE_LEVEL",
    "CERTIFICATELEVEL",
  ]);
  const ratingsIdx = findColumnIndex(certHeader, ["RATINGS"]);
  const certExpireIdx = findColumnIndex(certHeader, [
    "CERTIFICATE EXPIRE DATE",
    "CERTIFICATE_EXPIRE_DATE",
  ]);

  if (uniqueIdIdx === -1 || certTypeIdx === -1) {
    throw new Error(
      `Could not find required columns in PILOT_CERT.csv. Headers: ${certHeader.join(", ")}`
    );
  }

  // Collect unique IDs of Remote Pilots (Type 'U')
  const remotePilotIds = new Map<
    string,
    { level: string; ratings: string; expireDate: string }
  >();

  for (let i = 1; i < certLines.length; i++) {
    const line = certLines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    const certType = (fields[certTypeIdx] || "").trim().toUpperCase();

    if (certType === "U") {
      const uid = (fields[uniqueIdIdx] || "").trim();
      if (uid) {
        remotePilotIds.set(uid, {
          level: (fields[certLevelIdx] || "").trim(),
          ratings: (fields[ratingsIdx] || "").trim(),
          expireDate: (fields[certExpireIdx] || "").trim(),
        });
      }
    }
  }

  console.log(`Found ${remotePilotIds.size} Remote Pilot certificates`);

  // Step 4: Parse PILOT_BASIC.csv and match with Remote Pilot IDs
  const basicLines = basicCsv.split("\n");
  const basicHeader = parseCsvLine(basicLines[0]);

  const bUniqueIdIdx = findColumnIndex(basicHeader, [
    "UNIQUE ID",
    "UNIQUE_ID",
    "UNIQUEID",
  ]);
  const bFirstNameIdx = findColumnIndex(basicHeader, [
    "FIRST NAME",
    "FIRST_NAME",
    "FIRSTNAME",
    "FIRST & MIDDLE NAME",
  ]);
  const bLastNameIdx = findColumnIndex(basicHeader, [
    "LAST NAME",
    "LAST_NAME",
    "LASTNAME",
    "LAST NAME & SUFFIX",
  ]);
  const bCityIdx = findColumnIndex(basicHeader, ["CITY"]);
  const bStateIdx = findColumnIndex(basicHeader, ["STATE"]);
  const bZipIdx = findColumnIndex(basicHeader, [
    "ZIP CODE",
    "ZIP_CODE",
    "ZIPCODE",
    "ZIP",
  ]);
  const bCountryIdx = findColumnIndex(basicHeader, [
    "COUNTRY",
    "COUNTRY-NAME",
    "COUNTRY_NAME",
  ]);
  const bStreet1Idx = findColumnIndex(basicHeader, [
    "STREET 1",
    "STREET_1",
    "STREET1",
  ]);
  const bRegionIdx = findColumnIndex(basicHeader, ["REGION"]);

  if (bUniqueIdIdx === -1 || bFirstNameIdx === -1 || bLastNameIdx === -1) {
    throw new Error(
      `Could not find required columns in PILOT_BASIC.csv. Headers: ${basicHeader.join(", ")}`
    );
  }

  // High drone activity states for priority scoring
  const highActivityStates = new Set([
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
  ]);

  // Step 5: Build pilot records, filter for US-based Remote Pilots
  const pilotRecords: any[] = [];
  const enrichmentRecords: any[] = [];
  let skipped = 0;

  for (let i = 1; i < basicLines.length; i++) {
    const line = basicLines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    const uid = (fields[bUniqueIdIdx] || "").trim();

    // Only process Remote Pilots
    const certInfo = remotePilotIds.get(uid);
    if (!certInfo) continue;

    const firstName = (fields[bFirstNameIdx] || "").trim();
    const lastName = (fields[bLastNameIdx] || "").trim();
    const city = (fields[bCityIdx] || "").trim();
    const state = (fields[bStateIdx] || "").trim();
    const zip = (fields[bZipIdx] || "").trim();
    const country = (fields[bCountryIdx] || "").trim();

    // Skip non-US addresses (state is blank for foreign addresses)
    if (!state || (country && !country.toUpperCase().includes("US"))) {
      skipped++;
      continue;
    }

    // Skip if missing essential data
    if (!firstName && !lastName) {
      skipped++;
      continue;
    }

    const faaName = `${lastName}, ${firstName}`;
    const hashInput = `${lastName.toLowerCase()}|${firstName.toLowerCase()}|${city.toLowerCase()}|${state.toLowerCase()}|${zip.toLowerCase()}`;
    const faaHash = btoa(hashInput);

    // Priority scoring
    let priority = 0;
    if (highActivityStates.has(state.toUpperCase())) priority += 10;

    const record = {
      faa_name: faaName,
      first_name: firstName,
      last_name: lastName,
      city: city,
      state: state.toUpperCase(),
      zip: zip,
      certificate_type: "U",
      certificate_number: uid,
      ratings: certInfo.ratings,
      certificate_date: certInfo.expireDate,
      faa_hash: faaHash,
      import_batch_id: batchId,
      enrichment_status: "pending",
      enrichment_priority: priority,
    };

    pilotRecords.push(record);
    enrichmentRecords.push({ faaHash, priority });
  }

  console.log(
    `Parsed ${pilotRecords.length} US Remote Pilots, skipped ${skipped}`
  );

  // Step 6: Insert in chunks of 500
  const CHUNK_SIZE = 500;
  let imported = 0;
  let duplicates = 0;

  for (let i = 0; i < pilotRecords.length; i += CHUNK_SIZE) {
    const chunk = pilotRecords.slice(i, i + CHUNK_SIZE);

    const { data, error, count } = await supabase
      .from("outreach_faa_pilots")
      .upsert(chunk, { onConflict: "faa_hash", ignoreDuplicates: true })
      .select("id, faa_hash");

    if (error) {
      console.error(`Chunk insert error at offset ${i}:`, error);
      continue;
    }

    const insertedCount = data?.length || 0;
    imported += insertedCount;
    duplicates += chunk.length - insertedCount;

    // Insert enrichment queue entries for new records
    if (data && data.length > 0) {
      const queueInserts = data.map((pilot: { id: string; faa_hash: string }) => {
        const enrichInfo = enrichmentRecords.find(
          (er) => er.faaHash === pilot.faa_hash
        );
        return {
          faa_pilot_id: pilot.id,
          status: "pending",
          priority: enrichInfo?.priority || 0,
        };
      });

      const { error: queueError } = await supabase
        .from("outreach_enrichment_queue")
        .insert(queueInserts);

      if (queueError) {
        console.error("Enrichment queue insert error:", queueError);
      }
    }
  }

  // Step 7: Update batch record
  await supabase
    .from("outreach_import_batches")
    .update({
      status: "completed",
      total_rows: pilotRecords.length + skipped + duplicates,
      imported_rows: imported,
      duplicate_rows: duplicates,
      skipped_rows: skipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  // Log analytics event
  await supabase.from("outreach_analytics_events").insert({
    event_type: "import",
    metadata: {
      source: "faa_auto_fetch",
      total_remote_pilots: remotePilotIds.size,
      us_pilots_parsed: pilotRecords.length,
      imported: imported,
      duplicates: duplicates,
      skipped: skipped,
    },
  });

  const result = {
    source: "FAA Registry (auto-fetched)",
    total_remote_pilots_in_faa: remotePilotIds.size,
    us_pilots_parsed: pilotRecords.length,
    imported: imported,
    duplicates: duplicates,
    skipped: skipped,
    batch_id: batchId,
  };

  console.log("Import complete:", result);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parse a single CSV line handling quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Find column index by trying multiple possible header names */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalized = headers.map((h) =>
    h.trim().toUpperCase().replace(/["\s]+/g, " ")
  );
  for (const name of possibleNames) {
    const idx = normalized.indexOf(name.toUpperCase());
    if (idx !== -1) return idx;
  }
  // Fuzzy match: check if any header contains the name
  for (const name of possibleNames) {
    const idx = normalized.findIndex((h) => h.includes(name.toUpperCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}
