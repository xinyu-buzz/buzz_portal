-- RPC functions for outreach dashboard aggregations
-- Avoids hitting Supabase's default 1000-row limit on client-side queries

-- 1. Pipeline breakdown: counts grouped by enrichment_status and outreach_status
CREATE OR REPLACE FUNCTION public.outreach_pipeline_counts()
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'enrichment', (
      SELECT json_agg(row_to_json(e))
      FROM (
        SELECT enrichment_status AS status, count(*)::int AS count
        FROM public.outreach_faa_pilots
        GROUP BY enrichment_status
        ORDER BY count(*) DESC
      ) e
    ),
    'outreach', (
      SELECT json_agg(row_to_json(o))
      FROM (
        SELECT outreach_status AS status, count(*)::int AS count
        FROM public.outreach_faa_pilots
        GROUP BY outreach_status
        ORDER BY count(*) DESC
      ) o
    )
  );
$$;

-- 2. Top states: counts grouped by state, top 10
CREATE OR REPLACE FUNCTION public.outreach_top_states(lim int DEFAULT 10)
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(json_agg(row_to_json(s)), '[]'::json)
  FROM (
    SELECT coalesce(state, 'Unknown') AS state, count(*)::int AS count
    FROM public.outreach_faa_pilots
    GROUP BY state
    ORDER BY count(*) DESC
    LIMIT lim
  ) s;
$$;
