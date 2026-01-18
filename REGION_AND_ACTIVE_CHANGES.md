# Region and Active Columns - Implementation Summary

## Overview
Added two new columns to the `training_courses` table:
1. **Region** - Geographic region assignment for courses
2. **Active** - Boolean flag to control course visibility

## Database Changes

### SQL Migration File
Created: `/backend/add_region_and_active_to_training_courses.sql`

**Region Column:**
- Type: `text`
- Default: `'Global'`
- Allowed values: Canada, USA, UK, Australia, New Zealand, South Africa, Global
- Constraint: `training_courses_region_check`
- Indexed: `idx_training_courses_region`

**Active Column:**
- Type: `boolean`
- Default: `false`
- Purpose: Control whether course is visible to users
- Indexed: `idx_training_courses_active`

### How to Apply Migration
Run the SQL file in your Supabase SQL editor or via psql:
```bash
psql -h your-db-host -U postgres -d postgres -f backend/add_region_and_active_to_training_courses.sql
```

## UI Changes

### Updated File: `src/portals/admin/AcademyCourses.tsx`

#### 1. Type Definition Updates
- Added `region` field to `TrainingCourse` type
- Added `active` field to `TrainingCourse` type
- Added `REGIONS` constant array

#### 2. Filter Section Enhancements
- **New Region Filter**: Added below the Provider filter
- Displays all available regions as clickable pills
- Region filter works independently of other filters
- Updated filter count to include region selection

#### 3. Table Display Updates
- Added **Region** column (displays region name)
- Added **Active** column (shows "Yes"/"No" with color coding)
  - Active courses: Green badge
  - Inactive courses: Gray badge
- Updated colspan from 9 to 11 for empty state

#### 4. Form Updates (Create/Edit Modal)
- **Region Dropdown**: Added as required field
  - Located after External URL field
  - Shows all available regions
  - Default: "Global"

- **Active Checkbox**: Added above Prerequisites section
  - New section: "Course Status"
  - Checkbox label: "Active (Course is visible to users)"
  - Default: `false` for new courses
  - Allows easy toggling of course visibility

#### 5. State Management
- Added `selectedRegion` state for filtering
- Updated `form` state to include `region` and `active`
- Updated `resetForm()` to reset region to "Global" and active to `false`
- Updated `openEdit()` to load region and active values
- Updated both create and update payloads to include region and active

#### 6. Filter Logic
- Updated `filteredRows` to include region filtering
- Updated `clearFilters()` to clear region selection
- Updated `activeFilterCount` to include region

## Features

### Region Filter
- **Location**: Below Provider filter in the filter panel
- **Behavior**: 
  - Click to select/deselect a region
  - Works independently from Provider and Category filters
  - Included in active filter count
  - Cleared with "Clear filters" button

### Active Status
- **Default**: New courses are inactive by default (`active = false`)
- **Display**: Shows in table as colored badge (Green = Yes, Gray = No)
- **Management**: Toggle via checkbox in Create/Edit modal
- **Location**: Above Prerequisites section in the form
- **Purpose**: Allows admins to draft courses before making them visible to users

## User Workflow

### Creating a New Course
1. Click "+ New course"
2. Fill in all required fields
3. Select appropriate **Region** from dropdown (defaults to "Global")
4. Check **Active** checkbox if ready to publish (defaults to unchecked)
5. Set prerequisites if needed
6. Click "Create course"

### Filtering by Region
1. Open filter panel (if closed)
2. Scroll to "Region" section (below "Provider")
3. Click on any region pill to filter by that region
4. Click again to remove filter
5. Use "Clear filters" to reset all filters including region

### Managing Course Status
1. Click "Edit" on any course
2. Find "Course Status" section (above Prerequisites)
3. Check/uncheck "Active" checkbox
4. Click "Update course"
5. Course visibility changes immediately

## Testing Checklist

- [ ] Run SQL migration successfully
- [ ] Create new course with region and active status
- [ ] Verify new course defaults: region="Global", active=false
- [ ] Edit existing course and change region
- [ ] Edit existing course and toggle active status
- [ ] Filter courses by region
- [ ] Verify table displays region and active columns correctly
- [ ] Test combined filters (Provider + Region + Category)
- [ ] Verify active badge colors (green for active, gray for inactive)
- [ ] Test clear filters functionality includes region

## Notes

- Existing courses will be automatically updated to `region='Global'` and `active=false` by the migration
- Region filter is always visible (not dependent on provider selection like Category filter)
- The active status is purely for admin visibility control; implement frontend filtering as needed
- All regions are displayed as full names (not abbreviations)
