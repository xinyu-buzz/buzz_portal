-- PostgreSQL function to automatically cleanup expired deleted items
-- This should be run daily via a cron job or scheduled task

CREATE OR REPLACE FUNCTION cleanup_expired_deleted_items()
RETURNS void AS $$
DECLARE
  expired_cutoff TIMESTAMP WITH TIME ZONE;
  expired_files_count INTEGER;
BEGIN
  -- Calculate cutoff date (30 days ago)
  expired_cutoff := now() - interval '30 days';
  
  -- Get count of storage files to delete
  SELECT COUNT(*) INTO expired_files_count
  FROM deleted_storage_files
  WHERE deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Cleaning up % expired storage file records', expired_files_count;
  
  -- Delete expired test questions
  DELETE FROM test_questions 
  WHERE deleted_at IS NOT NULL AND deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Deleted expired test questions';
  
  -- Delete expired course tests
  DELETE FROM course_tests 
  WHERE deleted_at IS NOT NULL AND deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Deleted expired course tests';
  
  -- Delete expired course units
  DELETE FROM course_units 
  WHERE deleted_at IS NOT NULL AND deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Deleted expired course units';
  
  -- Delete expired course sections
  DELETE FROM course_sections 
  WHERE deleted_at IS NOT NULL AND deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Deleted expired course sections';
  
  -- Delete expired training courses
  DELETE FROM training_courses 
  WHERE deleted_at IS NOT NULL AND deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Deleted expired training courses';
  
  -- Delete expired storage file tracking records
  -- Note: Actual file deletion from storage should be handled by a separate process
  -- This just removes the tracking records
  DELETE FROM deleted_storage_files 
  WHERE deleted_at < expired_cutoff;
  
  RAISE NOTICE 'Cleanup completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining usage
COMMENT ON FUNCTION cleanup_expired_deleted_items() IS 'Permanently deletes all soft-deleted items older than 30 days. Should be scheduled to run daily.';

-- Example: Schedule to run daily at 2 AM (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-deleted-items', '0 2 * * *', 'SELECT cleanup_expired_deleted_items();');

-- To manually run the cleanup:
-- SELECT cleanup_expired_deleted_items();
