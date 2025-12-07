import { createClient } from "@refinedev/supabase";

const SUPABASE_URL = "https://mzapuczjijqjzdcujetx.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YXB1Y3pqaWpxanpkY3VqZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDkzMjcsImV4cCI6MjA3NzUyNTMyN30.r0DCKvVY5fgDOMj4dv46tOIcsHmeFzV1-M88-LC3eWA";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: "public",
  },
  auth: {
    persistSession: true,
  },
});
