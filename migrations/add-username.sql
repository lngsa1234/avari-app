-- Add username column to profiles
-- Unique, lowercase handle for shareable profile URLs

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique constraint (NULLs allowed during backfill)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON profiles (username) WHERE username IS NOT NULL;

-- Fast lookup by username
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username) WHERE username IS NOT NULL;
