-- Migration: Add profile_picture column to profiles table
-- This allows users to have profile pictures

-- Add the profile_picture column (stores URL to the image)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Optional: Add a comment for documentation
COMMENT ON COLUMN profiles.profile_picture IS 'URL to the user profile picture (stored in Supabase Storage or external URL)';
