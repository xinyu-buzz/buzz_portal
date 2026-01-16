-- Make category column nullable for non-Buzz providers
ALTER TABLE public.training_courses
ALTER COLUMN category DROP NOT NULL;

COMMENT ON COLUMN public.training_courses.category IS 'Course category - required for Buzz provider, optional for external providers';
