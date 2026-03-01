-- Fix avatars bucket storage RLS policies
-- The old storage.policies approach is deprecated. Modern Supabase uses RLS on storage.objects.
-- This ensures authenticated users can upload to the avatars bucket.

-- Drop any old-style restrictive policies on storage.objects for the avatars bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow user updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow user deletes" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;

-- INSERT: Authenticated users can upload to avatars bucket
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- SELECT: Anyone can read from avatars bucket (public photos)
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- UPDATE: Authenticated users can update files in avatars bucket
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

-- DELETE: Authenticated users can delete files in avatars bucket
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
