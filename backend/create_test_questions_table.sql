-- Create test_questions table for storing individual test questions
-- This allows UI-based question management while maintaining backward compatibility with CSV-based tests

-- Add question_source to course_tests table to track origin
ALTER TABLE public.course_tests
ADD COLUMN IF NOT EXISTS question_source text DEFAULT 'csv'::text
CHECK (question_source = ANY (ARRAY['csv'::text, 'database'::text]));

-- Create test_questions table
CREATE TABLE IF NOT EXISTS public.test_questions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  test_id uuid NOT NULL,
  question_number integer NOT NULL,
  question_area text,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer_index integer NOT NULL CHECK (correct_answer_index >= 0),
  explanation text,
  image_urls text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT test_questions_pkey PRIMARY KEY (id),
  CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.course_tests(id) ON DELETE CASCADE,
  CONSTRAINT test_questions_unique_number_per_test UNIQUE (test_id, question_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id 
ON public.test_questions USING btree (test_id);

CREATE INDEX IF NOT EXISTS idx_test_questions_number 
ON public.test_questions USING btree (test_id, question_number);

-- Enable Row Level Security
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test_questions
-- Allow public read access (students need to view questions)
CREATE POLICY "Enable read access for all users" ON public.test_questions
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert questions
CREATE POLICY "Enable insert for authenticated users" ON public.test_questions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update questions
CREATE POLICY "Enable update for authenticated users" ON public.test_questions
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete questions
CREATE POLICY "Enable delete for authenticated users" ON public.test_questions
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_test_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_test_questions_updated_at_trigger
  BEFORE UPDATE ON public.test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_test_questions_updated_at();
