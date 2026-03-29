import { describe, expect, it } from "vitest";
import { getPreferredOutreachLabel, isPilotEmailSendable } from "./outreachContact";

describe("outreachContact", () => {
  it("accepts a high-confidence public web email when not suppressed", () => {
    expect(
      isPilotEmailSendable({
        email: "pilot@example.com",
        email_confidence: "high",
        email_source_type: "public_web_verified",
        deliverability_status: "unverified",
        consent_status: "public_source",
        outreach_status: "ready",
      })
    ).toBe(true);
  });

  it("rejects suppressed or low-confidence emails", () => {
    expect(
      isPilotEmailSendable({
        email: "pilot@example.com",
        email_confidence: "medium",
        email_source_type: "public_web_verified",
        deliverability_status: "unverified",
        consent_status: "public_source",
        outreach_status: "ready",
      })
    ).toBe(false);

    expect(
      isPilotEmailSendable({
        email: "pilot@example.com",
        email_confidence: "high",
        email_source_type: "public_web_verified",
        deliverability_status: "bounced",
        consent_status: "public_source",
        outreach_status: "ready",
      })
    ).toBe(false);
  });

  it("formats the preferred channel label", () => {
    expect(
      getPreferredOutreachLabel({ preferred_outreach_channel: "linkedin_dm" })
    ).toBe("linkedin dm");
    expect(getPreferredOutreachLabel(null)).toBe("manual");
  });
});
