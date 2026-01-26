-- Fix Question Order in Duplicated Course
-- Original course: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- Duplicated course: 126178bb-45b2-4784-bcbf-4646b64fc74a
--
-- This script reorders the questions in the duplicated course's units
-- to match the order of questions in the original course's units.
-- It only affects materials with type 'question', not slides/pdfs/videos.
--
-- HANDLES MODIFIED QUESTIONS:
-- - Questions that match by name are reordered to match original order
-- - Questions that were modified (different names) are preserved and appended at the end
-- - A report shows which questions couldn't be matched for manual review
--
-- NOTE: This version handles JSONB arrays (JavaScript format) stored in the database

-- Create a function to fix the question ordering for a specific unit pair
CREATE OR REPLACE FUNCTION fix_question_order_for_unit(
    original_unit_id UUID,
    duplicated_unit_id UUID
) RETURNS TABLE(unmatched_original text, unmatched_duplicated text) AS $$
DECLARE
    orig_urls jsonb;
    orig_names jsonb;
    orig_types jsonb;
    orig_parts jsonb;
    dup_urls jsonb;
    dup_names jsonb;
    dup_types jsonb;
    dup_parts jsonb;
    new_urls jsonb := '[]'::jsonb;
    new_names jsonb := '[]'::jsonb;
    new_types jsonb := '[]'::jsonb;
    new_parts jsonb := '[]'::jsonb;
    i int;
    j int;
    orig_len int;
    dup_len int;
    matched boolean;
    used_indices int[] := '{}';
    unmatched_orig_names text[] := '{}';
    unmatched_dup_names text[] := '{}';
    orig_url text;
    orig_name text;
    orig_type text;
    orig_part text;
    dup_url text;
    dup_name text;
    dup_type text;
    dup_part text;
BEGIN
    -- Get original unit's materials as JSONB
    SELECT 
        COALESCE(material_urls::jsonb, '[]'::jsonb),
        COALESCE(material_names::jsonb, '[]'::jsonb),
        COALESCE(material_types::jsonb, '[]'::jsonb),
        COALESCE(material_parts::jsonb, '[]'::jsonb)
    INTO orig_urls, orig_names, orig_types, orig_parts
    FROM course_units
    WHERE id = original_unit_id;

    -- Get duplicated unit's materials as JSONB
    SELECT 
        COALESCE(material_urls::jsonb, '[]'::jsonb),
        COALESCE(material_names::jsonb, '[]'::jsonb),
        COALESCE(material_types::jsonb, '[]'::jsonb),
        COALESCE(material_parts::jsonb, '[]'::jsonb)
    INTO dup_urls, dup_names, dup_types, dup_parts
    FROM course_units
    WHERE id = duplicated_unit_id;

    orig_len := jsonb_array_length(orig_urls);
    dup_len := jsonb_array_length(dup_urls);

    -- First, add all NON-question materials from duplicated (preserve their order)
    FOR i IN 0..dup_len-1 LOOP
        dup_type := dup_types->>i;
        IF dup_type IS NULL OR dup_type != 'question' THEN
            new_urls := new_urls || jsonb_build_array(dup_urls->>i);
            new_names := new_names || jsonb_build_array(dup_names->>i);
            new_types := new_types || jsonb_build_array(dup_type);
            new_parts := new_parts || jsonb_build_array(COALESCE(dup_parts->>i, ''));
        END IF;
    END LOOP;

    -- Now process questions: iterate through original questions in order
    -- and try to find matching questions in duplicated by name
    FOR i IN 0..orig_len-1 LOOP
        orig_type := orig_types->>i;
        IF orig_type = 'question' THEN
            orig_name := orig_names->>i;
            orig_part := COALESCE(orig_parts->>i, '');
            matched := false;
            
            -- Try to find this question in duplicated by name
            FOR j IN 0..dup_len-1 LOOP
                dup_type := dup_types->>j;
                dup_name := dup_names->>j;
                
                -- Check if this index was already used and if it's a question with matching name
                IF NOT ((j+1) = ANY(used_indices)) 
                   AND dup_type = 'question' 
                   AND dup_name = orig_name THEN
                    -- Found a match! Add the DUPLICATED question (preserving any modifications to URL)
                    new_urls := new_urls || jsonb_build_array(dup_urls->>j);
                    new_names := new_names || jsonb_build_array(dup_name);
                    new_types := new_types || jsonb_build_array('question');
                    -- Use the part assignment from the ORIGINAL to fix the ordering
                    new_parts := new_parts || jsonb_build_array(orig_part);
                    used_indices := array_append(used_indices, j+1);
                    matched := true;
                    EXIT;
                END IF;
            END LOOP;
            
            IF NOT matched THEN
                unmatched_orig_names := array_append(unmatched_orig_names, orig_name);
            END IF;
        END IF;
    END LOOP;

    -- Add any remaining questions from duplicated that weren't matched (modified questions)
    FOR j IN 0..dup_len-1 LOOP
        dup_type := dup_types->>j;
        IF dup_type = 'question' AND NOT ((j+1) = ANY(used_indices)) THEN
            dup_name := dup_names->>j;
            new_urls := new_urls || jsonb_build_array(dup_urls->>j);
            new_names := new_names || jsonb_build_array(dup_name);
            new_types := new_types || jsonb_build_array('question');
            new_parts := new_parts || jsonb_build_array(COALESCE(dup_parts->>j, ''));
            unmatched_dup_names := array_append(unmatched_dup_names, dup_name);
        END IF;
    END LOOP;

    -- Update the duplicated unit with the reordered materials
    UPDATE course_units
    SET 
        material_urls = new_urls,
        material_names = new_names,
        material_types = new_types,
        material_parts = new_parts,
        updated_at = NOW()
    WHERE id = duplicated_unit_id;

    -- Return unmatched questions for review
    RETURN QUERY SELECT 
        array_to_string(unmatched_orig_names, ', ') as unmatched_original,
        array_to_string(unmatched_dup_names, ', ') as unmatched_duplicated;
END;
$$ LANGUAGE plpgsql;

-- Create a table to store the results for review
DROP TABLE IF EXISTS _fix_question_order_report;
CREATE TEMP TABLE _fix_question_order_report (
    unit_title text,
    original_unit_id uuid,
    duplicated_unit_id uuid,
    unmatched_in_original text,
    unmatched_in_duplicated text,
    status text
);

-- Now execute the fix for all matching units between original and duplicated course
DO $$
DECLARE
    orig_unit RECORD;
    dup_unit RECORD;
    fix_result RECORD;
    fixed_count int := 0;
BEGIN
    -- Loop through each unit in the original course
    FOR orig_unit IN 
        SELECT id, title, unit_number, order_index
        FROM course_units 
        WHERE course_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        ORDER BY order_index
    LOOP
        -- Find the matching unit in the duplicated course by title
        -- Handle "(Copy)" suffix that might have been added during duplication
        SELECT id, title INTO dup_unit
        FROM course_units
        WHERE course_id = '126178bb-45b2-4784-bcbf-4646b64fc74a'
        AND (title = orig_unit.title OR title = orig_unit.title || ' (Copy)')
        LIMIT 1;

        IF dup_unit.id IS NOT NULL THEN
            -- Run the fix and capture results
            SELECT * INTO fix_result 
            FROM fix_question_order_for_unit(orig_unit.id, dup_unit.id);
            
            INSERT INTO _fix_question_order_report 
            VALUES (
                orig_unit.title,
                orig_unit.id,
                dup_unit.id,
                fix_result.unmatched_original,
                fix_result.unmatched_duplicated,
                CASE 
                    WHEN (fix_result.unmatched_original IS NULL OR fix_result.unmatched_original = '')
                         AND (fix_result.unmatched_duplicated IS NULL OR fix_result.unmatched_duplicated = '')
                    THEN 'OK - All questions matched'
                    ELSE 'NEEDS REVIEW - Some questions unmatched'
                END
            );
            
            fixed_count := fixed_count + 1;
        ELSE
            INSERT INTO _fix_question_order_report 
            VALUES (
                orig_unit.title,
                orig_unit.id,
                NULL,
                NULL,
                NULL,
                'SKIPPED - No matching unit in duplicated course'
            );
        END IF;
    END LOOP;

    RAISE NOTICE 'Processed % units', fixed_count;
END $$;

-- Show the report
SELECT '=== FIX QUESTION ORDER REPORT ===' as report;

SELECT 
    unit_title,
    status,
    CASE WHEN unmatched_in_original != '' THEN 'Original questions not found in duplicate: ' || unmatched_in_original ELSE NULL END as original_unmatched,
    CASE WHEN unmatched_in_duplicated != '' THEN 'Duplicate questions not found in original (appended at end): ' || unmatched_in_duplicated ELSE NULL END as duplicate_unmatched
FROM _fix_question_order_report
ORDER BY 
    CASE status 
        WHEN 'NEEDS REVIEW - Some questions unmatched' THEN 1 
        WHEN 'SKIPPED - No matching unit in duplicated course' THEN 2
        ELSE 3 
    END,
    unit_title;

-- Summary
SELECT 
    status,
    COUNT(*) as unit_count
FROM _fix_question_order_report
GROUP BY status;

-- Clean up the function after use
DROP FUNCTION IF EXISTS fix_question_order_for_unit(UUID, UUID);

-- Verify the results by comparing question counts and listing questions
SELECT '=== VERIFICATION: Question counts per unit ===' as verification;

SELECT 
    'Original' as course,
    cu.title as unit_title,
    jsonb_array_length(cu.material_urls::jsonb) as total_materials,
    (SELECT COUNT(*) FROM jsonb_array_elements_text(cu.material_types::jsonb) t WHERE t = 'question') as question_count
FROM course_units cu
WHERE cu.course_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY cu.order_index;

SELECT 
    'Duplicated' as course,
    cu.title as unit_title,
    jsonb_array_length(cu.material_urls::jsonb) as total_materials,
    (SELECT COUNT(*) FROM jsonb_array_elements_text(cu.material_types::jsonb) t WHERE t = 'question') as question_count
FROM course_units cu
WHERE cu.course_id = '126178bb-45b2-4784-bcbf-4646b64fc74a'
ORDER BY cu.order_index;
