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

export const isPilotEmailSendable = (pilot: OutreachContactInfo | null | undefined) =>
  !!pilot?.email &&
  pilot.email_source_type === "public_web_verified" &&
  pilot.email_confidence === "high" &&
  !["bounced", "complained", "suppressed", "risky"].includes(
    pilot.deliverability_status || ""
  ) &&
  !["opted_out", "suppressed"].includes(pilot.consent_status || "") &&
  pilot.outreach_status !== "do_not_contact" &&
  pilot.outreach_status !== "opted_out" &&
  !pilot.suppression_reason;

export const getPreferredOutreachLabel = (
  pilot: Pick<OutreachContactInfo, "preferred_outreach_channel"> | null | undefined
) => pilot?.preferred_outreach_channel?.replace(/_/g, " ") || "manual";
