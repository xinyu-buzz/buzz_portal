-- One-time backfill: auto-complete tests for all pilots who already have
-- flight_reviewer or roc_a_examiner badges.
-- Run directly via Supabase SQL editor or MCP (bypasses auth.uid() check).

DO $$
DECLARE
  v_rec record;
  v_pilot_region text;
  v_test record;
  v_next_attempt int;
  v_completed_tests int := 0;
  v_pilots_processed int := 0;
  v_skipped_pilots int := 0;
BEGIN
  -- Process flight reviewers
  FOR v_rec IN
    SELECT psr.pilot_id, 'flight_reviewer' AS role_type
    FROM pilot_special_roles psr
    WHERE psr.flight_reviewer = true
  LOOP
    -- Get pilot region
    SELECT selected_region INTO v_pilot_region
    FROM profiles WHERE id = v_rec.pilot_id;

    IF v_pilot_region IS NULL OR v_pilot_region = '' OR v_pilot_region = 'Other' THEN
      v_skipped_pilots := v_skipped_pilots + 1;
      CONTINUE;
    END IF;

    FOR v_test IN
      SELECT ct.id AS test_id, ct.course_id
      FROM course_tests ct
      JOIN training_courses tc ON tc.id = ct.course_id
      JOIN course_enrollments ce ON ce.course_id = tc.id AND ce.pilot_id = v_rec.pilot_id
      WHERE tc.region = v_pilot_region
        AND tc.active = true
        AND tc.deleted_at IS NULL
        AND ct.is_active = true
        AND ct.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM test_results tr
          WHERE tr.test_id = ct.id
            AND tr.pilot_id = v_rec.pilot_id
            AND tr.passed = true
        )
    LOOP
      SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
      FROM test_results
      WHERE test_id = v_test.test_id AND pilot_id = v_rec.pilot_id;

      INSERT INTO test_results (test_id, course_id, pilot_id, score, passed, upload_status, reviewer_notes, attempt_number)
      VALUES (v_test.test_id, v_test.course_id, v_rec.pilot_id, 100, true, 'approved',
              'Auto-completed: pilot has flight_reviewer badge', v_next_attempt);

      v_completed_tests := v_completed_tests + 1;
    END LOOP;

    v_pilots_processed := v_pilots_processed + 1;
  END LOOP;

  -- Process ROC-A examiners
  FOR v_rec IN
    SELECT psr.pilot_id, 'roc_a_examiner' AS role_type
    FROM pilot_special_roles psr
    WHERE psr.roc_a_examiner = true
  LOOP
    SELECT selected_region INTO v_pilot_region
    FROM profiles WHERE id = v_rec.pilot_id;

    IF v_pilot_region IS NULL OR v_pilot_region = '' OR v_pilot_region = 'Other' THEN
      v_skipped_pilots := v_skipped_pilots + 1;
      CONTINUE;
    END IF;

    FOR v_test IN
      SELECT ct.id AS test_id, ct.course_id
      FROM course_tests ct
      JOIN training_courses tc ON tc.id = ct.course_id
      JOIN course_enrollments ce ON ce.course_id = tc.id AND ce.pilot_id = v_rec.pilot_id
      WHERE tc.region = v_pilot_region
        AND tc.active = true
        AND tc.deleted_at IS NULL
        AND ct.is_active = true
        AND ct.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM test_results tr
          WHERE tr.test_id = ct.id
            AND tr.pilot_id = v_rec.pilot_id
            AND tr.passed = true
        )
    LOOP
      SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
      FROM test_results
      WHERE test_id = v_test.test_id AND pilot_id = v_rec.pilot_id;

      INSERT INTO test_results (test_id, course_id, pilot_id, score, passed, upload_status, reviewer_notes, attempt_number)
      VALUES (v_test.test_id, v_test.course_id, v_rec.pilot_id, 100, true, 'approved',
              'Auto-completed: pilot has roc_a_examiner badge', v_next_attempt);

      v_completed_tests := v_completed_tests + 1;
    END LOOP;

    v_pilots_processed := v_pilots_processed + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % pilots processed, % skipped (no valid region), % tests auto-completed',
    v_pilots_processed, v_skipped_pilots, v_completed_tests;
END;
$$;
