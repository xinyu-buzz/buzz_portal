-- Storage policies for test question images
-- Images are organized by test: test-{testId}/question-{questionNumber}/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for test question images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload test question images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update test question images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete test question images" ON storage.objects;

-- Public read access for test question images (students need to view)
-- This applies to paths matching: course-materials/test-*/**
CREATE POLICY "Public read access for test question images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-materials' AND
  (storage.foldername(name))[1] LIKE 'test-%'
);

-- Authenticated users can upload test question images
CREATE POLICY "Authenticated users can upload test question images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-materials' AND
  (storage.foldername(name))[1] LIKE 'test-%' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can update test question images
CREATE POLICY "Authenticated users can update test question images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-materials' AND
  (storage.foldername(name))[1] LIKE 'test-%' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'course-materials' AND
  (storage.foldername(name))[1] LIKE 'test-%' AND
  auth.role() = 'authenticated'
);

-- Authenticated users can delete test question images
CREATE POLICY "Authenticated users can delete test question images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-materials' AND
  (storage.foldername(name))[1] LIKE 'test-%' AND
  auth.role() = 'authenticated'
);
