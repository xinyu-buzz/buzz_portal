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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Parse webhook payload
    const payload = await req.json();
    const { type, data } = payload;

    if (!type || !data || !data.email_id) {
      // Invalid payload, acknowledge anyway
      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Find outreach message by resend_message_id
    const { data: message, error: msgError } = await supabase
      .from("outreach_messages")
      .select("id, faa_pilot_id")
      .eq("resend_message_id", data.email_id)
      .single();

    // 3. If not found, return 200 (might be a newsletter email)
    if (msgError || !message) {
      return new Response(
        JSON.stringify({ received: true, matched: false }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Handle event types
    let eventType: string | null = null;

    switch (type) {
      case "email.delivered": {
        // No action needed, already marked as sent
        eventType = "email_delivered";
        break;
      }

      case "email.opened": {
        await supabase
          .from("outreach_messages")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", message.id);

        await supabase
          .from("outreach_faa_pilots")
          .update({ outreach_status: "email_opened" })
          .eq("id", message.faa_pilot_id);

        eventType = "email_opened";
        break;
      }

      case "email.clicked": {
        await supabase
          .from("outreach_messages")
          .update({ clicked_at: new Date().toISOString() })
          .eq("id", message.id);

        eventType = "email_clicked";
        break;
      }

      case "email.bounced": {
        await supabase
          .from("outreach_messages")
          .update({
            send_status: "bounced",
            send_error: "Resend reported a bounce event",
          })
          .eq("id", message.id);

        await supabase
          .from("outreach_faa_pilots")
          .update({ outreach_status: "bounced" })
          .eq("id", message.faa_pilot_id);

        eventType = "email_bounced";
        break;
      }

      case "email.complained": {
        await supabase
          .from("outreach_messages")
          .update({ send_error: "Resend reported a complaint event" })
          .eq("id", message.id);

        await supabase
          .from("outreach_faa_pilots")
          .update({ outreach_status: "do_not_contact" })
          .eq("id", message.faa_pilot_id);

        eventType = "spam_complaint";
        break;
      }

      default: {
        // Unknown event type, acknowledge
        eventType = type;
        break;
      }
    }

    // 5. Log analytics event
    if (eventType) {
      await supabase.from("outreach_analytics_events").insert({
        message_id: message.id,
        faa_pilot_id: message.faa_pilot_id,
        event_type: eventType,
        created_at: new Date().toISOString(),
      });
    }

    // 6. Always return 200
    return new Response(
      JSON.stringify({ received: true, matched: true, event: eventType }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 so Resend doesn't retry
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
