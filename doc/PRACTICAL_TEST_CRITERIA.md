# Practical Test Criteria Management

## Overview
Added support for managing practical test criteria with a "More" button similar to multiple choice tests. The implementation reuses the existing `test_questions` database table but adapts the UI terminology and behavior for practical tests.

## Key Differences from Multiple Choice Tests

### Terminology Changes
- **Question** → **Criteria** (what is being evaluated)
- **Options** → **Results** (Pass or Fail only)
- **Answer Options** → **Expected Result**
- **Question Text** → **Criteria Description**
- **Explanation** → **Notes**

### UI/UX Changes
1. Only two result options: **Pass** or **Fail**
2. Radio button selection for expected result instead of multiple options
3. Visual styling: 
   - Pass: Green badge (rgba(74, 124, 89, 0.3))
   - Fail: Red badge (rgba(220, 38, 38, 0.3))
4. Simplified form - no need to add/remove options
5. Table columns adjusted: "Result" instead of "Options"

## Implementation Details

### New Component: `PracticalTestCriteriaManager.tsx`
- Located at: `src/portals/admin/PracticalTestCriteriaManager.tsx`
- Based on `TestQuestionsManager.tsx` but adapted for practical tests
- Stores data in the same `test_questions` table with:
  - `options`: Always `["Pass", "Fail"]`
  - `correct_answer_index`: `0` for Pass, `1` for Fail
  - Other fields remain the same (question_text, question_area, explanation, image_urls, problem_sets)

### Updated Component: `CourseUnitsManager.tsx`
1. Added import for `PracticalTestCriteriaManager`
2. Updated "More" button condition to show for both `multiple_choice` and `practical` test types
3. Added conditional rendering logic to show:
   - `TestQuestionsManager` for multiple choice tests
   - `PracticalTestCriteriaManager` for practical tests

## Features Supported
✅ Add/Edit/Delete criteria
✅ Drag-and-drop reordering
✅ Image attachments with drag-and-drop reordering
✅ Problem set assignments
✅ Criteria area/category organization
✅ Notes/explanation field
✅ Filter by problem set
✅ All backend operations use existing `test_questions` table

## Database Schema
No database changes required! The implementation cleverly reuses the existing table structure:
- The `test_questions` table already supports all needed fields
- The `options` field stores `["Pass", "Fail"]` for practical tests
- The `correct_answer_index` indicates the expected result (0=Pass, 1=Fail)

## How to Use
1. Navigate to Academy Manager
2. Select a course and view its units/tests
3. For any practical test, click the "More" button
4. Add criteria by clicking "+ Add Criteria"
5. Fill in:
   - Criteria number
   - Area/Category (e.g., Pre-flight, Takeoff, Landing)
   - Criteria description
   - Expected result (Pass/Fail)
   - Optional: Notes, images, problem sets
6. Criteria can be reordered via drag-and-drop
7. Edit or delete existing criteria as needed

## Notes
- The backend table name remains `test_questions` for both multiple choice and practical tests
- The component intelligently adapts the UI based on test type
- All existing features like problem sets, images, and drag-and-drop are preserved
- CSV import/export not implemented for practical tests (only for multiple choice)
