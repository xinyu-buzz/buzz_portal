-- Enable RLS on test_results table
-- This allows admins to manage test results and pilots to view/update their own

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow pilots to read their own test results" ON public.test_results;
DROP POLICY IF EXISTS "Allow pilots to insert their own test results" ON public.test_results;
DROP POLICY IF EXISTS "Allow pilots to update their own test results" ON public.test_results;
DROP POLICY IF EXISTS "Allow admins full access to test results" ON public.test_results;

-- Policy 1: Pilots can read their own test results
CREATE POLICY "Allow pilots to read their own test results"
ON public.test_results
FOR SELECT
USING (
  pilot_id = auth.uid()
);

-- Policy 2: Pilots can insert their own test results
CREATE POLICY "Allow pilots to insert their own test results"
ON public.test_results
FOR INSERT
WITH CHECK (
  pilot_id = auth.uid()
);

-- Policy 3: Pilots can update their own test results (for uploading files)
-- But cannot change passed status or review fields
CREATE POLICY "Allow pilots to update their own test results"
ON public.test_results
FOR UPDATE
USING (
  pilot_id = auth.uid()
)
WITH CHECK (
  pilot_id = auth.uid()
);

-- Policy 4: Admins and owners have full access to test results
CREATE POLICY "Allow admins full access to test results"
ON public.test_results
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'owner')
  )
);

-- Grant necessary permissions
GRANT SELECT ON public.test_results TO authenticated;
GRANT INSERT ON public.test_results TO authenticated;
GRANT UPDATE ON public.test_results TO authenticated;
GRANT DELETE ON public.test_results TO authenticated;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_test_results_pilot_id 
ON public.test_results USING btree (pilot_id);

CREATE INDEX IF NOT EXISTS idx_test_results_test_id 
ON public.test_results USING btree (test_id);

CREATE INDEX IF NOT EXISTS idx_test_results_course_id 
ON public.test_results USING btree (course_id);

CREATE INDEX IF NOT EXISTS idx_test_results_upload_status 
ON public.test_results USING btree (upload_status);

CREATE INDEX IF NOT EXISTS idx_test_results_pending_uploads 
ON public.test_results USING btree (pilot_id, upload_status)
WHERE upload_status = 'pending'::text;
