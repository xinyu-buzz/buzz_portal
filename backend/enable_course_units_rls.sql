-- Enable RLS policies for course_units and course_sections tables
-- This allows admins/owners to manage course content

-- Enable RLS on course_sections
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to course_sections" ON public.course_sections;
DROP POLICY IF EXISTS "Allow admins to insert course_sections" ON public.course_sections;
DROP POLICY IF EXISTS "Allow admins to update course_sections" ON public.course_sections;
DROP POLICY IF EXISTS "Allow admins to delete course_sections" ON public.course_sections;

-- Policy 1: Allow everyone to read course sections
CREATE POLICY "Allow public read access to course_sections"
ON public.course_sections
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated admins/owners to INSERT
CREATE POLICY "Allow admins to insert course_sections"
ON public.course_sections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 3: Allow authenticated admins/owners to UPDATE
CREATE POLICY "Allow admins to update course_sections"
ON public.course_sections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 4: Allow authenticated admins/owners to DELETE
CREATE POLICY "Allow admins to delete course_sections"
ON public.course_sections
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions for course_sections
GRANT SELECT ON public.course_sections TO anon;
GRANT SELECT ON public.course_sections TO authenticated;
GRANT ALL ON public.course_sections TO authenticated;

-- Enable RLS on course_units
ALTER TABLE public.course_units ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to course_units" ON public.course_units;
DROP POLICY IF EXISTS "Allow admins to insert course_units" ON public.course_units;
DROP POLICY IF EXISTS "Allow admins to update course_units" ON public.course_units;
DROP POLICY IF EXISTS "Allow admins to delete course_units" ON public.course_units;

-- Policy 1: Allow everyone to read course units
CREATE POLICY "Allow public read access to course_units"
ON public.course_units
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated admins/owners to INSERT
CREATE POLICY "Allow admins to insert course_units"
ON public.course_units
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 3: Allow authenticated admins/owners to UPDATE
CREATE POLICY "Allow admins to update course_units"
ON public.course_units
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 4: Allow authenticated admins/owners to DELETE
CREATE POLICY "Allow admins to delete course_units"
ON public.course_units
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions for course_units
GRANT SELECT ON public.course_units TO anon;
GRANT SELECT ON public.course_units TO authenticated;
GRANT ALL ON public.course_units TO authenticated;

-- Enable RLS on course_tests
ALTER TABLE public.course_tests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to course_tests" ON public.course_tests;
DROP POLICY IF EXISTS "Allow admins to insert course_tests" ON public.course_tests;
DROP POLICY IF EXISTS "Allow admins to update course_tests" ON public.course_tests;
DROP POLICY IF EXISTS "Allow admins to delete course_tests" ON public.course_tests;

-- Policy 1: Allow everyone to read course tests
CREATE POLICY "Allow public read access to course_tests"
ON public.course_tests
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated admins/owners to INSERT
CREATE POLICY "Allow admins to insert course_tests"
ON public.course_tests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 3: Allow authenticated admins/owners to UPDATE
CREATE POLICY "Allow admins to update course_tests"
ON public.course_tests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 4: Allow authenticated admins/owners to DELETE
CREATE POLICY "Allow admins to delete course_tests"
ON public.course_tests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions for course_tests
GRANT SELECT ON public.course_tests TO anon;
GRANT SELECT ON public.course_tests TO authenticated;
GRANT ALL ON public.course_tests TO authenticated;
