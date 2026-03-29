export type PilotContactRecord = {
  email?: string | null;
  email_confidence?: string | null;
  email_source_type?: string | null;
  deliverability_status?: string | null;
  consent_status?: string | null;
  suppression_reason?: string | null;
  outreach_status?: string | null;
  website?: string | null;
  contact_form_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type SourceClassification = {
  emailSourceType: "first_party_opt_in" | "public_web_verified" | "third_party_enrichment" | null;
  consentStatus: "unknown" | "opted_in" | "public_source" | "third_party";
};

export const EMAIL_REGEX =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const normalizeNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const isValidEmailSyntax = (value: string | null) =>
  Boolean(value && EMAIL_REGEX.test(value));

export const classifyEmailSource = (
  value: string | null
): SourceClassification => {
  if (!value) {
    return {
      emailSourceType: null,
      consentStatus: "unknown",
    };
  }

  const normalized = value.toLowerCase();

  if (
    normalized.includes("opt-in") ||
    normalized.includes("signup") ||
    normalized.includes("waitlist") ||
    normalized.includes("newsletter") ||
    normalized.includes("academy")
  ) {
    return {
      emailSourceType: "first_party_opt_in",
      consentStatus: "opted_in",
    };
  }

  if (
    normalized.includes("apollo") ||
    normalized.includes("hunter") ||
    normalized.includes("clay") ||
    normalized.includes("people data labs") ||
    normalized.includes("third-party") ||
    normalized.includes("vendor")
  ) {
    return {
      emailSourceType: "third_party_enrichment",
      consentStatus: "third_party",
    };
  }

  return {
    emailSourceType: "public_web_verified",
    consentStatus: "public_source",
  };
};

export const inferPreferredOutreachChannel = (pilot: PilotContactRecord) => {
  if (canSendEmail(pilot)) return "email";
  if (pilot.contact_form_url || pilot.website) return "website_form";
  if (pilot.linkedin_url) return "linkedin_dm";
  if (pilot.instagram_url) return "instagram_dm";
  if (pilot.facebook_url) return "facebook_dm";
  if (pilot.city || pilot.state || pilot.zip) return "postal_mail";
  return "manual";
};

export const hasReachablePublicContactPath = (pilot: PilotContactRecord) =>
  Boolean(
    canSendEmail(pilot) ||
      pilot.contact_form_url ||
      pilot.website ||
      pilot.linkedin_url ||
      pilot.instagram_url ||
      pilot.facebook_url ||
      pilot.city ||
      pilot.state ||
      pilot.zip
  );

export const canSendEmail = (pilot: PilotContactRecord) => {
  if (!isValidEmailSyntax(normalizeNullableString(pilot.email))) return false;

  if (
    pilot.outreach_status === "opted_out" ||
    pilot.outreach_status === "do_not_contact"
  ) {
    return false;
  }

  if (
    pilot.consent_status === "opted_out" ||
    pilot.consent_status === "suppressed"
  ) {
    return false;
  }

  if (pilot.suppression_reason) {
    return false;
  }

  if (
    pilot.deliverability_status === "risky" ||
    pilot.deliverability_status === "bounced" ||
    pilot.deliverability_status === "complained" ||
    pilot.deliverability_status === "suppressed"
  ) {
    return false;
  }

  if (pilot.deliverability_status === "verified") {
    return true;
  }

  return (
    pilot.email_source_type === "public_web_verified" &&
    pilot.email_confidence === "high"
  );
};
