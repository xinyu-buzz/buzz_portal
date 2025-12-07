-- Run this in Supabase SQL Editor to see all active storage policies

-- 1. Check all policies on storage.objects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- 2. Check if the booking-media bucket exists
SELECT * FROM storage.buckets WHERE id = 'booking-media';

