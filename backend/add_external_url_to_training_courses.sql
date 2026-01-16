-- Add external_url column to training_courses table
ALTER TABLE public.training_courses
ADD COLUMN external_url text;

COMMENT ON COLUMN public.training_courses.external_url IS 'External course URL for non-Buzz providers';
