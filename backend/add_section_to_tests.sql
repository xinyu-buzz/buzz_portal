-- Add section_id column to course_tests table
-- This allows tests to be organized into sections, similar to units

ALTER TABLE public.course_tests 
ADD COLUMN IF NOT EXISTS section_id uuid NULL;

-- Add foreign key constraint
ALTER TABLE public.course_tests
ADD CONSTRAINT course_tests_section_id_fkey 
FOREIGN KEY (section_id) 
REFERENCES course_sections (id) 
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_course_tests_section_id 
ON public.course_tests USING btree (section_id);
