-- Auto-complete tests for pilots who already have flight_reviewer or roc_a_examiner badge.
-- Called from frontend after granting the role. SECURITY DEFINER so it can insert
-- test_results on behalf of the pilot (bypasses RLS).

CREATE OR REPLACE FUNCTION public.auto_complete_tests_for_role(
  p_pilot_id uuid,
  p_role_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pilot_region text;
  v_completed_tests int := 0;
  v_already_passed int := 0;
  v_rec record;
  v_next_attempt int;
BEGIN
  -- 0. Authorization: only admins/owners may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin or owner';
  END IF;

  -- 1. Validate role type
  IF p_role_type NOT IN ('flight_reviewer', 'roc_a_examiner') THEN
    RETURN jsonb_build_object(
      'error', 'Invalid role_type. Must be flight_reviewer or roc_a_examiner.',
      'completed_tests', 0,
      'already_passed', 0
    );
  END IF;

  -- 2. Get pilot's selected_region
  SELECT selected_region INTO v_pilot_region
  FROM profiles
  WHERE id = p_pilot_id;

  IF v_pilot_region IS NULL OR v_pilot_region = '' OR v_pilot_region = 'Other' THEN
    RETURN jsonb_build_object(
      'completed_tests', 0,
      'already_passed', 0,
      'pilot_region', v_pilot_region,
      'role_type', p_role_type,
      'skipped', true,
      'reason', 'Pilot has no valid region'
    );
  END IF;

  -- 3. Find qualifying tests and insert results
  FOR v_rec IN
    SELECT ct.id AS test_id, ct.course_id
    FROM course_tests ct
    JOIN training_courses tc ON tc.id = ct.course_id
    JOIN course_enrollments ce ON ce.course_id = tc.id AND ce.pilot_id = p_pilot_id
    WHERE tc.region = v_pilot_region
      AND tc.active = true
      AND tc.deleted_at IS NULL
      AND ct.is_active = true
      AND ct.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM test_results tr
        WHERE tr.test_id = ct.id
          AND tr.pilot_id = p_pilot_id
          AND tr.passed = true
      )
  LOOP
    -- Calculate next attempt number
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
    FROM test_results
    WHERE test_id = v_rec.test_id
      AND pilot_id = p_pilot_id;

    INSERT INTO test_results (
      test_id,
      course_id,
      pilot_id,
      score,
      passed,
      upload_status,
      reviewer_notes,
      attempt_number
    ) VALUES (
      v_rec.test_id,
      v_rec.course_id,
      p_pilot_id,
      100,
      true,
      'approved',
      'Auto-completed: pilot has ' || p_role_type || ' badge',
      v_next_attempt
    );

    v_completed_tests := v_completed_tests + 1;
  END LOOP;

  -- 4. Count already-passed tests (for summary)
  SELECT COUNT(*) INTO v_already_passed
  FROM course_tests ct
  JOIN training_courses tc ON tc.id = ct.course_id
  JOIN course_enrollments ce ON ce.course_id = tc.id AND ce.pilot_id = p_pilot_id
  WHERE tc.region = v_pilot_region
    AND tc.active = true
    AND tc.deleted_at IS NULL
    AND ct.is_active = true
    AND ct.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM test_results tr
      WHERE tr.test_id = ct.id
        AND tr.pilot_id = p_pilot_id
        AND tr.passed = true
    );

  RETURN jsonb_build_object(
    'completed_tests', v_completed_tests,
    'already_passed', v_already_passed,
    'pilot_region', v_pilot_region,
    'role_type', p_role_type
  );
END;
$$;

-- Grant execute to authenticated users (admin calls this via frontend)
GRANT EXECUTE ON FUNCTION public.auto_complete_tests_for_role(uuid, text) TO authenticated;


-- Revoke auto-completed tests when a badge is removed.
-- Only deletes results that were auto-completed (matched by reviewer_notes pattern).
-- Real passes (pilot actually took and passed the test) are left untouched.

CREATE OR REPLACE FUNCTION public.revoke_auto_completed_tests_for_role(
  p_pilot_id uuid,
  p_role_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
  v_other_role text;
  v_has_other_badge boolean;
  v_backfill_result jsonb;
  v_backfill_count int := 0;
BEGIN
  -- Authorization: only admins/owners may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin or owner';
  END IF;

  -- Validate role type
  IF p_role_type NOT IN ('flight_reviewer', 'roc_a_examiner') THEN
    RETURN jsonb_build_object(
      'error', 'Invalid role_type. Must be flight_reviewer or roc_a_examiner.',
      'revoked_tests', 0
    );
  END IF;

  -- Delete only auto-completed results for this role
  DELETE FROM test_results
  WHERE pilot_id = p_pilot_id
    AND reviewer_notes = 'Auto-completed: pilot has ' || p_role_type || ' badge';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- If pilot still holds the OTHER badge, re-run auto-complete for it.
  -- This covers the case where badge A's rows were the only auto-completed rows
  -- and badge B never inserted any (because they already existed). Without this,
  -- revoking badge A would leave badge B with no auto-completed results.
  v_other_role := CASE WHEN p_role_type = 'flight_reviewer'
                       THEN 'roc_a_examiner'
                       ELSE 'flight_reviewer' END;

  SELECT CASE WHEN v_other_role = 'flight_reviewer'
              THEN flight_reviewer
              ELSE roc_a_examiner END
  INTO v_has_other_badge
  FROM pilot_special_roles
  WHERE pilot_id = p_pilot_id;

  IF v_has_other_badge = true THEN
    v_backfill_result := auto_complete_tests_for_role(p_pilot_id, v_other_role);
    v_backfill_count := COALESCE((v_backfill_result->>'completed_tests')::int, 0);
  END IF;

  RETURN jsonb_build_object(
    'revoked_tests', v_deleted_count,
    'backfilled_for_other_role', v_backfill_count,
    'pilot_id', p_pilot_id,
    'role_type', p_role_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_auto_completed_tests_for_role(uuid, text) TO authenticated;


-- Batch function: auto-complete tests for ALL pilots who already have
-- flight_reviewer or roc_a_examiner badges. Run once to backfill existing cases.

CREATE OR REPLACE FUNCTION public.auto_complete_tests_for_all_badged_pilots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_result jsonb;
  v_total_completed int := 0;
  v_pilots_processed int := 0;
BEGIN
  -- Authorization: only admins/owners may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin or owner';
  END IF;

  -- Process all flight reviewers
  FOR v_rec IN
    SELECT pilot_id FROM pilot_special_roles WHERE flight_reviewer = true
  LOOP
    v_result := auto_complete_tests_for_role(v_rec.pilot_id, 'flight_reviewer');
    v_total_completed := v_total_completed + COALESCE((v_result->>'completed_tests')::int, 0);
    v_pilots_processed := v_pilots_processed + 1;
  END LOOP;

  -- Process all ROC-A examiners
  FOR v_rec IN
    SELECT pilot_id FROM pilot_special_roles WHERE roc_a_examiner = true
  LOOP
    v_result := auto_complete_tests_for_role(v_rec.pilot_id, 'roc_a_examiner');
    v_total_completed := v_total_completed + COALESCE((v_result->>'completed_tests')::int, 0);
    v_pilots_processed := v_pilots_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'pilots_processed', v_pilots_processed,
    'total_completed_tests', v_total_completed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_complete_tests_for_all_badged_pilots() TO authenticated;
