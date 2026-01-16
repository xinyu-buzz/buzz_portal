-- Safe migration that ensures backward compatibility with iOS app
-- This approach adds columns with proper defaults to prevent any issues

-- 1. Add external_url column (if not exists) with NULL default
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

-- 2. Make category nullable (if not already) to support external providers
DO $$
BEGIN
  -- Check if category column has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'training_courses' 
    AND column_name = 'category'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.training_courses
    ALTER COLUMN category DROP NOT NULL;
    
    COMMENT ON COLUMN public.training_courses.category IS 'Course category - required for Buzz provider, optional for external providers';
  END IF;
END $$;

-- 3. Add a database-level default for category for backward compatibility
-- This ensures old apps that insert without category still work
ALTER TABLE public.training_courses
ALTER COLUMN category SET DEFAULT 'Mandatory';

-- 4. Verify the changes
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

COMMENT ON TABLE public.training_courses IS 'Training courses table - supports both Buzz and external provider courses. Schema version compatible with iOS app v1.x';
