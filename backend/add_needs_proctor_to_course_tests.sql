-- Add needs_proctor column to course_tests table
-- This column determines whether a test requires a proctor to be present

ALTER TABLE public.course_tests
ADD COLUMN IF NOT EXISTS needs_proctor boolean DEFAULT false;

-- Add a comment to document the column
COMMENT ON COLUMN public.course_tests.needs_proctor IS 'Indicates whether the test requires a proctor to be present during administration';

-- Optional: Update existing practical and oral tests to require a proctor by default
-- Uncomment the following lines if you want to set needs_proctor to true for existing practical/oral tests
-- UPDATE public.course_tests
-- SET needs_proctor = true
-- WHERE test_type IN ('practical', 'oral');
