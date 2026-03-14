import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AdminInboxNotification = {
  id: string;
  recipient_email: string;
  source_type: string;
  title: string;
  body: string;
  link_path: string;
  email_status: "pending" | "sent" | "failed";
};

const SOURCE_LABELS: Record<string, string> = {
  bug_report: "Bug report",
  safety_report: "Safety report",
  express_promotion: "Express promotion",
  flight_reviewer_application: "Flight reviewer application",
  roc_a_examiner_application: "ROC-A examiner application",
  flight_hour_claim: "Flight hour claim",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PORTAL_BASE_URL = Deno.env.get("PORTAL_BASE_URL")?.trim().replace(/\/$/, "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { notification_ids: notificationIds } = await req.json();

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return jsonResponse({ error: "notification_ids must be a non-empty array" }, 400);
    }

    const { data: notifications, error: fetchError } = await supabase
      .from("admin_inbox_notifications")
      .select("id, recipient_email, source_type, title, body, link_path, email_status")
      .in("id", notificationIds)
      .in("email_status", ["pending", "failed"]);

    if (fetchError) {
      throw new Error(`Failed to load notifications: ${fetchError.message}`);
    }

    const pendingNotifications = (notifications || []) as AdminInboxNotification[];

    if (pendingNotifications.length === 0) {
      return jsonResponse({ sent: 0, message: "No pending notifications to send" });
    }

    const emailPayload = pendingNotifications.map((notification) => {
      const sourceLabel = SOURCE_LABELS[notification.source_type] || "Admin item";
      const fullLink = PORTAL_BASE_URL
        ? `${PORTAL_BASE_URL}${notification.link_path}`
        : null;

      return {
        from: "Buzz Admin <noreply@updates.buzzbuzzin.com>",
        to: notification.recipient_email,
        subject: `New admin item: ${sourceLabel}`,
        html: renderEmailHtml(notification, fullLink, sourceLabel),
      };
    });

    const resendResponse = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      await markNotificationsFailed(supabase, pendingNotifications, errorText);
      throw new Error(`Resend request failed: ${errorText}`);
    }

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("admin_inbox_notifications")
      .update({
        email_status: "sent",
        emailed_at: sentAt,
        email_error: null,
      })
      .in(
        "id",
        pendingNotifications.map((notification) => notification.id)
      );

    if (updateError) {
      throw new Error(`Failed to update notification email status: ${updateError.message}`);
    }

    return jsonResponse({
      sent: pendingNotifications.length,
      notification_ids: pendingNotifications.map((notification) => notification.id),
    });
  } catch (error) {
    console.error("Admin notification send error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to send admin notifications" },
      500
    );
  }
});

function renderEmailHtml(
  notification: AdminInboxNotification,
  fullLink: string | null,
  sourceLabel: string
) {
  const safeTitle = escapeHtml(notification.title);
  const safeBody = escapeHtml(notification.body);
  const safePath = escapeHtml(notification.link_path);
  const safeFullLink = fullLink ? escapeHtml(fullLink) : null;
  const safeSourceLabel = escapeHtml(sourceLabel);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h1 style="margin: 0 0 16px; font-size: 24px; color: #111827;">${safeTitle}</h1>
      <p style="margin: 0 0 12px; color: #4b5563;">Type: ${safeSourceLabel}</p>
      <p style="margin: 0 0 24px; line-height: 1.6; white-space: pre-wrap;">${safeBody}</p>
      ${
        safeFullLink
          ? `<p style="margin: 0 0 24px;"><a href="${safeFullLink}" style="display: inline-block; background: #1f2937; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">Open in admin portal</a></p>`
          : `<p style="margin: 0 0 24px; color: #4b5563;">Open the admin portal and navigate to <strong>${safePath}</strong>.</p>`
      }
      <div style="padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">Buzz admin inbox notification</p>
      </div>
    </div>
  `;
}

async function markNotificationsFailed(
  supabase: ReturnType<typeof createClient>,
  notifications: AdminInboxNotification[],
  errorMessage: string
) {
  await supabase
    .from("admin_inbox_notifications")
    .update({
      email_status: "failed",
      email_error: errorMessage.slice(0, 1000),
    })
    .in(
      "id",
      notifications.map((notification) => notification.id)
    );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
