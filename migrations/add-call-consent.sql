-- Ephemeral consent state per call session
-- Used by the transcript consent system to track mutual consent (1:1) and host-controlled (group) flows
CREATE TABLE IF NOT EXISTS call_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  responder_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_consent_channel ON call_consent(channel_name);

ALTER TABLE call_consent ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent re-runs)
DROP POLICY IF EXISTS "consent_select" ON call_consent;
DROP POLICY IF EXISTS "consent_insert" ON call_consent;
DROP POLICY IF EXISTS "consent_update" ON call_consent;
DROP POLICY IF EXISTS "consent_delete" ON call_consent;

-- All authenticated users can read consent state
-- channel_name is opaque (UUID-based room ID), no data leak risk
CREATE POLICY "consent_select" ON call_consent FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "consent_insert" ON call_consent FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "consent_update" ON call_consent FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

CREATE POLICY "consent_delete" ON call_consent FOR DELETE TO authenticated
  USING (auth.uid() = requester_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_call_consent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS call_consent_updated_at ON call_consent;

CREATE TRIGGER call_consent_updated_at
  BEFORE UPDATE ON call_consent
  FOR EACH ROW
  EXECUTE FUNCTION update_call_consent_updated_at();

-- Profile preference for transcript consent
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS transcription_preference TEXT DEFAULT 'ask'
  CHECK (transcription_preference IN ('ask', 'always', 'never'));

COMMENT ON COLUMN profiles.transcription_preference IS 'Transcript consent preference: ask (show modal), always (auto-accept), never (auto-decline)';

-- Safety net: clean up orphaned rows older than 24h
-- Run via Supabase pg_cron:
-- SELECT cron.schedule('cleanup-stale-consent', '0 3 * * *', $$DELETE FROM call_consent WHERE created_at < NOW() - INTERVAL '24 hours'$$);
