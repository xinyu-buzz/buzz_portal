-- Convert price_of_schedule from dollars to cents
-- This migration converts the existing dollar values to cents and changes the column type to integer
-- Example: 49.99 dollars becomes 4999 cents

-- Step 1: Update existing values from dollars to cents (multiply by 100)
UPDATE public.course_tests
SET price_of_schedule = price_of_schedule * 100
WHERE price_of_schedule IS NOT NULL;

-- Step 2: Change column type from numeric(10,2) to integer
ALTER TABLE public.course_tests
ALTER COLUMN price_of_schedule TYPE integer USING (price_of_schedule::integer);

-- Step 3: Drop old constraint and add new one for cents (0 to 50000 cents = $0 to $500)
ALTER TABLE public.course_tests
DROP CONSTRAINT IF EXISTS course_tests_price_of_schedule_check;

ALTER TABLE public.course_tests
ADD CONSTRAINT course_tests_price_of_schedule_check 
CHECK (price_of_schedule IS NULL OR (price_of_schedule >= 0 AND price_of_schedule <= 50000));

-- Step 4: Update column comment
COMMENT ON COLUMN public.course_tests.price_of_schedule IS 'Price of Schedule for proctored tests in cents. Required when needs_proctor is true. Must be between 0 and 50000 cents ($0 to $500 USD).';
