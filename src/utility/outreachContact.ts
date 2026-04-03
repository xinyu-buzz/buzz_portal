export type OutreachContactInfo = {
  email?: string | null;
  email_confidence?: string | null;
  email_source_type?: string | null;
  deliverability_status?: string | null;
  consent_status?: string | null;
  suppression_reason?: string | null;
  outreach_status?: string | null;
  preferred_outreach_channel?: string | null;
  has_public_contact_path?: boolean | null;
};

const EMAIL_REGEX =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const normalizeNullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const isPilotEmailSendable = (pilot: OutreachContactInfo | null | undefined) => {
  const email = normalizeNullableString(pilot?.email);
  if (!email || !EMAIL_REGEX.test(email)) return false;

  if (
    pilot?.outreach_status === "opted_out" ||
    pilot?.outreach_status === "do_not_contact"
  ) {
    return false;
  }

  if (
    pilot?.consent_status === "opted_out" ||
    pilot?.consent_status === "suppressed"
  ) {
    return false;
  }

  if (pilot?.suppression_reason) {
    return false;
  }

  if (
    pilot?.deliverability_status === "risky" ||
    pilot?.deliverability_status === "bounced" ||
    pilot?.deliverability_status === "complained" ||
    pilot?.deliverability_status === "suppressed"
  ) {
    return false;
  }

  if (pilot?.deliverability_status === "verified") {
    return true;
  }

  return (
    pilot?.email_source_type === "public_web_verified" &&
    pilot?.email_confidence === "high"
  );
};

export const getPreferredOutreachLabel = (
  pilot: Pick<OutreachContactInfo, "preferred_outreach_channel"> | null | undefined
) => pilot?.preferred_outreach_channel?.replace(/_/g, " ") || "manual";
