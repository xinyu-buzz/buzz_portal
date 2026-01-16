-- Enable RLS policies for training_courses table
-- This allows admins/owners to manage courses

-- First, enable RLS on the table (if not already enabled)
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to training_courses" ON public.training_courses;
DROP POLICY IF EXISTS "Allow authenticated users to read training_courses" ON public.training_courses;
DROP POLICY IF EXISTS "Allow admins to manage training_courses" ON public.training_courses;
DROP POLICY IF EXISTS "Allow all operations for service role" ON public.training_courses;

-- Policy 1: Allow everyone to read training courses (public access)
CREATE POLICY "Allow public read access to training_courses"
ON public.training_courses
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated users with admin/owner role to INSERT
CREATE POLICY "Allow admins to insert training_courses"
ON public.training_courses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Policy 3: Allow authenticated users with admin/owner role to UPDATE
CREATE POLICY "Allow admins to update training_courses"
ON public.training_courses
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

-- Policy 4: Allow authenticated users with admin/owner role to DELETE
CREATE POLICY "Allow admins to delete training_courses"
ON public.training_courses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions
GRANT SELECT ON public.training_courses TO anon;
GRANT SELECT ON public.training_courses TO authenticated;
GRANT ALL ON public.training_courses TO authenticated;
