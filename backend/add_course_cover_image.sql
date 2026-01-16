-- Add cover_image_url column to training_courses table
ALTER TABLE public.training_courses
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Add comment to the column
COMMENT ON COLUMN public.training_courses.cover_image_url IS 'URL to the course cover image stored in Supabase Storage';
