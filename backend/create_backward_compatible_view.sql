-- Create a backward-compatible view for legacy iOS app versions
-- This view excludes new columns to maintain exact schema compatibility

-- Drop the view if it exists
DROP VIEW IF EXISTS public.training_courses_v1;

-- Create view with original schema (without external_url)
CREATE VIEW public.training_courses_v1 AS
SELECT 
  id,
  title,
  description,
  duration,
  level,
  COALESCE(category, 'Mandatory') as category, -- Provide default for null categories
  instructor,
  rating,
  students_count,
  created_at,
  updated_at,
  provider,
  instructor_picture_url,
  requires_uas_ground_school,
  requires_flight_review_passed,
  requires_roc_a_passed
FROM public.training_courses;

COMMENT ON VIEW public.training_courses_v1 IS 'Backward-compatible view for iOS app v1.x - excludes external_url column and ensures category is never null';

-- Grant appropriate permissions (adjust based on your RLS setup)
-- Example: GRANT SELECT ON public.training_courses_v1 TO authenticated;
-- Example: GRANT SELECT ON public.training_courses_v1 TO anon;

-- Verification query - compare structures
SELECT 
  'Original Table' as source,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'training_courses'
UNION ALL
SELECT 
  'Backward Compatible View' as source,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'training_courses_v1'
ORDER BY source, column_name;
