-- Add profile visibility setting
-- Options: 'public' (default), 'connections', 'hidden'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public';

-- Index for filtering in People directory
CREATE INDEX IF NOT EXISTS idx_profiles_visibility
  ON profiles (profile_visibility) WHERE profile_visibility IS NOT NULL;
