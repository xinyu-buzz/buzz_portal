-- ============================================================================
-- COURSE COVER IMAGE FEATURE - COMPLETE SQL MIGRATION
-- ============================================================================
-- Run this entire file in your Supabase SQL Editor to set up the feature
-- ============================================================================

-- ============================================================================
-- PART 1: Add cover_image_url column to training_courses table
-- ============================================================================

ALTER TABLE public.training_courses
ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN public.training_courses.cover_image_url 
IS 'URL to the course cover image stored in Supabase Storage';

-- ============================================================================
-- PART 2: Storage Bucket Setup
-- ============================================================================
-- NOTE: Due to permissions, the bucket must be created via Supabase Dashboard
-- 
-- Go to: Storage > New Bucket
-- Settings:
--   - Name: course-covers
--   - Public: YES (check this box)
--   - File size limit: 5242880 (5MB)
--   - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp, image/gif
--
-- After creating the bucket, the policies will be automatically set up by Supabase.
-- If you need custom policies, set them in the Storage > Policies section.
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_courses' AND column_name = 'cover_image_url';

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. Run this SQL file (should succeed now)
-- 2. Go to Supabase Dashboard > Storage > New Bucket
-- 3. Create bucket with these settings:
--    - Name: course-covers
--    - Public: YES
--    - File size limit: 5242880 (5MB in bytes)
--    - Allowed MIME types: image/jpeg,image/jpg,image/png,image/webp,image/gif
-- 4. Done! Test by creating a course with a cover image
-- ============================================================================

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- Uncomment and run the following if you need to revert the changes:

-- ALTER TABLE public.training_courses DROP COLUMN IF EXISTS cover_image_url;

-- To delete the bucket: Go to Supabase Dashboard > Storage > course-covers > Delete
-- Warning: This will delete all uploaded images!

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- Column added successfully!
-- 
-- NEXT: Create the storage bucket manually in Supabase Dashboard
-- 1. Go to Storage section
-- 2. Click "New Bucket"  
-- 3. Name: course-covers
-- 4. Public: YES (check the box)
-- 5. Click "Create bucket"
-- 6. After creation, click on the bucket > Configuration
-- 7. Set file size limit: 5242880 (5MB)
-- 8. Set allowed MIME types: image/jpeg,image/jpg,image/png,image/webp,image/gif
-- ============================================================================
