import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const invalidHtml = `<!DOCTYPE html>
<html>
<head><title>Invalid Link</title><style>
body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; margin: 0; }
.card { background: white; padding: 48px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
h1 { color: #333; margin: 0 0 12px; } p { color: #666; margin: 0; }
</style></head>
<body><div class="card"><h1>Invalid Link</h1><p>Invalid or expired unsubscribe link.</p></div></body>
</html>`;

const successHtml = `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title><style>
body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; margin: 0; }
.card { background: white; padding: 48px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
h1 { color: #333; margin: 0 0 12px; } p { color: #666; margin: 0; }
</style></head>
<body><div class="card"><h1>Unsubscribed</h1><p>You've been removed from Buzz outreach emails. You won't receive any more messages from us.</p></div></body>
</html>`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1-2. Extract token from GET query params or POST body
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json();
      token = body.token || null;
    }

    if (!token) {
      if (req.method === "GET") {
        return new Response(invalidHtml, {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(
        JSON.stringify({ error: "token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Find message by unsubscribe_token
    const { data: message, error: msgError } = await supabase
      .from("outreach_messages")
      .select("id, faa_pilot_id")
      .eq("unsubscribe_token", token)
      .single();

    if (msgError || !message) {
      // 4. Not found
      if (req.method === "GET") {
        return new Response(invalidHtml, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(
        JSON.stringify({ error: "Invalid or expired unsubscribe link" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Update pilot to opted_out
    await supabase
      .from("outreach_faa_pilots")
      .update({
        outreach_status: "opted_out",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("id", message.faa_pilot_id);

    // Log unsubscribe event
    await supabase.from("outreach_analytics_events").insert({
      message_id: message.id,
      faa_pilot_id: message.faa_pilot_id,
      event_type: "unsubscribe",
      created_at: new Date().toISOString(),
    });

    // 6. Return confirmation
    if (req.method === "GET") {
      return new Response(successHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);

    if (req.method === "GET") {
      return new Response(invalidHtml, {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      JSON.stringify({ error: error.message || "Failed to process unsubscribe" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
