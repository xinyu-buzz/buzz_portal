-- Add deleted_at and deleted_by to track soft deletes
-- This migration adds soft delete functionality to all academy tables

-- Add columns to training_courses
ALTER TABLE training_courses 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Add columns to course_sections
ALTER TABLE course_sections 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Add columns to course_units
ALTER TABLE course_units 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Add columns to course_tests
ALTER TABLE course_tests 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Add columns to test_questions
ALTER TABLE test_questions 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_courses_deleted_at ON training_courses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_course_sections_deleted_at ON course_sections(deleted_at);
CREATE INDEX IF NOT EXISTS idx_course_units_deleted_at ON course_units(deleted_at);
CREATE INDEX IF NOT EXISTS idx_course_tests_deleted_at ON course_tests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_test_questions_deleted_at ON test_questions(deleted_at);

-- Add comment explaining the soft delete pattern
COMMENT ON COLUMN training_courses.deleted_at IS 'Timestamp when the course was soft-deleted. NULL means not deleted.';
COMMENT ON COLUMN training_courses.deleted_by IS 'User ID who deleted the course.';
