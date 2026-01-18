-- Assign ROC-A exam questions to 4 problem sets
-- Questions 1-25: Set 1
-- Questions 26-50: Set 2
-- Questions 51-75: Set 3
-- Questions 76-100: Set 4

-- First, find your ROC-A test_id by running:
-- SELECT id, test_name FROM course_tests WHERE test_name ILIKE '%ROC-A%';

-- Then replace 'YOUR_TEST_ID_HERE' below with the actual test_id

-- Assign questions 1-25 to Set 1
UPDATE public.test_questions
SET problem_sets = ARRAY[1]
WHERE test_id = 'YOUR_TEST_ID_HERE'
  AND question_number BETWEEN 1 AND 25;

-- Assign questions 26-50 to Set 2
UPDATE public.test_questions
SET problem_sets = ARRAY[2]
WHERE test_id = 'YOUR_TEST_ID_HERE'
  AND question_number BETWEEN 26 AND 50;

-- Assign questions 51-75 to Set 3
UPDATE public.test_questions
SET problem_sets = ARRAY[3]
WHERE test_id = 'YOUR_TEST_ID_HERE'
  AND question_number BETWEEN 51 AND 75;

-- Assign questions 76-100 to Set 4
UPDATE public.test_questions
SET problem_sets = ARRAY[4]
WHERE test_id = 'YOUR_TEST_ID_HERE'
  AND question_number BETWEEN 76 AND 100;

-- Verify the assignment
SELECT 
  UNNEST(problem_sets) as set_number,
  COUNT(*) as question_count,
  MIN(question_number) as first_question,
  MAX(question_number) as last_question
FROM public.test_questions
WHERE test_id = 'YOUR_TEST_ID_HERE'
  AND problem_sets IS NOT NULL
GROUP BY UNNEST(problem_sets)
ORDER BY set_number;
