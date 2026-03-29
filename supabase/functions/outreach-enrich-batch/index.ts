import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canSendEmail,
  classifyEmailSource,
  hasReachablePublicContactPath,
  inferPreferredOutreachChannel,
  isValidEmailSyntax,
  normalizeNullableString,
} from "../_shared/outreach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const BRAVE_SEARCH_API_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!BRAVE_SEARCH_API_KEY) {
      throw new Error("BRAVE_SEARCH_API_KEY is not configured");
    }
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;
    const requestedPilotIds = Array.isArray(body.pilot_ids)
      ? body.pilot_ids.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

    // Step 1: Release stale locks (older than 5 minutes)
    await supabase
      .from("outreach_enrichment_queue")
      .update({ status: "pending", locked_at: null, locked_by: null })
      .eq("status", "processing")
      .lt("locked_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (requestedPilotIds.length > 0) {
      const { data: existingQueueItems, error: existingQueueError } = await supabase
        .from("outreach_enrichment_queue")
        .select("id, faa_pilot_id")
        .in("faa_pilot_id", requestedPilotIds)
        .order("created_at", { ascending: false });

      if (existingQueueError) {
        throw new Error(
          `Failed to load requested queue items: ${existingQueueError.message}`
        );
      }

      const latestQueueItemByPilot = new Map<string, { id: string }>();
      for (const item of existingQueueItems || []) {
        if (!latestQueueItemByPilot.has(item.faa_pilot_id)) {
          latestQueueItemByPilot.set(item.faa_pilot_id, { id: item.id });
        }
      }

      const reusableQueueIds = Array.from(latestQueueItemByPilot.values()).map(
        (item) => item.id
      );

      if (reusableQueueIds.length > 0) {
        const { error: resetQueueError } = await supabase
          .from("outreach_enrichment_queue")
          .update({
            status: "pending",
            attempts: 0,
            locked_at: null,
            locked_by: null,
            error_message: null,
            completed_at: null,
          })
          .in("id", reusableQueueIds);

        if (resetQueueError) {
          throw new Error(
            `Failed to reset requested queue items: ${resetQueueError.message}`
          );
        }
      }

      const missingPilotIds = requestedPilotIds.filter(
        (pilotId) => !latestQueueItemByPilot.has(pilotId)
      );

      if (missingPilotIds.length > 0) {
        const { data: pilots, error: pilotsError } = await supabase
          .from("outreach_faa_pilots")
          .select("id, enrichment_priority")
          .in("id", missingPilotIds);

        if (pilotsError) {
          throw new Error(
            `Failed to load requested pilots: ${pilotsError.message}`
          );
        }

        if (pilots && pilots.length > 0) {
          const { error: insertQueueError } = await supabase
            .from("outreach_enrichment_queue")
            .insert(
              pilots.map((pilot) => ({
                faa_pilot_id: pilot.id,
                status: "pending",
                priority: pilot.enrichment_priority || 0,
              }))
            );

          if (insertQueueError) {
            throw new Error(
              `Failed to queue requested pilots: ${insertQueueError.message}`
            );
          }
        }
      }

      const { error: markQueuedError } = await supabase
        .from("outreach_faa_pilots")
        .update({
          enrichment_status: "queued",
          enrichment_error: null,
        })
        .in("id", requestedPilotIds);

      if (markQueuedError) {
        throw new Error(
          `Failed to mark requested pilots as queued: ${markQueuedError.message}`
        );
      }
    }

    // Step 2: Claim a batch of records
    let pendingQuery = supabase
      .from("outreach_enrichment_queue")
      .select("id, faa_pilot_id, attempts, max_attempts")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (requestedPilotIds.length > 0) {
      pendingQuery = pendingQuery.in("faa_pilot_id", requestedPilotIds);
    }

    const { data: pendingItems, error: selectError } = await pendingQuery.limit(
      batchSize
    );

    if (selectError) {
      throw new Error(`Failed to fetch pending items: ${selectError.message}`);
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          succeeded: 0,
          failed: 0,
          message: "No pending items in queue",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claimedIds = pendingItems.map((item) => item.id);
    const claimedAt = new Date().toISOString();

    // Update those specific IDs to processing
    const { error: claimError } = await supabase
      .from("outreach_enrichment_queue")
      .update({
        status: "processing",
        locked_at: claimedAt,
        locked_by: workerId,
      })
      .in("id", claimedIds)
      .eq("status", "pending");

    if (claimError) {
      throw new Error(`Failed to claim items: ${claimError.message}`);
    }

    const { data: claimedItems, error: claimedItemsError } = await supabase
      .from("outreach_enrichment_queue")
      .select("id, faa_pilot_id, attempts, max_attempts")
      .in("id", claimedIds)
      .eq("status", "processing")
      .eq("locked_by", workerId);

    if (claimedItemsError) {
      throw new Error(
        `Failed to confirm claimed items: ${claimedItemsError.message}`
      );
    }

    if (!claimedItems || claimedItems.length === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          succeeded: 0,
          failed: 0,
          message: "No queue items were claimed",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let succeeded = 0;
    let failed = 0;

    // Step 3-9: Process each claimed item
    for (const queueItem of claimedItems) {
      try {
        // Step 3: Get the pilot data
        const { data: pilot, error: pilotError } = await supabase
          .from("outreach_faa_pilots")
          .select("*")
          .eq("id", queueItem.faa_pilot_id)
          .single();

        if (pilotError || !pilot) {
          throw new Error(
            `Pilot not found: ${pilotError?.message || "No data"}`
          );
        }

        const firstName = pilot.first_name || "";
        const lastName = pilot.last_name || "";
        const city = pilot.city || "";
        const state = pilot.state || "";

        // Step 4: Run Brave Search queries
        const searchQuery1 = encodeURIComponent(
          `"${firstName} ${lastName}" drone pilot ${city} ${state}`
        );
        const searchQuery2 = encodeURIComponent(
          `"${firstName} ${lastName}" site:linkedin.com OR site:instagram.com drone`
        );

        const [searchRes1, searchRes2] = await Promise.all([
          fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${searchQuery1}&count=5`,
            {
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
              },
            }
          ),
          fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${searchQuery2}&count=5`,
            {
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
              },
            }
          ),
        ]);

        const searchResults1 = searchRes1.ok
          ? await searchRes1.json()
          : { error: `Search 1 failed: ${searchRes1.status}` };
        const searchResults2 = searchRes2.ok
          ? await searchRes2.json()
          : { error: `Search 2 failed: ${searchRes2.status}` };

        const combinedResults = {
          general_search: searchResults1.web?.results || [],
          social_search: searchResults2.web?.results || [],
        };

        // Step 5: Send to Claude API for enrichment
        const claudeRes = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              messages: [
                {
                  role: "user",
                  content: `You are researching a drone pilot for outreach purposes. Based on the following web search results, extract any contact and business information you can find.

Pilot: ${firstName} ${lastName}, ${city}, ${state}
Certificate: FAA Part 107 Remote Pilot

Search Results:
${JSON.stringify(combinedResults)}

Please respond in JSON format with these fields:
{
  "email": "found email or null",
  "email_confidence": "high/medium/low based on how certain you are",
  "email_source": "where you found it (website, linkedin, etc)",
  "email_source_url": "URL of the page where the email appears, if known",
  "website": "their website URL or null",
  "contact_form_url": "URL of a public contact form if found, otherwise null",
  "linkedin_url": "their LinkedIn URL or null",
  "instagram_url": "their Instagram URL or null",
  "youtube_url": "their YouTube URL or null",
  "facebook_url": "their Facebook URL or null",
  "phone": "phone number or null",
  "business_name": "their drone business name or null",
  "specializations": ["array of specializations like real_estate, cinematography, inspection, agriculture, mapping, construction, events, photography"],
  "has_own_website": true/false,
  "estimated_experience_level": "beginner/intermediate/advanced/commercial_pro",
  "summary": "Brief 1-2 sentence summary of what you found about this pilot"
}

Only include information you actually found in the search results. Only return an email if it is explicitly public in the result set. Do not make up or guess information.`,
                },
              ],
            }),
          }
        );

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          throw new Error(`Claude API error: ${claudeRes.status} - ${errText}`);
        }

        const claudeData = await claudeRes.json();
        const claudeText =
          claudeData.content?.[0]?.text || "";

        // Parse Claude's JSON response
        let enrichedData: Record<string, unknown>;
        try {
          // Extract JSON from the response (handle markdown code blocks)
          const jsonMatch = claudeText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in Claude response");
          }
          enrichedData = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
          throw new Error(
            `Failed to parse Claude response: ${parseErr.message}`
          );
        }

        const email = normalizeNullableString(enrichedData.email);
        const emailSource = normalizeNullableString(enrichedData.email_source);
        const normalizedPilot = {
          ...pilot,
          email,
          email_confidence: normalizeNullableString(enrichedData.email_confidence),
          email_source_type: null,
          deliverability_status: "unverified",
          consent_status: "unknown",
          website: normalizeNullableString(enrichedData.website),
          contact_form_url: normalizeNullableString(enrichedData.contact_form_url),
          linkedin_url: normalizeNullableString(enrichedData.linkedin_url),
          instagram_url: normalizeNullableString(enrichedData.instagram_url),
          facebook_url: normalizeNullableString(enrichedData.facebook_url),
        };
        const sourceClassification = classifyEmailSource(emailSource);
        const hasValidEmail = Boolean(email && isValidEmailSyntax(email));
        const emailSourceType =
          hasValidEmail
            ? sourceClassification.emailSourceType
            : null;
        const consentStatus =
          emailSourceType !== null ? sourceClassification.consentStatus : "unknown";
        const deliverabilityStatus =
          !email ? "unverified" : hasValidEmail ? "unverified" : "risky";
        const preferredOutreachChannel = inferPreferredOutreachChannel({
          ...normalizedPilot,
          email_source_type: emailSourceType,
          deliverability_status: deliverabilityStatus,
          consent_status: consentStatus,
        });
        const hasPublicContactPath = hasReachablePublicContactPath({
          ...normalizedPilot,
          email_source_type: emailSourceType,
          deliverability_status: deliverabilityStatus,
          consent_status: consentStatus,
        });
        const nextOutreachStatus =
          hasPublicContactPath &&
          pilot.outreach_status !== "opted_out" &&
          pilot.outreach_status !== "do_not_contact"
            ? "ready"
            : pilot.outreach_status;

        // Step 6: Update pilot with enriched data
        const { error: updatePilotError } = await supabase
          .from("outreach_faa_pilots")
          .update({
            email,
            email_confidence: normalizedPilot.email_confidence,
            email_source: emailSource,
            email_source_type: emailSourceType,
            email_source_url: normalizeNullableString(enrichedData.email_source_url),
            email_verified_at: null,
            deliverability_status: deliverabilityStatus,
            consent_status: consentStatus,
            suppression_reason: null,
            website: normalizedPilot.website,
            contact_form_url: normalizedPilot.contact_form_url,
            linkedin_url: normalizedPilot.linkedin_url,
            instagram_url: normalizedPilot.instagram_url,
            youtube_url: normalizeNullableString(enrichedData.youtube_url),
            facebook_url: normalizedPilot.facebook_url,
            phone: normalizeNullableString(enrichedData.phone),
            business_name: normalizeNullableString(enrichedData.business_name),
            specializations: Array.isArray(enrichedData.specializations)
              ? enrichedData.specializations.filter(
                  (value): value is string => typeof value === "string" && value.trim().length > 0
                )
              : [],
            has_own_website: enrichedData.has_own_website || false,
            estimated_experience_level:
              normalizeNullableString(enrichedData.estimated_experience_level),
            enrichment_summary: normalizeNullableString(enrichedData.summary),
            enrichment_raw_json: enrichedData,
            enrichment_status: "completed",
            enrichment_attempts: (queueItem.attempts || 0) + 1,
            enrichment_error: null,
            last_enrichment_at: new Date().toISOString(),
            preferred_outreach_channel: preferredOutreachChannel,
            has_public_contact_path: hasPublicContactPath,
            outreach_status: nextOutreachStatus,
          })
          .eq("id", queueItem.faa_pilot_id);

        if (updatePilotError) {
          throw new Error(
            `Failed to update pilot: ${updatePilotError.message}`
          );
        }

        // Step 7: Update queue item to completed
        await supabase
          .from("outreach_enrichment_queue")
          .update({
            status: "completed",
            locked_at: null,
            locked_by: null,
            error_message: null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id);

        // Step 9: Log analytics event
        await supabase.from("outreach_analytics_events").insert({
          event_type: "enrichment_complete",
          faa_pilot_id: queueItem.faa_pilot_id,
          metadata: {
            email_found: !!email,
            email_sendable: canSendEmail({
              ...normalizedPilot,
              email_source_type: emailSourceType,
              deliverability_status: deliverabilityStatus,
              consent_status: consentStatus,
            }),
            email_confidence: normalizedPilot.email_confidence,
            email_source_type: emailSourceType,
            social_profiles_found: [
              normalizedPilot.linkedin_url,
              normalizedPilot.instagram_url,
              normalizeNullableString(enrichedData.youtube_url),
              normalizedPilot.facebook_url,
            ].filter(Boolean).length,
            preferred_outreach_channel: preferredOutreachChannel,
            has_public_contact_path: hasPublicContactPath,
            business_name_found: !!normalizeNullableString(enrichedData.business_name),
            worker_id: workerId,
          },
        });

        succeeded++;
      } catch (itemError) {
        console.error(
          `Enrichment failed for queue item ${queueItem.id}:`,
          itemError
        );

        const attempts = (queueItem.attempts || 0) + 1;
        const maxAttempts = queueItem.max_attempts || 3;

        // Step 8: If failed after max attempts, set to dead_letter
        const newStatus =
          attempts >= maxAttempts ? "dead_letter" : "pending";

        await supabase
          .from("outreach_enrichment_queue")
          .update({
            status: newStatus,
            locked_at: null,
            locked_by: null,
            attempts: attempts,
            error_message: itemError.message || "Unknown error",
          })
          .eq("id", queueItem.id);

        await supabase
          .from("outreach_faa_pilots")
          .update({
            enrichment_status:
              newStatus === "dead_letter" ? "failed" : "queued",
            enrichment_attempts: attempts,
            enrichment_error: itemError.message || "Unknown error",
            last_enrichment_at: new Date().toISOString(),
          })
          .eq("id", queueItem.faa_pilot_id);

        // Log failure event
        await supabase.from("outreach_analytics_events").insert({
          event_type: "enrichment_complete",
          faa_pilot_id: queueItem.faa_pilot_id,
          metadata: {
            error: itemError.message || "Unknown error",
            attempt: attempts,
            dead_lettered: newStatus === "dead_letter",
            worker_id: workerId,
          },
        });

        failed++;
      }
    }

    // Step 10: Return results
    return new Response(
        JSON.stringify({
          processed: claimedItems.length,
          succeeded,
          failed,
        }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Enrich batch error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to process enrichment batch",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
