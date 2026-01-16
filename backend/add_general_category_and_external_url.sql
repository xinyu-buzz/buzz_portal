-- Safe migration for iOS backward compatibility
-- Adds "General" category and external_url with proper defaults

-- Step 1: Add "General" to the category CHECK constraint
ALTER TABLE public.training_courses 
DROP CONSTRAINT IF EXISTS training_courses_category_check;

ALTER TABLE public.training_courses
ADD CONSTRAINT training_courses_category_check 
CHECK (category = ANY (ARRAY['Mandatory'::text, 'Extension'::text, 'Intermediate'::text, 'Advanced'::text, 'Specialized'::text, 'General'::text]));

-- Step 2: Set "General" as the default category (for backward compatibility with iOS)
ALTER TABLE public.training_courses
ALTER COLUMN category SET DEFAULT 'General';

-- Step 3: Add external_url column (if not exists) with NULL default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'training_courses' 
    AND column_name = 'external_url'
  ) THEN
    ALTER TABLE public.training_courses
    ADD COLUMN external_url text DEFAULT NULL;
    
    COMMENT ON COLUMN public.training_courses.external_url IS 'External course URL for non-Buzz providers';
  END IF;
END $$;

-- Step 4: Add helpful comments
COMMENT ON COLUMN public.training_courses.category IS 'Course category - defaults to "General" for external providers, use specific categories for Buzz courses';
COMMENT ON TABLE public.training_courses IS 'Training courses table - supports both Buzz and external provider courses. "General" category used for external providers to maintain iOS compatibility.';

-- Step 5: Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'training_courses'
  AND column_name IN ('category', 'external_url', 'provider')
ORDER BY ordinal_position;
