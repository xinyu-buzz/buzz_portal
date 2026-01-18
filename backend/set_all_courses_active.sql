-- Set all existing courses to active
-- Purpose: Update all training courses to be active (visible to users)

UPDATE public.training_courses
SET active = true
WHERE active = false;

-- Verify the update
SELECT 
  COUNT(*) as total_courses,
  COUNT(*) FILTER (WHERE active = true) as active_courses,
  COUNT(*) FILTER (WHERE active = false) as inactive_courses
FROM public.training_courses;
