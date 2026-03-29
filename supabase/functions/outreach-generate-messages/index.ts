import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canSendEmail } from "../_shared/outreach.ts";

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { pilot_ids, template_id, channel } = await req.json();

    if (!pilot_ids || !Array.isArray(pilot_ids) || pilot_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "pilot_ids array is required and must not be empty" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!channel) {
      return new Response(
        JSON.stringify({ error: "channel is required (e.g., 'email', 'instagram', 'linkedin')" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supportedChannels = ["email", "instagram_dm", "linkedin_dm", "facebook_dm"];
    if (!supportedChannels.includes(channel)) {
      return new Response(
        JSON.stringify({ error: `Unsupported channel: ${channel}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Fetch pilot data (must have enrichment_status = 'completed')
    const { data: pilots, error: pilotsError } = await supabase
      .from("outreach_faa_pilots")
      .select("*")
      .in("id", pilot_ids)
      .eq("enrichment_status", "completed");

    if (pilotsError) {
      throw new Error(`Failed to fetch pilots: ${pilotsError.message}`);
    }

    if (!pilots || pilots.length === 0) {
      return new Response(
        JSON.stringify({
          generated: 0,
          errors: [
            "No pilots found with enrichment_status = 'completed' for the given IDs",
          ],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Fetch template if provided
    let template: Record<string, unknown> | null = null;
    if (template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from("outreach_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (templateError) {
        console.error("Template fetch error:", templateError);
      } else {
        template = templateData;
      }
    }

    let generated = 0;
    const errors: string[] = [];

    // Step 3: Generate personalized messages for each pilot
    for (const pilot of pilots) {
      try {
        if (channel === "email" && !canSendEmail(pilot)) {
          errors.push(
            `Pilot ${pilot.id} (${pilot.first_name} ${pilot.last_name}): no compliant sendable email is available`
          );
          continue;
        }

        if (channel === "linkedin_dm" && !pilot.linkedin_url) {
          errors.push(
            `Pilot ${pilot.id} (${pilot.first_name} ${pilot.last_name}): no LinkedIn profile is available`
          );
          continue;
        }

        if (channel === "instagram_dm" && !pilot.instagram_url) {
          errors.push(
            `Pilot ${pilot.id} (${pilot.first_name} ${pilot.last_name}): no Instagram profile is available`
          );
          continue;
        }

        if (channel === "facebook_dm" && !pilot.facebook_url) {
          errors.push(
            `Pilot ${pilot.id} (${pilot.first_name} ${pilot.last_name}): no Facebook profile is available`
          );
          continue;
        }

        const firstName = pilot.first_name || "";
        const lastName = pilot.last_name || "";
        const city = pilot.city || "";
        const state = pilot.state || "";
        const businessName = pilot.business_name || null;
        const specializations = pilot.specializations || [];
        const experienceLevel = pilot.estimated_experience_level || null;
        const contactPath =
          channel === "email"
            ? `Public email: ${pilot.email}`
            : channel === "linkedin_dm"
            ? `LinkedIn: ${pilot.linkedin_url}`
            : channel === "instagram_dm"
            ? `Instagram: ${pilot.instagram_url}`
            : `Facebook: ${pilot.facebook_url}`;

        const templateSection = template
          ? `Use this template as a guide (personalize it):\nSubject: ${template.subject_template}\nBody: ${template.body_template}`
          : "";

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
                  content: `Generate a personalized ${channel} outreach message for a drone pilot to encourage them to join Buzz, a drone pilot marketplace app.

Pilot Information:
- Name: ${firstName} ${lastName}
- Location: ${city}, ${state}
- Business: ${businessName || "Independent pilot"}
- Specializations: ${specializations.length > 0 ? specializations.join(", ") : "General"}
- Experience Level: ${experienceLevel || "Unknown"}
- Contact Path: ${contactPath}

${templateSection}

About Buzz:
- Buzz is a marketplace that connects certified drone pilots with customers needing professional drone services
- Features: booking management, in-app messaging, pilot rankings, training academy, drone registration, weather monitoring
- Benefits: Get more clients, manage bookings professionally, build reputation through ratings and rankings

Guidelines:
- Keep the tone professional but friendly
- Mention something specific to their location or specialization
- For email: include a subject line and body (plain text, 3-5 paragraphs)
- For social DMs: keep it under 300 characters, casual and direct
- Don't be pushy or salesy
- Include a clear call-to-action (download the app)
- Do not mention the FAA, scraping, or how Buzz found them

Respond in JSON format:
{
  "subject": "email subject line (null for DMs)",
  "body_text": "the message body in plain text",
  "body_html": "the message body in HTML (for email only, null for DMs)"
}`,
                },
              ],
            }),
          }
        );

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          throw new Error(
            `Claude API error: ${claudeRes.status} - ${errText}`
          );
        }

        const claudeData = await claudeRes.json();
        const claudeText = claudeData.content?.[0]?.text || "";

        // Parse Claude's JSON response
        let messageData: Record<string, unknown>;
        try {
          const jsonMatch = claudeText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in Claude response");
          }
          messageData = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
          throw new Error(
            `Failed to parse Claude response: ${parseErr.message}`
          );
        }

        // Step 4: Generate unsubscribe token and insert message
        const unsubscribeToken = crypto.randomUUID();

        const { error: insertError } = await supabase
          .from("outreach_messages")
          .insert({
            faa_pilot_id: pilot.id,
            channel: channel,
            template_id: template_id || null,
            subject: messageData.subject || null,
            body_text: messageData.body_text || "",
            body_html: messageData.body_html || null,
            generated_by_model: "claude-sonnet-4-20250514",
            unsubscribe_token: unsubscribeToken,
            review_status: "pending",
          });

        if (insertError) {
          throw new Error(
            `Failed to insert message: ${insertError.message}`
          );
        }

        generated++;
      } catch (pilotError) {
        const errorMsg = `Pilot ${pilot.id} (${pilot.first_name} ${pilot.last_name}): ${pilotError.message}`;
        console.error("Message generation error:", errorMsg);
        errors.push(errorMsg);
      }
    }

    // Step 5: Return results
    return new Response(
      JSON.stringify({
        generated,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generate messages error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to generate messages",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
