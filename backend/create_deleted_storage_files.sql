-- Create table to track storage files that have been moved to the deleted folder
-- This allows us to restore or permanently delete files when needed

CREATE TABLE IF NOT EXISTS deleted_storage_files (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  bucket_name TEXT NOT NULL,
  original_path TEXT NOT NULL,
  deleted_path TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type = ANY (ARRAY['course'::text, 'unit'::text, 'test'::text, 'section'::text, 'question'::text])),
  entity_id UUID NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_by UUID REFERENCES profiles(id),
  CONSTRAINT deleted_storage_files_pkey PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deleted_storage_files_deleted_at ON deleted_storage_files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_storage_files_entity ON deleted_storage_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deleted_storage_files_bucket ON deleted_storage_files(bucket_name);

-- Add comments
COMMENT ON TABLE deleted_storage_files IS 'Tracks storage files that have been moved to deleted folder for 30-day recycle bin';
COMMENT ON COLUMN deleted_storage_files.bucket_name IS 'Supabase storage bucket name';
COMMENT ON COLUMN deleted_storage_files.original_path IS 'Original file path before deletion';
COMMENT ON COLUMN deleted_storage_files.deleted_path IS 'Path in deleted folder';
COMMENT ON COLUMN deleted_storage_files.entity_type IS 'Type of entity (course, unit, test, section, question)';
COMMENT ON COLUMN deleted_storage_files.entity_id IS 'ID of the entity that owns this file';
