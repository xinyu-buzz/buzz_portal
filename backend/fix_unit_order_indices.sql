-- Fix unit order indices to match unit numbers
-- This migration ensures order_index matches the logical order based on unit_number

-- For each course, reorder units by unit_number and set order_index accordingly
WITH ranked_units AS (
  SELECT 
    id,
    course_id,
    unit_number,
    ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY unit_number ASC) as new_order_index
  FROM course_units
)
UPDATE course_units
SET 
  order_index = ranked_units.new_order_index,
  updated_at = NOW()
FROM ranked_units
WHERE course_units.id = ranked_units.id
  AND course_units.order_index != ranked_units.new_order_index;

-- Verify the fix
SELECT 
  course_id,
  unit_number,
  order_index,
  title
FROM course_units
ORDER BY course_id, order_index;
