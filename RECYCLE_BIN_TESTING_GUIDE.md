# Recycle Bin Implementation - Testing Guide

## Overview
The recycle bin system has been fully implemented. Before deploying to production, please run through these test scenarios to ensure everything works correctly.

## Database Setup

### Step 1: Run Migrations
Execute the following SQL files in your Supabase dashboard in this order:

1. `backend/add_recycle_bin_columns.sql` - Adds soft delete columns to all tables
2. `backend/create_deleted_storage_files.sql` - Creates tracking table for deleted files
3. `backend/cleanup_expired_deleted_items.sql` - Creates cleanup function

### Step 2: Verify Migrations
Check that the following columns exist:
- `training_courses`: `deleted_at`, `deleted_by`
- `course_sections`: `deleted_at`, `deleted_by`
- `course_units`: `deleted_at`, `deleted_by`
- `course_tests`: `deleted_at`, `deleted_by`
- `test_questions`: `deleted_at`, `deleted_by`

Check that the table exists:
- `deleted_storage_files`

## Test Scenarios

### Test 1: Delete a Course with All Children
**Objective:** Verify cascading soft delete

1. Go to Academy Courses
2. Select a course that has sections, units, tests, and questions
3. Click "Delete"
4. Confirm the deletion
5. **Expected Results:**
   - Course disappears from Academy Courses list
   - Course appears in Recycle Bin with "course" type
   - All child sections appear in Recycle Bin
   - All child units appear in Recycle Bin
   - All child tests appear in Recycle Bin
   - All test questions appear in Recycle Bin
   - All have the same `deleted_at` timestamp
   - Days remaining shows 30 days

### Test 2: Delete Individual Section
**Objective:** Verify isolated soft delete

1. Go to a course's Units Manager
2. Delete a section
3. **Expected Results:**
   - Section disappears from units manager
   - Section appears in Recycle Bin with parent course name
   - Units in that section are NOT deleted
   - Only the section is soft-deleted

### Test 3: Delete Individual Unit
**Objective:** Verify unit soft delete with storage handling

1. Go to a course's Units Manager
2. Delete a unit that has PDF materials
3. **Expected Results:**
   - Unit disappears from units manager
   - Unit appears in Recycle Bin
   - "Storage Files" column shows "Yes"
   - Storage files are moved to `deleted/[unit-id]/` folder

### Test 4: Delete Individual Test
**Objective:** Verify test soft delete cascades to questions

1. Go to a course's Units Manager
2. Delete a test
3. **Expected Results:**
   - Test disappears from units manager
   - Test appears in Recycle Bin
   - All questions from that test appear in Recycle Bin
   - All have matching timestamps

### Test 5: Delete Individual Question
**Objective:** Verify question soft delete

1. Go to Test Questions Manager
2. Delete a question
3. **Expected Results:**
   - Question disappears from list
   - Question appears in Recycle Bin
   - Other questions in test remain active

### Test 6: Restore a Course
**Objective:** Verify restore operation restores all children

1. Go to Recycle Bin
2. Find a deleted course
3. Click "Restore"
4. **Expected Results:**
   - Course returns to Academy Courses list
   - Course is marked as `active: true`
   - All child entities remain in recycle bin (they need individual restore)
   - Storage files are moved back to original location

### Test 7: Restore Individual Items
**Objective:** Verify individual item restoration

1. In Recycle Bin, restore a section
2. In Recycle Bin, restore a unit
3. In Recycle Bin, restore a test
4. In Recycle Bin, restore a question
5. **Expected Results:**
   - Each item returns to its respective list
   - `deleted_at` is cleared
   - Items function normally

### Test 8: Permanent Delete
**Objective:** Verify hard delete

1. In Recycle Bin, permanently delete a unit
2. **Expected Results:**
   - Confirmation dialog warns about permanent deletion
   - Unit is removed from database
   - Storage files are permanently deleted from storage
   - Tracking records are removed from `deleted_storage_files`

### Test 9: Storage File Tracking
**Objective:** Verify storage file movement

1. Delete a course with cover image
2. Check storage bucket - file should be in `deleted/[course-id]/` folder
3. Check `deleted_storage_files` table - should have tracking record
4. Restore the course
5. **Expected Results:**
   - File is moved back to original location
   - Tracking record is removed
   - Course cover image displays correctly

### Test 10: Days Remaining Calculation
**Objective:** Verify time-based cleanup warnings

1. In Recycle Bin, check items deleted at different times
2. **Expected Results:**
   - Recently deleted items show ~30 days remaining (green)
   - Items deleted 10-20 days ago show yellow
   - Items deleted 25+ days ago show red
   - Items deleted 30+ days ago show 0 days

### Test 11: Filter by Type
**Objective:** Verify filtering works

1. In Recycle Bin, click each filter button
2. **Expected Results:**
   - "All" shows all items
   - Each type filter shows only items of that type
   - Counts in buttons are accurate

### Test 12: Cleanup Expired Items
**Objective:** Verify automatic cleanup

**Option A - Manual Testing:**
1. In database, manually set `deleted_at` to 31 days ago for a test item
2. In Recycle Bin, click "Clean Up Expired"
3. **Expected Results:**
   - Item is permanently deleted
   - Storage files are removed

**Option B - Scheduled Testing:**
1. Schedule the cleanup function: `SELECT cron.schedule('cleanup-deleted-items', '0 2 * * *', 'SELECT cleanup_expired_deleted_items();');`
2. Wait 30 days or manually trigger: `SELECT cleanup_expired_deleted_items();`
3. **Expected Results:**
   - All items with `deleted_at` older than 30 days are hard deleted

### Test 13: Error Handling
**Objective:** Verify graceful error handling

1. Try to delete without permissions
2. Try to restore/delete while another operation is in progress
3. **Expected Results:**
   - Error messages display clearly
   - No partial deletions
   - UI doesn't break

### Test 14: Query Performance
**Objective:** Verify queries exclude deleted items

1. Check Academy Courses list
2. Check Course Units Manager
3. Check Test Questions Manager
4. **Expected Results:**
   - No deleted items appear in any list
   - Queries are fast (check for index usage)
   - Student-facing pages don't show deleted content

## Edge Cases to Test

1. **Delete a course that's already being viewed by a student** - Student should see it disappear
2. **Restore a course while a student is viewing recycle bin** - Should update properly
3. **Delete multiple items rapidly** - No race conditions
4. **Large course with 100+ units** - Cascade delete completes successfully
5. **Storage bucket permissions** - Ensure files can be moved/restored/deleted

## Performance Checks

1. Check query plans for all load functions - should use indexes on `deleted_at`
2. Verify cascade operations don't timeout on large courses
3. Check storage operations complete in reasonable time

## Security Checks

1. Verify only admins can access Recycle Bin
2. Verify `deleted_by` correctly tracks who deleted items
3. Verify students can't see deleted items through API

## Regression Testing

After all tests pass, verify existing functionality still works:
1. Course enrollment
2. Test taking
3. Unit completion tracking
4. Badge earning
5. Course duplication

## Cleanup

After testing is complete:
1. Remove any test courses/items
2. Clean up recycle bin
3. Verify production database is backed up before migration

## Notes

- The system uses soft deletes by default, so data is never immediately lost
- The 30-day window gives admins time to recover from accidental deletions
- Storage files are moved, not deleted, until final cleanup
- The automatic cleanup function should be scheduled to run daily at 2 AM
