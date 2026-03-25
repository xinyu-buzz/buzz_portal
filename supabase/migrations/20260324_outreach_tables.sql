-- Outreach pipeline tables for US drone pilot acquisition
-- Follows existing conventions: UUID PKs, UTC timestamps, CHECK constraints for enums

-- 1. Import batch tracking
CREATE TABLE public.outreach_import_batches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploading'::text CHECK (status = ANY (ARRAY['uploading'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  error_message text,
  imported_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  CONSTRAINT outreach_import_batches_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_import_batches_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.profiles(id)
);

-- 2. Core pilot records from FAA Part 107 database
CREATE TABLE public.outreach_faa_pilots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  -- FAA certificate data (from CSV)
  faa_name text NOT NULL,
  first_name text,
  last_name text,
  city text,
  state text,
  zip text,
  certificate_type text NOT NULL,
  certificate_number text,
  ratings text,
  certificate_date text,
  -- Deduplication
  faa_hash text NOT NULL UNIQUE,
  -- Import metadata
  import_batch_id uuid NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  -- Enrichment pipeline state
  enrichment_status text NOT NULL DEFAULT 'pending'::text CHECK (enrichment_status = ANY (ARRAY['pending'::text, 'queued'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'skipped'::text])),
  enrichment_priority integer NOT NULL DEFAULT 0,
  enrichment_attempts integer NOT NULL DEFAULT 0,
  last_enrichment_at timestamp with time zone,
  enrichment_error text,
  -- Enriched contact info (from Claude agent research)
  email text,
  email_confidence text CHECK (email_confidence IS NULL OR email_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])),
  email_source text,
  website text,
  linkedin_url text,
  instagram_url text,
  youtube_url text,
  facebook_url text,
  phone text,
  -- Enriched business info
  business_name text,
  specializations text[],
  has_own_website boolean DEFAULT false,
  estimated_experience_level text CHECK (estimated_experience_level IS NULL OR estimated_experience_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'commercial_pro'::text])),
  enrichment_summary text,
  enrichment_raw_json jsonb,
  -- Outreach pipeline state
  outreach_status text NOT NULL DEFAULT 'not_started'::text CHECK (outreach_status = ANY (ARRAY['not_started'::text, 'ready'::text, 'email_sent'::text, 'email_opened'::text, 'replied'::text, 'converted'::text, 'opted_out'::text, 'bounced'::text, 'do_not_contact'::text])),
  outreach_channel text CHECK (outreach_channel IS NULL OR outreach_channel = ANY (ARRAY['email'::text, 'instagram'::text, 'linkedin'::text, 'facebook'::text, 'manual'::text])),
  -- Link to Buzz profile if they sign up
  buzz_profile_id uuid,
  -- CAN-SPAM compliance
  unsubscribed_at timestamp with time zone,
  physical_address_included boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT outreach_faa_pilots_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_faa_pilots_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES public.outreach_import_batches(id),
  CONSTRAINT outreach_faa_pilots_buzz_profile_id_fkey FOREIGN KEY (buzz_profile_id) REFERENCES public.profiles(id)
);

CREATE INDEX idx_outreach_faa_enrichment_queue ON public.outreach_faa_pilots (enrichment_status, enrichment_priority DESC) WHERE enrichment_status = ANY (ARRAY['pending'::text, 'queued'::text]);
CREATE INDEX idx_outreach_faa_outreach_status ON public.outreach_faa_pilots (outreach_status) WHERE outreach_status != 'do_not_contact'::text;
CREATE INDEX idx_outreach_faa_state ON public.outreach_faa_pilots (state);
CREATE INDEX idx_outreach_faa_email ON public.outreach_faa_pilots (email) WHERE email IS NOT NULL;

-- 3. Enrichment job queue with optimistic locking
CREATE TABLE public.outreach_enrichment_queue (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  faa_pilot_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'dead_letter'::text])),
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  locked_at timestamp with time zone,
  locked_by text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  CONSTRAINT outreach_enrichment_queue_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_enrichment_queue_faa_pilot_id_fkey FOREIGN KEY (faa_pilot_id) REFERENCES public.outreach_faa_pilots(id)
);

CREATE INDEX idx_enrichment_queue_pending ON public.outreach_enrichment_queue (priority DESC, created_at ASC) WHERE status = 'pending'::text;
CREATE INDEX idx_enrichment_queue_stale_locks ON public.outreach_enrichment_queue (locked_at) WHERE status = 'processing'::text AND locked_at IS NOT NULL;

-- 4. Reusable message templates
CREATE TABLE public.outreach_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel = ANY (ARRAY['email'::text, 'instagram_dm'::text, 'linkedin_dm'::text, 'facebook_dm'::text])),
  subject_template text,
  body_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT outreach_templates_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 5. Generated/sent outreach messages
CREATE TABLE public.outreach_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  faa_pilot_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel = ANY (ARRAY['email'::text, 'instagram_dm'::text, 'linkedin_dm'::text, 'facebook_dm'::text])),
  -- Message content
  subject text,
  body_text text NOT NULL,
  body_html text,
  -- Generation metadata
  template_id uuid,
  generated_by_model text,
  generation_prompt_hash text,
  -- Review workflow
  review_status text NOT NULL DEFAULT 'pending'::text CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'edited'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  edit_notes text,
  -- Send state
  send_status text DEFAULT 'draft'::text CHECK (send_status = ANY (ARRAY['draft'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'bounced'::text])),
  sent_at timestamp with time zone,
  resend_message_id text,
  send_error text,
  -- Tracking
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  replied_at timestamp with time zone,
  -- CAN-SPAM
  unsubscribe_token text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT outreach_messages_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_messages_faa_pilot_id_fkey FOREIGN KEY (faa_pilot_id) REFERENCES public.outreach_faa_pilots(id),
  CONSTRAINT outreach_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.outreach_templates(id),
  CONSTRAINT outreach_messages_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);

-- 6. Lightweight analytics event log
CREATE TABLE public.outreach_analytics_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['import'::text, 'enrichment_complete'::text, 'message_generated'::text, 'message_sent'::text, 'email_delivered'::text, 'email_opened'::text, 'email_clicked'::text, 'email_bounced'::text, 'spam_complaint'::text, 'reply_received'::text, 'unsubscribe'::text, 'conversion'::text])),
  faa_pilot_id uuid,
  message_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT outreach_analytics_events_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_outreach_events_type_time ON public.outreach_analytics_events (event_type, created_at DESC);
