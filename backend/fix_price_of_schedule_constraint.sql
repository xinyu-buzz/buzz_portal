-- Fix price_of_schedule constraint to accept cents instead of dollars
-- This updates the constraint to allow 0-50000 cents ($0-$500)

-- Drop the old constraint that checked for 0-500 (dollars)
ALTER TABLE public.course_tests
DROP CONSTRAINT IF EXISTS course_tests_price_of_schedule_check;

-- Add new constraint for cents (0 to 50000 cents = $0 to $500)
ALTER TABLE public.course_tests
ADD CONSTRAINT course_tests_price_of_schedule_check 
CHECK (price_of_schedule IS NULL OR (price_of_schedule >= 0 AND price_of_schedule <= 50000));

-- Update column comment
COMMENT ON COLUMN public.course_tests.price_of_schedule IS 'Price of Schedule for proctored tests in cents. Required when needs_proctor is true. Must be between 0 and 50000 cents ($0 to $500 USD).';
