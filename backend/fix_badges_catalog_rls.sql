-- Fix RLS policies for badges_catalog table
-- This allows the trigger function to sync data from training_courses

-- Enable RLS on badges_catalog (if not already enabled)
ALTER TABLE public.badges_catalog ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to badges_catalog" ON public.badges_catalog;
DROP POLICY IF EXISTS "Allow admins to manage badges_catalog" ON public.badges_catalog;
DROP POLICY IF EXISTS "Allow service role all access to badges_catalog" ON public.badges_catalog;

-- Policy 1: Allow everyone to read badges catalog
CREATE POLICY "Allow public read access to badges_catalog"
ON public.badges_catalog
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated admins/owners to INSERT
CREATE POLICY "Allow admins to insert badges_catalog"
ON public.badges_catalog
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
CREATE POLICY "Allow admins to update badges_catalog"
ON public.badges_catalog
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
CREATE POLICY "Allow admins to delete badges_catalog"
ON public.badges_catalog
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
GRANT SELECT ON public.badges_catalog TO anon;
GRANT SELECT ON public.badges_catalog TO authenticated;
GRANT ALL ON public.badges_catalog TO authenticated;

-- IMPORTANT: Check if the trigger function exists and fix it if needed
-- The trigger function should be SECURITY DEFINER so it bypasses RLS
-- Run this to check the function:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'sync_course_to_badge_catalog';

-- If the function doesn't have SECURITY DEFINER, you'll need to recreate it with:
-- CREATE OR REPLACE FUNCTION sync_course_to_badge_catalog()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER  -- This is key!
-- AS $$
-- BEGIN
--   -- Your function logic here
-- END;
-- $$;
