-- TEST: Create a very permissive policy to verify storage works at all
-- Run this in Supabase SQL Editor

-- 1. Drop all existing storage policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 2. Create a simple permissive policy: any authenticated user can upload to booking-media
CREATE POLICY "booking_media_allow_authenticated_insert" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'booking-media');

CREATE POLICY "booking_media_allow_authenticated_select" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'booking-media');

CREATE POLICY "booking_media_allow_authenticated_delete" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'booking-media');

CREATE POLICY "booking_media_allow_authenticated_update" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'booking-media');

-- 3. Verify
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

