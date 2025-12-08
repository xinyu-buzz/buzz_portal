-- Complete fix for storage policies
-- Run this in Supabase SQL Editor

-- 1. First, let's make sure the bucket exists and is configured correctly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('booking-media', 'booking-media', false, 52428800, NULL)
ON CONFLICT (id) 
DO UPDATE SET public = false;

-- 2. Drop ALL existing policies on storage.objects for our bucket
-- (We'll list common policy names that might exist)
DROP POLICY IF EXISTS "booking_media_read" ON storage.objects;
DROP POLICY IF EXISTS "booking_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "booking_media_update" ON storage.objects;
DROP POLICY IF EXISTS "booking_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;

-- 3. Create fresh storage policies

-- INSERT/UPLOAD policy
CREATE POLICY "booking_media_insert" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'booking-media'
    AND (
        -- Extract booking_id from path: booking/<booking_id>/filename
        -- Path format: booking/UUID/timestamp-filename.ext
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = (split_part(name, '/', 2))::uuid
              AND (
                b.customer_id = auth.uid()
                OR b.pilot_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.booking_crew bc 
                    WHERE bc.booking_id = b.id 
                      AND bc.pilot_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.booking_editors be 
                    WHERE be.booking_id = b.id 
                      AND be.editor_id = auth.uid()
                )
              )
        )
    )
);

-- SELECT/READ policy
CREATE POLICY "booking_media_read" ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.booking_media_files m
        WHERE m.storage_path = storage.objects.name
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = m.booking_id
              AND (
                b.customer_id = auth.uid()
                OR b.pilot_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.booking_crew bc 
                    WHERE bc.booking_id = b.id 
                      AND bc.pilot_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.booking_editors be 
                    WHERE be.booking_id = b.id 
                      AND be.editor_id = auth.uid()
                )
              )
          )
    )
);

-- UPDATE policy (optional)
CREATE POLICY "booking_media_update" ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = (split_part(name, '/', 2))::uuid
          AND (
            b.customer_id = auth.uid()
            OR b.pilot_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.booking_crew bc 
                WHERE bc.booking_id = b.id 
                  AND bc.pilot_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.booking_editors be 
                WHERE be.booking_id = b.id 
                  AND be.editor_id = auth.uid()
            )
          )
    )
);

-- DELETE policy
CREATE POLICY "booking_media_delete" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = (split_part(name, '/', 2))::uuid
          AND (
            b.customer_id = auth.uid()
            OR b.pilot_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.booking_crew bc 
                WHERE bc.booking_id = b.id 
                  AND bc.pilot_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.booking_editors be 
                WHERE be.booking_id = b.id 
                  AND be.editor_id = auth.uid()
            )
          )
    )
);

-- 4. Verify the policies were created
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE 'booking_media%'
ORDER BY policyname;

