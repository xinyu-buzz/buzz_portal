-- Add problem_sets column to test_questions table
-- This allows questions to be assigned to multiple numbered problem sets
-- for randomized test delivery while maintaining backward compatibility

-- Add problem_sets column (nullable for backward compatibility)
ALTER TABLE public.test_questions
ADD COLUMN IF NOT EXISTS problem_sets integer[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.test_questions.problem_sets IS 'Array of problem set numbers this question belongs to. NULL or empty array means not assigned to any specific set. Allows multiple set membership for exam randomization.';

-- Create GIN index for efficient filtering by problem set
CREATE INDEX IF NOT EXISTS idx_test_questions_problem_sets 
ON public.test_questions USING gin (problem_sets);
