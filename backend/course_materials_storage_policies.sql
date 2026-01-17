-- ============================================================================
-- STORAGE POLICIES FOR course-materials BUCKET
-- ============================================================================
-- These policies enable authenticated admins to upload, update, and delete
-- course PDF materials, while allowing public read access.
-- ============================================================================

-- IMPORTANT: First create the bucket if it doesn't exist
-- Go to Supabase Dashboard > Storage > Create bucket
-- Bucket name: course-materials
-- Public bucket: Yes (for public read access)
-- File size limit: 10485760 (10MB)
-- Allowed MIME types: application/pdf

-- ============================================================================
-- Clean up existing policies (if any)
-- ============================================================================

DROP POLICY IF EXISTS "public_select_course_materials" ON storage.objects;
DROP POLICY IF EXISTS "admins_insert_course_materials" ON storage.objects;
DROP POLICY IF EXISTS "admins_update_course_materials" ON storage.objects;
DROP POLICY IF EXISTS "admins_delete_course_materials" ON storage.objects;

-- ============================================================================
-- POLICY 1: Allow public to SELECT (read) files
-- ============================================================================
-- This allows anyone to view/download the course PDF materials

CREATE POLICY "public_select_course_materials"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-materials');

-- ============================================================================
-- POLICY 2: Allow authenticated admins/owners to INSERT files
-- ============================================================================

CREATE POLICY "admins_insert_course_materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- ============================================================================
-- POLICY 3: Allow authenticated admins/owners to UPDATE files
-- ============================================================================

CREATE POLICY "admins_update_course_materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- ============================================================================
-- POLICY 4: Allow authenticated admins/owners to DELETE files
-- ============================================================================

CREATE POLICY "admins_delete_course_materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- ============================================================================
-- Grant necessary permissions
-- ============================================================================

GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
