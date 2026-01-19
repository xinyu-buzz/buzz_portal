-- Add price_of_schedule column to course_tests table
-- Price of Schedule is required when needs_proctor is true
-- Value can be any non-negative number from 0 to 500

ALTER TABLE public.course_tests
ADD COLUMN IF NOT EXISTS price_of_schedule numeric(10, 2);

-- Add constraint to ensure price is between 0 and 500
ALTER TABLE public.course_tests
ADD CONSTRAINT course_tests_price_of_schedule_check 
CHECK (price_of_schedule IS NULL OR (price_of_schedule >= 0 AND price_of_schedule <= 500));

COMMENT ON COLUMN public.course_tests.price_of_schedule IS 'Price of Schedule for proctored tests. Required when needs_proctor is true. Must be between 0 and 500.';
