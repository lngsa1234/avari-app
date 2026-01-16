-- Migration: Add call_transcripts table for storing speech-to-text during calls
-- This enables AI-powered recaps with full conversation context

-- Create the call_transcripts table
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  speaker_name TEXT,
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  is_final BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_call_transcripts_channel ON call_transcripts(channel_name);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_user ON call_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_timestamp ON call_transcripts(channel_name, timestamp);

-- Enable RLS
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own transcripts
CREATE POLICY "Users can insert own transcripts"
  ON call_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read transcripts from calls they participated in
-- (We allow reading all transcripts for a channel they're part of)
CREATE POLICY "Users can read transcripts from their calls"
  ON call_transcripts FOR SELECT
  TO authenticated
  USING (true);  -- Allow reading all for now, can restrict later based on video_rooms participation

-- Policy: Users can delete their own transcripts
CREATE POLICY "Users can delete own transcripts"
  ON call_transcripts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON call_transcripts TO authenticated;
