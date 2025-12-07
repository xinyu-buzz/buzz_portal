-- Migration for editor assignments and booking media tracking
-- Run in Supabase SQL editor (public schema)

-- 1) Table: booking_editors (assignment of editors to bookings)
CREATE TABLE IF NOT EXISTS public.booking_editors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    editor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES public.profiles(id),
    assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT booking_editors_unique UNIQUE (booking_id, editor_id)
);

-- 2) Table: booking_media_files (tracks uploaded files for a booking)
CREATE TABLE IF NOT EXISTS public.booking_media_files (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    role text NOT NULL CHECK (role = ANY(ARRAY['pilot','editor','system'])),
    kind text NOT NULL DEFAULT 'raw' CHECK (kind = ANY(ARRAY['raw','proxy','final','notes'])),
    storage_path text NOT NULL, -- matches storage.objects.name
    file_name text,
    file_size bigint,
    mime_type text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS booking_media_files_booking_id_idx ON public.booking_media_files (booking_id, created_at DESC);

-- 3) Storage bucket for booking media
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-media', 'booking-media', false)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS setup
ALTER TABLE public.booking_editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_media_files ENABLE ROW LEVEL SECURITY;

-- helper predicate for booking membership:
-- user is pilot on booking, in booking_crew, or in booking_editors

-- booking_editors policies
DROP POLICY IF EXISTS "booking_editors_select" ON public.booking_editors;
CREATE POLICY "booking_editors_select" ON public.booking_editors
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "booking_editors_insert" ON public.booking_editors;
CREATE POLICY "booking_editors_insert" ON public.booking_editors
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "booking_editors_delete" ON public.booking_editors;
CREATE POLICY "booking_editors_delete" ON public.booking_editors
FOR DELETE USING (
    auth.uid() IS NOT NULL
);

-- booking_media_files policies (restrict to booking participants)
DROP POLICY IF EXISTS "booking_media_files_select" ON public.booking_media_files;
CREATE POLICY "booking_media_files_select" ON public.booking_media_files
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id
          AND (
            b.pilot_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = auth.uid())
          )
    )
);

DROP POLICY IF EXISTS "booking_media_files_insert" ON public.booking_media_files;
CREATE POLICY "booking_media_files_insert" ON public.booking_media_files
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id
          AND (
            b.pilot_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = auth.uid())
          )
    )
);

-- 5) Storage policies for booking-media bucket
-- Path convention: booking/<booking_id>/<filename>

-- Read: allow if there is a matching booking_media_files row that the user can see
DROP POLICY IF EXISTS "booking_media_read" ON storage.objects;
CREATE POLICY "booking_media_read" ON storage.objects
FOR SELECT USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.booking_media_files m
        WHERE m.storage_path = storage.objects.name
          AND (
            EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.id = m.booking_id
                  AND (
                    b.pilot_id = auth.uid()
                    OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = auth.uid())
                    OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = auth.uid())
                  )
            )
          )
    )
);

-- Upload: allow when path encodes booking id and user is part of the booking
DROP POLICY IF EXISTS "booking_media_insert" ON storage.objects;
CREATE POLICY "booking_media_insert" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = split_part(storage.objects.name, '/', 2)::uuid
          AND (
            b.pilot_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = auth.uid())
          )
    )
);

-- Optional: delete/update by same participants
DROP POLICY IF EXISTS "booking_media_delete" ON storage.objects;
CREATE POLICY "booking_media_delete" ON storage.objects
FOR DELETE USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = split_part(storage.objects.name, '/', 2)::uuid
          AND (
            b.pilot_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.booking_crew bc WHERE bc.booking_id = b.id AND bc.pilot_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.booking_editors be WHERE be.booking_id = b.id AND be.editor_id = auth.uid())
          )
    )
);

-- Note: adjust policies to your exact auth model (e.g., allow service role to manage everything).
