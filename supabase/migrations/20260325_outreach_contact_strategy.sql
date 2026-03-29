-- Contact provenance and suppression fields for compliant outreach.

ALTER TABLE public.outreach_faa_pilots
ADD COLUMN email_source_type text CHECK (
  email_source_type IS NULL
  OR email_source_type = ANY (
    ARRAY[
      'first_party_opt_in'::text,
      'public_web_verified'::text,
      'third_party_enrichment'::text
    ]
  )
),
ADD COLUMN email_source_url text,
ADD COLUMN email_verified_at timestamp with time zone,
ADD COLUMN deliverability_status text NOT NULL DEFAULT 'unverified'::text CHECK (
  deliverability_status = ANY (
    ARRAY[
      'unverified'::text,
      'verified'::text,
      'risky'::text,
      'bounced'::text,
      'complained'::text,
      'suppressed'::text
    ]
  )
),
ADD COLUMN consent_status text NOT NULL DEFAULT 'unknown'::text CHECK (
  consent_status = ANY (
    ARRAY[
      'unknown'::text,
      'opted_in'::text,
      'public_source'::text,
      'third_party'::text,
      'opted_out'::text,
      'suppressed'::text
    ]
  )
),
ADD COLUMN suppression_reason text,
ADD COLUMN contact_form_url text,
ADD COLUMN preferred_outreach_channel text CHECK (
  preferred_outreach_channel IS NULL
  OR preferred_outreach_channel = ANY (
    ARRAY[
      'email'::text,
      'website_form'::text,
      'linkedin_dm'::text,
      'instagram_dm'::text,
      'facebook_dm'::text,
      'postal_mail'::text,
      'manual'::text
    ]
  )
),
ADD COLUMN has_public_contact_path boolean NOT NULL DEFAULT false;

CREATE INDEX idx_outreach_faa_email_strategy
  ON public.outreach_faa_pilots (email_source_type, deliverability_status, consent_status)
  WHERE email IS NOT NULL;

CREATE INDEX idx_outreach_faa_preferred_channel
  ON public.outreach_faa_pilots (preferred_outreach_channel)
  WHERE preferred_outreach_channel IS NOT NULL;
