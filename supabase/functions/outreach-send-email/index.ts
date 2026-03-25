import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const OUTREACH_PHYSICAL_ADDRESS = Deno.env.get(
      "OUTREACH_PHYSICAL_ADDRESS"
    );
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    if (!OUTREACH_PHYSICAL_ADDRESS) {
      throw new Error("OUTREACH_PHYSICAL_ADDRESS is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { message_ids } = await req.json();

    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "message_ids array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Fetch approved draft messages
    const { data: messages, error: msgError } = await supabase
      .from("outreach_messages")
      .select("*")
      .in("id", message_ids)
      .eq("channel", "email")
      .eq("review_status", "approved")
      .eq("send_status", "draft");

    if (msgError) {
      throw new Error(`Failed to fetch messages: ${msgError.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, failed: 0, errors: ["No approved draft messages found for the given IDs"] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch pilots for all messages
    const pilotIds = [...new Set(messages.map((m) => m.faa_pilot_id))];
    const { data: pilots, error: pilotError } = await supabase
      .from("outreach_faa_pilots")
      .select("id, email, outreach_status")
      .in("id", pilotIds);

    if (pilotError) {
      throw new Error(`Failed to fetch pilots: ${pilotError.message}`);
    }

    const pilotMap = new Map(pilots?.map((p) => [p.id, p]) || []);

    // 3. Fetch unsubscribed newsletter emails for cross-reference
    const pilotEmails = pilots?.map((p) => p.email).filter(Boolean) || [];
    const { data: unsubscribed } = await supabase
      .from("newsletter_subscriptions")
      .select("email")
      .in("email", pilotEmails)
      .eq("status", "unsubscribed");

    const unsubscribedEmails = new Set(unsubscribed?.map((u) => u.email) || []);

    // 4. Build sendable emails, checking suppression
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const toSend: { message: typeof messages[0]; pilot: typeof pilots[0]; }[] = [];

    for (const message of messages) {
      const pilot = pilotMap.get(message.faa_pilot_id);

      if (!pilot || !pilot.email) {
        skipped++;
        errors.push(`Message ${message.id}: pilot not found or has no email`);
        continue;
      }

      if (!message.subject) {
        skipped++;
        errors.push(`Message ${message.id}: email subject is required`);
        continue;
      }

      // Check suppression
      if (pilot.outreach_status === "opted_out" || pilot.outreach_status === "do_not_contact") {
        skipped++;
        continue;
      }

      // Cross-reference newsletter unsubscribes
      if (unsubscribedEmails.has(pilot.email)) {
        skipped++;
        continue;
      }

      toSend.push({ message, pilot });
    }

    if (toSend.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped, failed: 0, errors }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Send in batches of 50 via Resend
    const BATCH_SIZE = 50;

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE);

      const emailPayload = batch.map(({ message, pilot }) => {
        const unsubscribe_url = `https://buzzbuzzin.com/api/outreach/unsubscribe?token=${message.unsubscribe_token}`;
        const bodyContent = message.body_html
          ? message.body_html
          : escapeHtml(message.body_text || "").replace(/\n/g, "<br>");

        return {
          from: "Buzz <outreach@buzzbuzzin.com>",
          to: pilot.email,
          subject: message.subject,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${bodyContent}
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
    <p>${escapeHtml(OUTREACH_PHYSICAL_ADDRESS)}</p>
    <p>This is a commercial message. You received this email because your FAA Part 107 Remote Pilot certification is publicly listed in the FAA Airmen database.</p>
    <p><a href="${unsubscribe_url}" style="color: #999;">Unsubscribe</a> from future emails</p>
    <p>&copy; ${new Date().getFullYear()} Buzz. All rights reserved.</p>
  </div>
</div>`,
        };
      });

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${errorText}`);
        failed += batch.length;
        continue;
      }

      const resData = await res.json();
      const resendIds = resData.data || resData;

      // 6-8. Update messages, pilots, and log events
      for (let j = 0; j < batch.length; j++) {
        const { message, pilot } = batch[j];
        const resendMessageId = Array.isArray(resendIds) && resendIds[j]?.id
          ? resendIds[j].id
          : null;

        try {
          // 7. Update message: send_status = 'sent'
          await supabase
            .from("outreach_messages")
            .update({
              send_status: "sent",
              sent_at: new Date().toISOString(),
              resend_message_id: resendMessageId,
            })
            .eq("id", message.id);

          // 8. Update pilot: outreach_status = 'email_sent'
          await supabase
            .from("outreach_faa_pilots")
            .update({ outreach_status: "email_sent" })
            .eq("id", pilot.id);

          // 9. Log analytics event
          await supabase.from("outreach_analytics_events").insert({
            message_id: message.id,
            faa_pilot_id: pilot.id,
            event_type: "message_sent",
            created_at: new Date().toISOString(),
          });

          sent++;
        } catch (updateErr) {
          errors.push(`Failed to update message ${message.id}: ${updateErr.message}`);
          failed++;
        }
      }
    }

    // 10. Return summary
    return new Response(
      JSON.stringify({ sent, skipped, failed, errors }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Outreach send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send outreach emails" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
