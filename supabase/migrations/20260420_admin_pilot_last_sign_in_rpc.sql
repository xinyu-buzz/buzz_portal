-- RPC that returns auth.users.last_sign_in_at for a given pilot.
-- Access is restricted to a single owner email (xf@buzzbuzzin.com) because
-- the Pilot Detail page exposes sensitive activity/location info and we do
-- not want other admins to see it.

CREATE OR REPLACE FUNCTION public.admin_get_pilot_last_sign_in(p_pilot_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.last_sign_in_at
  FROM auth.users u
  WHERE u.id = p_pilot_id
    AND EXISTS (
      SELECT 1
      FROM auth.users caller
      WHERE caller.id = auth.uid()
        AND lower(caller.email) = 'xf@buzzbuzzin.com'
    );
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_pilot_last_sign_in(uuid) TO authenticated;
