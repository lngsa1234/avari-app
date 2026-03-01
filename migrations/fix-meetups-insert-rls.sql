-- Fix meetups INSERT RLS policy
-- Community event creation fails with "new row violates row-level security policy"
-- This ensures any authenticated user can create a meetup where they set themselves as creator.

-- Drop any existing insert policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert meetups" ON meetups;
DROP POLICY IF EXISTS "insert_meetups" ON meetups;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON meetups;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON meetups;
DROP POLICY IF EXISTS "Anyone can create meetups" ON meetups;

-- Create insert policy: authenticated users can insert meetups where created_by = their own ID
CREATE POLICY "Users can insert meetups"
  ON meetups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
