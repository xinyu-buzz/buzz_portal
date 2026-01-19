-- Migration: Add material columns to course_units table (if not already present)
-- All materials (PDFs, images, videos, review questions) are stored in unified arrays:
-- - material_urls: Array of URLs for all materials
-- - material_names: Array of display names, matching indices with material_urls
-- - material_types: Array of types ('pdf', 'image', 'video', 'question'), matching indices
--
-- For review questions:
-- - The question data is stored as a JSON file in Supabase storage
-- - The URL to that JSON file is stored in material_urls
-- - The display name is stored in material_names
-- - The type 'question' is stored in material_types

-- Add material columns (these may already exist from previous migrations)
ALTER TABLE public.course_units
ADD COLUMN IF NOT EXISTS material_urls jsonb NULL,
ADD COLUMN IF NOT EXISTS material_names jsonb NULL,
ADD COLUMN IF NOT EXISTS material_types jsonb NULL;

-- Add comments to document the columns
COMMENT ON COLUMN public.course_units.material_urls IS 'Array of URLs for all course materials (PDFs, images, videos, question JSON files)';
COMMENT ON COLUMN public.course_units.material_names IS 'Array of display names for materials, indices match material_urls array';
COMMENT ON COLUMN public.course_units.material_types IS 'Array of material types (pdf, image, video, question), indices match material_urls array';

-- Note: video_urls, video_names, and review_questions columns are NOT needed
-- All data is stored in the unified material_* columns
