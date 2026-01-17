-- Add prerequisite_units column to course_units table
-- This allows units to require completion of other units before they can be accessed

ALTER TABLE public.course_units 
ADD COLUMN IF NOT EXISTS prerequisite_units integer[] NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.course_units.prerequisite_units IS 'Array of unit_numbers that must be completed before this unit can be accessed';

-- Create index for better query performance when checking prerequisites
CREATE INDEX IF NOT EXISTS idx_course_units_prerequisite_units 
ON public.course_units USING gin (prerequisite_units);
