-- Test script to verify backward compatibility after migration
-- Run this after applying the migration to ensure everything works

-- ============================================================
-- TEST 1: Verify table structure
-- ============================================================
SELECT '=== TEST 1: Table Structure ===' as test;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'training_courses'
ORDER BY ordinal_position;

-- ============================================================
-- TEST 2: Verify existing data is intact
-- ============================================================
SELECT '=== TEST 2: Existing Data Count ===' as test;

SELECT 
  COUNT(*) as total_courses,
  COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as courses_with_category,
  COUNT(CASE WHEN category IS NULL THEN 1 END) as courses_without_category,
  COUNT(CASE WHEN external_url IS NOT NULL THEN 1 END) as courses_with_external_url
FROM public.training_courses;

-- ============================================================
-- TEST 3: Test Old-Style Query (simulating iOS app)
-- ============================================================
SELECT '=== TEST 3: Old-Style Query (iOS App Simulation) ===' as test;

-- This is what the iOS app currently does
SELECT 
  id,
  title,
  description,
  duration,
  level,
  category,
  instructor,
  provider
FROM public.training_courses
LIMIT 3;

-- ============================================================
-- TEST 4: Test New Insert with External Provider (Web Portal)
-- ============================================================
SELECT '=== TEST 4: New Insert Test (External Provider) ===' as test;

BEGIN;

INSERT INTO public.training_courses (
  title,
  description,
  duration,
  level,
  category,
  instructor,
  provider,
  external_url
) VALUES (
  'TEST - External Course (Red Cross)',
  'This is a test course from external provider',
  '15 hours',
  'Beginner',
  'General',
  'Red Cross Instructor',
  'Red Cross',
  'https://redcross.org/courses/test-course'
);

-- Verify the insert
SELECT 
  id,
  title,
  provider,
  category,
  external_url,
  created_at
FROM public.training_courses
WHERE title LIKE 'TEST - External Course%'
ORDER BY created_at DESC
LIMIT 1;

-- Clean up test data
DELETE FROM public.training_courses 
WHERE title LIKE 'TEST - External Course%';

ROLLBACK;

SELECT 'Test insert successful (rolled back)' as result;

-- ============================================================
-- TEST 5: Test Old Insert with Buzz Provider (iOS App)
-- ============================================================
SELECT '=== TEST 5: Old Insert Test (Buzz Provider) ===' as test;

BEGIN;

-- This is what the iOS app currently does
INSERT INTO public.training_courses (
  title,
  description,
  duration,
  level,
  category,
  instructor,
  provider
) VALUES (
  'TEST - Buzz Course',
  'This is a test course from Buzz',
  '25 hours',
  'Intermediate',
  'Mandatory',
  'Buzz Instructor',
  'Buzz'
);

-- Verify the insert
SELECT 
  id,
  title,
  provider,
  category,
  external_url,
  created_at
FROM public.training_courses
WHERE title LIKE 'TEST - Buzz Course%'
ORDER BY created_at DESC
LIMIT 1;

-- Clean up test data
DELETE FROM public.training_courses 
WHERE title LIKE 'TEST - Buzz Course%';

ROLLBACK;

SELECT 'Test insert successful (rolled back)' as result;

-- ============================================================
-- TEST 6: Test Update Operations
-- ============================================================
SELECT '=== TEST 6: Update Operations Test ===' as test;

BEGIN;

-- Get a test record
CREATE TEMP TABLE test_course_backup AS
SELECT * FROM public.training_courses LIMIT 1;

-- Test old-style update (without new columns)
UPDATE public.training_courses
SET title = 'TEST - Updated Title'
WHERE id = (SELECT id FROM test_course_backup LIMIT 1);

-- Test new-style update (with new columns)
UPDATE public.training_courses
SET 
  external_url = 'https://example.com/course',
  category = NULL
WHERE id = (SELECT id FROM test_course_backup LIMIT 1);

-- Restore original data
UPDATE public.training_courses
SET 
  title = (SELECT title FROM test_course_backup),
  external_url = (SELECT external_url FROM test_course_backup),
  category = (SELECT category FROM test_course_backup)
WHERE id = (SELECT id FROM test_course_backup LIMIT 1);

ROLLBACK;

SELECT 'Update operations successful (rolled back)' as result;

-- ============================================================
-- TEST 7: Verify View (if created)
-- ============================================================
SELECT '=== TEST 7: Backward Compatible View ===' as test;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'training_courses_v1'
  ) THEN
    RAISE NOTICE 'View training_courses_v1 exists';
  ELSE
    RAISE NOTICE 'View training_courses_v1 does not exist (optional)';
  END IF;
END $$;

-- Test view if it exists
SELECT 
  id,
  title,
  category,
  provider
FROM public.training_courses_v1
LIMIT 3;

-- ============================================================
-- FINAL SUMMARY
-- ============================================================
SELECT '=== MIGRATION VERIFICATION SUMMARY ===' as test;

SELECT 
  'Total Courses' as metric,
  COUNT(*)::text as value
FROM public.training_courses
UNION ALL
SELECT 
  'Courses by Provider',
  provider || ': ' || COUNT(*)::text
FROM public.training_courses
GROUP BY provider
UNION ALL
SELECT 
  'Courses with External URL',
  COUNT(*)::text
FROM public.training_courses
WHERE external_url IS NOT NULL
UNION ALL
SELECT 
  'Courses without Category',
  COUNT(*)::text
FROM public.training_courses
WHERE category IS NULL;

SELECT '=== ALL TESTS COMPLETED SUCCESSFULLY ===' as result;
