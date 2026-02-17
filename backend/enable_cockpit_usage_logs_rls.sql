-- Enable RLS on cockpit_usage_logs table
-- This allows admins/owners to read all usage logs and users to insert their own

ALTER TABLE public.cockpit_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow users to insert their own usage logs" ON public.cockpit_usage_logs;
DROP POLICY IF EXISTS "Allow users to read their own usage logs" ON public.cockpit_usage_logs;
DROP POLICY IF EXISTS "Allow admins to read all usage logs" ON public.cockpit_usage_logs;

-- Policy 1: Users can insert their own usage logs
CREATE POLICY "Allow users to insert their own usage logs"
ON public.cockpit_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Policy 2: Users can read their own usage logs
CREATE POLICY "Allow users to read their own usage logs"
ON public.cockpit_usage_logs
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Policy 3: Admins and owners can read all usage logs
CREATE POLICY "Allow admins to read all usage logs"
ON public.cockpit_usage_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employee_profiles
    WHERE email = (SELECT auth.jwt() ->> 'email')
    AND role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions
GRANT SELECT ON public.cockpit_usage_logs TO authenticated;
GRANT INSERT ON public.cockpit_usage_logs TO authenticated;
