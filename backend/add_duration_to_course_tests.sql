-- Add duration column to course_tests table
-- Duration is stored in minutes, default is 60 minutes

ALTER TABLE public.course_tests
ADD COLUMN IF NOT EXISTS duration integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN public.course_tests.duration IS 'Test duration in minutes. Default is 60 minutes.';

-- Optional: Update existing tests to have 60 minutes duration if needed
-- This is not necessary since we're using DEFAULT, but included for clarity
-- UPDATE public.course_tests SET duration = 60 WHERE duration IS NULL;
