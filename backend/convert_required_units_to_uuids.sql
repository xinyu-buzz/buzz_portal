-- Migration: Convert required_units from unit numbers to UUIDs
-- This migration converts the existing required_units arrays from integer unit numbers to UUIDs

-- Step 1: Add a temporary column to store the new UUID array
ALTER TABLE public.course_tests ADD COLUMN required_units_uuid uuid[];

-- Step 2: Convert existing unit numbers to UUIDs
-- For each test with required_units, we need to look up the UUIDs from course_units table
-- Note: This assumes required units are from the same course as the test
UPDATE public.course_tests
SET required_units_uuid = (
  SELECT array_agg(cu.id ORDER BY cu.unit_number)
  FROM unnest(required_units) AS unit_num
  JOIN public.course_units cu ON cu.unit_number = unit_num::integer AND cu.course_id = course_tests.course_id
  WHERE unit_num IS NOT NULL AND cu.deleted_at IS NULL
)
WHERE required_units IS NOT NULL AND array_length(required_units, 1) > 0;

-- Step 3: Drop the old column and rename the new one
ALTER TABLE public.course_tests DROP COLUMN required_units;
ALTER TABLE public.course_tests RENAME COLUMN required_units_uuid TO required_units;

-- Step 4: Update the column comment if needed (optional)
COMMENT ON COLUMN public.course_tests.required_units IS 'Array of unit UUIDs that are required before taking this test';