-- Migration: Move transcript + ai_summary to Supabase Storage
-- Reduces database egress by storing large text blobs in Storage bucket instead of JSONB columns.
--
-- Step 1: Add transcript_path column to call_recaps
-- Step 2: Create storage bucket + policies
-- Step 3: Run the Node migration script (scripts/migrate-transcripts-to-storage.js) to move data
-- Step 4: After verifying migration, optionally drop the transcript column

-- 1. Add storage path reference column
ALTER TABLE call_recaps
  ADD COLUMN IF NOT EXISTS transcript_path TEXT;

-- 2. Create storage bucket for call transcripts (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('call-transcripts', 'call-transcripts', false)
-- ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies: participants can read their own call transcripts
-- CREATE POLICY "Users can read own call transcripts"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'call-transcripts'
--     AND auth.uid() IN (
--       SELECT unnest(participant_ids)
--       FROM call_recaps
--       WHERE transcript_path = name
--     )
--   );

-- 4. Service role can insert/update (used by API routes)
-- CREATE POLICY "Service role can manage call transcripts"
--   ON storage.objects FOR ALL
--   USING (bucket_id = 'call-transcripts')
--   WITH CHECK (bucket_id = 'call-transcripts');

-- Note: Storage bucket and policies should be created via Supabase dashboard
-- since storage.buckets INSERT requires superuser in most setups.
-- The SQL above is provided as reference.
