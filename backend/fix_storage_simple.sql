-- Simple fix: Drop all storage policies and create permissive ones
-- Run this in Supabase SQL Editor

-- 1. First, list ALL current policies on storage.objects to see what exists
SELECT policyname, cmd, permissive FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 2. Drop ALL policies on storage.objects (clean slate)
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

-- 3. Create simple, working policies for booking-media bucket

-- Allow authenticated users to upload to booking-media if they're associated with the booking
CREATE POLICY "booking_media_insert_v2" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 
        FROM public.bookings b
        LEFT JOIN public.booking_crew bc ON bc.booking_id = b.id
        LEFT JOIN public.booking_editors be ON be.booking_id = b.id
        WHERE b.id = (string_to_array(name, '/'))[2]::uuid
          AND (
            b.customer_id = auth.uid()
            OR b.pilot_id = auth.uid()
            OR bc.pilot_id = auth.uid()
            OR be.editor_id = auth.uid()
          )
    )
);

-- Allow authenticated users to read from booking-media if they're associated with the booking
CREATE POLICY "booking_media_select_v2" ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 
        FROM public.bookings b
        LEFT JOIN public.booking_crew bc ON bc.booking_id = b.id
        LEFT JOIN public.booking_editors be ON be.booking_id = b.id
        WHERE b.id = (string_to_array(name, '/'))[2]::uuid
          AND (
            b.customer_id = auth.uid()
            OR b.pilot_id = auth.uid()
            OR bc.pilot_id = auth.uid()
            OR be.editor_id = auth.uid()
          )
    )
);

-- Allow delete
CREATE POLICY "booking_media_delete_v2" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'booking-media'
    AND EXISTS (
        SELECT 1 
        FROM public.bookings b
        LEFT JOIN public.booking_crew bc ON bc.booking_id = b.id
        LEFT JOIN public.booking_editors be ON be.booking_id = b.id
        WHERE b.id = (string_to_array(name, '/'))[2]::uuid
          AND (
            b.customer_id = auth.uid()
            OR b.pilot_id = auth.uid()
            OR bc.pilot_id = auth.uid()
            OR be.editor_id = auth.uid()
          )
    )
);

-- 4. Verify new policies
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

