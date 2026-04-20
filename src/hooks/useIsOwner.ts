import { useEffect, useState } from "react";
import { supabaseClient } from "../utility";

const OWNER_EMAIL = "xf@buzzbuzzin.com";

// Returns true only when the currently signed-in user's email matches the
// single owner email. Used to gate UI elements that only the owner should
// see (e.g. Pilot Detail page, clickable rows on Pilot Accounts).
// The real security boundary lives in the RPC and RLS policies; this hook
// exists so the UI doesn't expose broken affordances to other admins.
export const useIsOwner = () => {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabaseClient.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const email = data?.user?.email?.toLowerCase() ?? null;
      setIsOwner(email === OWNER_EMAIL);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { isOwner, loading };
};
