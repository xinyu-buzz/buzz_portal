-- Enable RLS on newsletter_subscriptions if not already enabled
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to read newsletter subscriptions" ON newsletter_subscriptions;

-- Allow all authenticated users to read newsletter subscriptions
-- This allows the admin portal to view subscriber counts
CREATE POLICY "Allow authenticated users to read newsletter subscriptions"
ON newsletter_subscriptions
FOR SELECT
TO authenticated
USING (true);

-- Optional: If you want to allow inserting new subscriptions from the frontend
DROP POLICY IF EXISTS "Allow public to subscribe" ON newsletter_subscriptions;

CREATE POLICY "Allow public to subscribe"
ON newsletter_subscriptions
FOR INSERT
TO anon
WITH CHECK (true);
