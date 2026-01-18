-- Add region and active columns to training_courses table
-- Purpose: Add region-based filtering and active status management for training courses

-- Add region column with check constraint
ALTER TABLE public.training_courses
ADD COLUMN IF NOT EXISTS region text NULL DEFAULT 'Global',
ADD CONSTRAINT training_courses_region_check CHECK (
  region = ANY (
    ARRAY[
      'Canada'::text,
      'USA'::text,
      'UK'::text,
      'Australia'::text,
      'New Zealand'::text,
      'South Africa'::text,
      'Global'::text
    ]
  )
);

-- Add active column with default false
ALTER TABLE public.training_courses
ADD COLUMN IF NOT EXISTS active boolean NULL DEFAULT false;

-- Create index on region for better query performance
CREATE INDEX IF NOT EXISTS idx_training_courses_region ON public.training_courses USING btree (region) TABLESPACE pg_default;

-- Create index on active for better query performance
CREATE INDEX IF NOT EXISTS idx_training_courses_active ON public.training_courses USING btree (active) TABLESPACE pg_default;

-- Update existing records to set region to 'Global' and active to false if NULL
UPDATE public.training_courses
SET region = COALESCE(region, 'Global'),
    active = COALESCE(active, false)
WHERE region IS NULL OR active IS NULL;

-- Add comment to columns
COMMENT ON COLUMN public.training_courses.region IS 'Geographic region where the course is available';
COMMENT ON COLUMN public.training_courses.active IS 'Whether the course is currently active and visible to users';
