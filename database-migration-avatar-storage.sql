-- Migration: Set up Supabase Storage for profile photos
-- Run this in the Supabase SQL Editor

-- Create the avatars bucket (if using SQL - alternatively create via Dashboard)
-- Note: This may need to be done via the Supabase Dashboard > Storage > New Bucket
-- Bucket name: avatars
-- Public: Yes (so profile photos are publicly accessible)

-- Storage policies for the avatars bucket
-- These allow authenticated users to upload their own photos

-- Policy: Allow authenticated users to upload files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Allow authenticated uploads',
  'avatars',
  'INSERT',
  '((auth.role() = ''authenticated''::text))'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'avatars' AND name = 'Allow authenticated uploads'
);

-- Policy: Allow public read access to all files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Allow public read',
  'avatars',
  'SELECT',
  'true'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'avatars' AND name = 'Allow public read'
);

-- Policy: Allow users to update their own files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Allow user updates',
  'avatars',
  'UPDATE',
  '((auth.role() = ''authenticated''::text))'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'avatars' AND name = 'Allow user updates'
);

-- Policy: Allow users to delete their own files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'Allow user deletes',
  'avatars',
  'DELETE',
  '((auth.role() = ''authenticated''::text))'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies
  WHERE bucket_id = 'avatars' AND name = 'Allow user deletes'
);

-- ============================================================================
-- IMPORTANT: Manual Steps Required
-- ============================================================================
--
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New Bucket"
-- 3. Name: avatars
-- 4. Check "Public bucket" (so photos are publicly accessible)
-- 5. Click "Create bucket"
--
-- The SQL policies above will then apply to allow uploads/reads
-- ============================================================================
