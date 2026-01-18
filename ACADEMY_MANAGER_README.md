# Academy Manager - Test Results Management

## Overview
The Academy Manager is a new feature in the admin portal that allows administrators to review and manage test results submitted by students. This is particularly important for non-multiple-choice tests where students need to upload test forms for manual review.

## Features

### 1. Test Result Management
- View all test results across all courses and tests
- Filter by upload status (not_submitted, pending, approved, rejected)
- Filter by test type (multiple_choice, practical, written, oral)
- Search by pilot name, email, test name, or course title

### 2. Review Workflow
For non-multiple-choice tests (practical, written, oral):
- Students upload their test result forms
- Admins review the uploaded files
- Admins can approve or reject submissions
- Approval automatically marks the test as passed
- Rejection automatically marks the test as failed
- Reviewer notes are required for rejections

For multiple-choice tests:
- Results are automatically determined
- Admins can override the pass/fail status if needed

### 3. File Management
- View submitted test result files
- Download files for review
- Files are stored in the `course-test-results` bucket

## Database Schema

### test_results Table
```sql
CREATE TABLE public.test_results (
  id uuid PRIMARY KEY,
  pilot_id uuid NOT NULL REFERENCES profiles(id),
  test_id uuid NOT NULL REFERENCES course_tests(id),
  course_id uuid NOT NULL REFERENCES training_courses(id),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  passed boolean NOT NULL DEFAULT false,
  answers jsonb,
  attempt_number integer DEFAULT 1,
  completed_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  result_file_urls text[] DEFAULT '{}',
  upload_status text DEFAULT 'not_submitted' CHECK (upload_status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  uploaded_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewer_notes text,
  reviewed_by uuid REFERENCES profiles(id)
);
```

### Upload Status Values
- `not_submitted`: Student has not uploaded any files
- `pending`: Student has uploaded files awaiting review
- `approved`: Admin has approved the submission (test passed)
- `rejected`: Admin has rejected the submission (test failed)

## Setup Instructions

### 1. Enable RLS Policies
Run the following SQL file to enable Row Level Security on the test_results table:
```bash
backend/enable_test_results_rls.sql
```

This will:
- Enable RLS on test_results table
- Allow pilots to view/insert/update their own test results
- Allow admins full access to all test results
- Create necessary indexes for performance

### 2. Setup Storage Bucket
Run the following SQL file to create storage policies:
```bash
backend/course_test_results_storage_policies.sql
```

This will:
- Create policies for the `course-test-results` bucket
- Allow pilots to upload their own test result files
- Allow admins full access to all files
- Files should be organized as: `pilot_id/test_id/filename`

You also need to create the bucket in Supabase dashboard:
1. Go to Storage in Supabase dashboard
2. Create a new bucket named `course-test-results`
3. Set it as private (public = false)

### 3. Frontend Integration
The Academy Manager component is already integrated into the admin portal:
- Route: `/admin/academy-manager`
- Component: `src/portals/admin/AcademyManager.tsx`
- Added to dashboard: Admin Dashboard now shows "Academy Manager" card

## Usage

### For Admins
1. Navigate to Admin Portal
2. Click on "Academy Manager" card or menu item
3. View test results with various filters
4. For pending reviews:
   - Click "Review" button
   - View student information and submitted files
   - Add reviewer notes (optional for approval, required for rejection)
   - Click "Approve & Pass" or "Reject & Fail"
5. For multiple-choice tests:
   - Use "Pass" or "Fail" buttons to override automatic results

### For Students (Future Implementation)
Students will need a way to:
1. View their test results
2. Upload test result files for non-multiple-choice tests
3. See review status and reviewer notes

## Test Types

### Multiple Choice
- Automatically graded
- Admin can override pass/fail status
- No file upload required

### Practical, Written, Oral
- Requires manual review
- Student uploads test result form
- Admin reviews and approves/rejects
- Result determines pass/fail status

## Permissions

### Admins/Owners
- Full access to all test results
- Can review, approve, reject submissions
- Can override multiple-choice results
- Can view all submitted files

### Pilots
- Can view their own test results
- Can upload files for their own tests
- Can update their own pending submissions
- Cannot modify review decisions

## API Examples

### Fetch Test Results
```typescript
const { data, error } = await supabaseClient
  .from("test_results")
  .select(`
    *,
    pilot:pilot_id (id, full_name, email),
    test:test_id (id, test_name, test_type),
    course:course_id (id, title)
  `)
  .eq("upload_status", "pending")
  .order("uploaded_at", { ascending: false });
```

### Approve Test Result
```typescript
const { error } = await supabaseClient
  .from("test_results")
  .update({
    upload_status: "approved",
    passed: true,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
    reviewer_notes: notes,
  })
  .eq("id", testResultId);
```

### Upload Test Result File
```typescript
const filePath = `${pilotId}/${testId}/${fileName}`;
const { error } = await supabaseClient.storage
  .from("course-test-results")
  .upload(filePath, file);
```

## Future Enhancements
1. Email notifications for students when their submission is reviewed
2. File preview capabilities (PDF viewer)
3. Bulk review actions
4. Export test results to CSV
5. Analytics dashboard for test performance
6. Automatic reminders for pending reviews
7. Student-facing test submission interface
8. Mobile app integration for test result uploads
