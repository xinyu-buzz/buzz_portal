-- Migration: Add pdf_names column to course_units table
-- This column stores an array of display names for PDFs, matching the order of pdf_url array

-- Add the pdf_names column as jsonb (to store string array)
ALTER TABLE public.course_units
ADD COLUMN IF NOT EXISTS pdf_names jsonb NULL;

-- Add a comment to document the column
COMMENT ON COLUMN public.course_units.pdf_names IS 'Array of display names for PDFs, indexes match pdf_url array';
