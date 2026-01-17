-- Storage policies for course-test-results bucket
-- Allows pilots to upload test result files and admins to manage them

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow pilots to upload their own test result files" ON storage.objects;
DROP POLICY IF EXISTS "Allow pilots to read their own test result files" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins full access to test result files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read test result files" ON storage.objects;

-- Policy 1: Pilots can upload their own test result files
-- Files should be organized as: pilot_id/test_id/filename
CREATE POLICY "Allow pilots to upload their own test result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-test-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Pilots can read their own test result files
CREATE POLICY "Allow pilots to read their own test result files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-test-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Pilots can update/delete their own test result files (before review)
CREATE POLICY "Allow pilots to update their own test result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-test-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'course-test-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow pilots to delete their own test result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-test-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Admins and owners have full access to all test result files
CREATE POLICY "Allow admins full access to test result files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'course-test-results' AND
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'owner')
  )
);

-- Create the bucket if it doesn't exist
-- Note: This should be run in the Supabase dashboard or via the admin API
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('course-test-results', 'course-test-results', false)
-- ON CONFLICT (id) DO NOTHING;
