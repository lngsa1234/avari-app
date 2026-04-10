-- Permanent audit log for transcript consent decisions.
-- Append-only: records who consented (or declined) transcription, when, and for which call.
-- Populated automatically via trigger when ephemeral call_consent rows are deleted at call end.
-- Required for GDPR and US two-party consent law compliance (13 states).

CREATE TABLE IF NOT EXISTS consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  requester_id UUID NOT NULL,
  responder_id UUID,
  consent_status TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  consent_requested_at TIMESTAMPTZ,
  consent_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_channel ON consent_audit_log(channel_name);
CREATE INDEX IF NOT EXISTS idx_consent_audit_requester ON consent_audit_log(requester_id);

ALTER TABLE consent_audit_log ENABLE ROW LEVEL SECURITY;

-- Only the service role and the participants can read audit entries
DROP POLICY IF EXISTS "audit_select" ON consent_audit_log;
CREATE POLICY "audit_select" ON consent_audit_log FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = responder_id);

-- No direct insert/update/delete from clients — trigger-only
DROP POLICY IF EXISTS "audit_no_insert" ON consent_audit_log;
DROP POLICY IF EXISTS "audit_no_update" ON consent_audit_log;
DROP POLICY IF EXISTS "audit_no_delete" ON consent_audit_log;

-- Trigger: copy consent record to audit log before deletion
CREATE OR REPLACE FUNCTION archive_consent_to_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO consent_audit_log (
    channel_name, requester_id, responder_id,
    consent_status, attempt_count,
    consent_requested_at, consent_resolved_at
  ) VALUES (
    OLD.channel_name, OLD.requester_id, OLD.responder_id,
    OLD.status, OLD.attempt_count,
    OLD.created_at, OLD.updated_at
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS consent_audit_on_delete ON call_consent;

CREATE TRIGGER consent_audit_on_delete
  BEFORE DELETE ON call_consent
  FOR EACH ROW
  EXECUTE FUNCTION archive_consent_to_audit_log();
