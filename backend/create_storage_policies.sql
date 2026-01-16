-- ============================================================================
-- STORAGE POLICIES FOR course-covers BUCKET
-- ============================================================================
-- These policies enable authenticated users to upload, update, and delete
-- course cover images, while allowing public read access.
-- ============================================================================

-- IMPORTANT: Run this as a superuser or with sufficient privileges
-- If you get "must be owner of table objects" error, you need to:
-- 1. Use the Supabase Dashboard: Storage > course-covers > Policies
-- 2. Or contact Supabase support to grant permissions

-- ============================================================================
-- Clean up existing policies (if any)
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_insert_course_covers" ON storage.objects;
DROP POLICY IF EXISTS "public_select_course_covers" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_course_covers" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_course_covers" ON storage.objects;

-- ============================================================================
-- POLICY 1: Allow authenticated users to INSERT files
-- ============================================================================
-- This is the critical policy that was missing and causing the error

CREATE POLICY "authenticated_insert_course_covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-covers');

-- ============================================================================
-- POLICY 2: Allow public to SELECT (read) files
-- ============================================================================
-- This allows anyone to view the course cover images

CREATE POLICY "public_select_course_covers"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-covers');

-- ============================================================================
-- POLICY 3: Allow authenticated users to UPDATE files
-- ============================================================================
-- This allows admins to replace course cover images

CREATE POLICY "authenticated_update_course_covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'course-covers');

-- ============================================================================
-- POLICY 4: Allow authenticated users to DELETE files
-- ============================================================================
-- This allows admins to delete old course cover images when updating

CREATE POLICY "authenticated_delete_course_covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'course-covers');

-- ============================================================================
-- VERIFICATION: Check if policies were created
-- ============================================================================

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
  AND policyname LIKE '%course_covers%'
ORDER BY policyname;

-- ============================================================================
-- Expected output: Should show 4 policies
-- ============================================================================
-- authenticated_delete_course_covers | permissive | {authenticated} | DELETE
-- authenticated_insert_course_covers | permissive | {authenticated} | INSERT
-- authenticated_update_course_covers | permissive | {authenticated} | UPDATE
-- public_select_course_covers        | permissive | {public}        | SELECT
-- ============================================================================

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
-- If you get "ERROR: 42501: must be owner of table objects":
--
-- Option 1: Use Supabase Dashboard (RECOMMENDED)
-- 1. Go to Storage > course-covers > Policies tab
-- 2. Click "New Policy" and create each policy using the UI
--
-- Option 2: Grant permissions (may require Supabase support)
-- ALTER TABLE storage.objects OWNER TO postgres;
-- GRANT ALL ON storage.objects TO authenticated;
--
-- Option 3: Contact Supabase support
-- Ask them to enable storage policy creation for your project
-- ============================================================================
