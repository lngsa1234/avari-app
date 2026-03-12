-- Fix: Allow any authenticated user to delete transcripts from a channel they participated in
-- Previously only allowed deleting own transcripts (user_id = auth.uid()),
-- which left remote users' transcripts behind causing stale data in future sessions

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can delete own transcripts" ON call_transcripts;

-- New policy: allow deleting transcripts from channels where you have transcripts
-- (i.e., you participated in that call)
CREATE POLICY "Users can delete transcripts from their calls"
  ON call_transcripts FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM call_transcripts ct
      WHERE ct.channel_name = call_transcripts.channel_name
      AND ct.user_id = auth.uid()
    )
  );

-- Also clean up any old orphaned transcripts from legacy circle-based channels
-- (Run this once manually if needed)
-- DELETE FROM call_transcripts WHERE channel_name LIKE 'connection-group-%' AND created_at < NOW() - INTERVAL '1 day';
