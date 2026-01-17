-- Add prerequisite_tests column to course_units table
-- This allows units to require tests to be passed before they can be accessed

ALTER TABLE public.course_units 
ADD COLUMN IF NOT EXISTS prerequisite_tests uuid[] NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.course_units.prerequisite_tests IS 'Array of test IDs that must be passed before this unit can be accessed';

-- Create index for better query performance when checking test prerequisites
CREATE INDEX IF NOT EXISTS idx_course_units_prerequisite_tests 
ON public.course_units USING gin (prerequisite_tests);
