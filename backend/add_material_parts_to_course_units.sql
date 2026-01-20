-- Migration: Add material_parts and material_part_names columns to course_units table
-- These columns enable grouping course materials into logical parts within a unit
-- material_part_names: Array of part names (e.g., ["Part 1", "Part 2"])
-- material_parts: Array mapping each material to a part index (e.g., ["1", "1", "2", "2", "2"])

-- Add the material_part_names column as jsonb (to store string array of part names)
ALTER TABLE public.course_units
ADD COLUMN IF NOT EXISTS material_part_names jsonb DEFAULT '[]'::jsonb;

-- Add the material_parts column as jsonb (to store string array mapping materials to parts)
ALTER TABLE public.course_units
ADD COLUMN IF NOT EXISTS material_parts jsonb DEFAULT '[]'::jsonb;

-- Add comments to document the columns
COMMENT ON COLUMN public.course_units.material_part_names IS 'Array of part names for grouping materials (e.g., ["Part 1", "Part 2"])';
COMMENT ON COLUMN public.course_units.material_parts IS 'Array mapping each material to a part index (e.g., ["1", "1", "2", "2", "2"] where "1" = Part 1, "2" = Part 2)';