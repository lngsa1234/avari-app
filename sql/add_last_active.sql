-- Migration: Add last_active column to profiles table
-- Run this in your Supabase SQL Editor

-- Add last_active column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE;

-- Create an index for faster queries on last_active
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active);

-- Optional: Update all existing users to have a last_active of now
-- UPDATE profiles SET last_active = NOW() WHERE last_active IS NULL;
