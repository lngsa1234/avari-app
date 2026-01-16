-- ============================================================================
-- DATABASE MIGRATION: CONNECTION GROUP MESSAGES
-- ============================================================================
-- Adds persistent text messaging for connection groups (3-4 person groups)
-- Separate from in-call messages - this is for ongoing group conversations
-- ============================================================================

-- ============================================================================
-- TABLE: connection_group_messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.connection_group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES connection_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,

  -- Constraints
  CONSTRAINT valid_message CHECK (char_length(message) >= 1 AND char_length(message) <= 2000)
);

-- Indexes
CREATE INDEX idx_group_messages_group ON connection_group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_user ON connection_group_messages(user_id);
CREATE INDEX idx_group_messages_created ON connection_group_messages(created_at DESC);

-- Comments
COMMENT ON TABLE connection_group_messages IS 'Persistent text messages for connection groups';
COMMENT ON COLUMN connection_group_messages.group_id IS 'The connection group this message belongs to';
COMMENT ON COLUMN connection_group_messages.user_id IS 'User who sent the message';
COMMENT ON COLUMN connection_group_messages.message IS 'Message content (1-2000 characters)';
COMMENT ON COLUMN connection_group_messages.is_deleted IS 'Soft delete flag';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE connection_group_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in groups they're part of
CREATE POLICY "select_group_messages_as_member"
  ON connection_group_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE connection_group_members.group_id = connection_group_messages.group_id
      AND connection_group_members.user_id = auth.uid()
      AND connection_group_members.status = 'accepted'
    )
  );

-- Users can insert messages in groups they're part of
CREATE POLICY "insert_group_messages_as_member"
  ON connection_group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE connection_group_members.group_id = connection_group_messages.group_id
      AND connection_group_members.user_id = auth.uid()
      AND connection_group_members.status = 'accepted'
    )
  );

-- Users can update (soft delete) their own messages
CREATE POLICY "update_own_group_messages"
  ON connection_group_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "delete_own_group_messages"
  ON connection_group_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- ENABLE REAL-TIME
-- ============================================================================

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE connection_group_messages;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON connection_group_messages TO authenticated;
GRANT ALL ON connection_group_messages TO service_role;

-- ============================================================================
-- FUNCTION: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_group_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_group_message_updated_at ON connection_group_messages;
CREATE TRIGGER set_group_message_updated_at
  BEFORE UPDATE ON connection_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_group_message_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check table created
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'connection_group_messages'
ORDER BY ordinal_position;

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'connection_group_messages'
ORDER BY policyname;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
