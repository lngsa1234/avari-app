-- ============================================================================
-- DATABASE MIGRATION: CONNECTION GROUPS
-- ============================================================================
-- This migration adds support for connection groups (small group video chats)
-- for users with mutual connections.
--
-- Features:
-- - Users can create groups with 3-4 people (themselves + 2-3 connections)
-- - Group members must be mutual connections
-- - Invitations must be accepted before joining
-- - Groups have their own Agora video rooms
-- ============================================================================

-- ============================================================================
-- TABLE: connection_groups
-- ============================================================================
-- Stores connection group information
CREATE TABLE IF NOT EXISTS public.connection_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT valid_group_name CHECK (char_length(name) >= 3 AND char_length(name) <= 100)
);

-- Indexes for connection_groups
CREATE INDEX idx_connection_groups_creator ON connection_groups(creator_id);
CREATE INDEX idx_connection_groups_active ON connection_groups(is_active);
CREATE INDEX idx_connection_groups_created ON connection_groups(created_at);

-- Comments
COMMENT ON TABLE connection_groups IS 'Stores connection group information for small group video chats';
COMMENT ON COLUMN connection_groups.name IS 'Group name (3-100 characters)';
COMMENT ON COLUMN connection_groups.creator_id IS 'User who created the group';
COMMENT ON COLUMN connection_groups.is_active IS 'Whether the group is active or archived';

-- ============================================================================
-- TABLE: connection_group_members
-- ============================================================================
-- Stores group membership and invitation status
CREATE TABLE IF NOT EXISTS public.connection_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES connection_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT unique_group_member UNIQUE(group_id, user_id)
);

-- Indexes for connection_group_members
CREATE INDEX idx_group_members_group ON connection_group_members(group_id);
CREATE INDEX idx_group_members_user ON connection_group_members(user_id);
CREATE INDEX idx_group_members_status ON connection_group_members(status);
CREATE INDEX idx_group_members_invited ON connection_group_members(invited_at);

-- Comments
COMMENT ON TABLE connection_group_members IS 'Stores group memberships and invitation status';
COMMENT ON COLUMN connection_group_members.status IS 'Invitation status: invited, accepted, declined';
COMMENT ON COLUMN connection_group_members.invited_at IS 'When the user was invited';
COMMENT ON COLUMN connection_group_members.responded_at IS 'When the user responded to invitation';

-- ============================================================================
-- TABLE: connection_group_rooms
-- ============================================================================
-- Stores Agora room information for connection group video calls
CREATE TABLE IF NOT EXISTS public.connection_group_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_name TEXT NOT NULL UNIQUE,
  group_id UUID NOT NULL REFERENCES connection_groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT unique_group_room UNIQUE(group_id),
  CONSTRAINT valid_channel_name CHECK (channel_name LIKE 'connection-group-%')
);

-- Indexes for connection_group_rooms
CREATE INDEX idx_group_rooms_channel ON connection_group_rooms(channel_name);
CREATE INDEX idx_group_rooms_group ON connection_group_rooms(group_id);
CREATE INDEX idx_group_rooms_active ON connection_group_rooms(is_active);

-- Comments
COMMENT ON TABLE connection_group_rooms IS 'Stores Agora room information for connection group video calls';
COMMENT ON COLUMN connection_group_rooms.channel_name IS 'Agora channel name (format: connection-group-{groupId})';
COMMENT ON COLUMN connection_group_rooms.group_id IS 'Associated connection group (1:1 relationship)';
COMMENT ON COLUMN connection_group_rooms.started_at IS 'When the first participant joined';
COMMENT ON COLUMN connection_group_rooms.ended_at IS 'When the last participant left';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE connection_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_group_rooms ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: connection_groups
-- ============================================================================

-- Users can view groups they created or are accepted members of
CREATE POLICY "Users can view their connection groups"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE group_id = connection_groups.id
      AND user_id = auth.uid()
      AND status = 'accepted'
    )
  );

-- Authenticated users can create groups
CREATE POLICY "Users can create connection groups"
  ON connection_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Creators can update their groups
CREATE POLICY "Creators can update their groups"
  ON connection_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Creators can delete their groups
CREATE POLICY "Creators can delete their groups"
  ON connection_groups FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- ============================================================================
-- RLS POLICIES: connection_group_members
-- ============================================================================

-- Users can view memberships for groups they're part of
CREATE POLICY "Users can view relevant group memberships"
  ON connection_group_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = group_id AND creator_id = auth.uid()
    )
  );

-- Group creators can invite members (mutual connection validation in app logic)
CREATE POLICY "Creators can invite members"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = group_id AND creator_id = auth.uid()
    )
  );

-- Invited users can update their status (accept/decline)
CREATE POLICY "Users can respond to invitations"
  ON connection_group_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Creators can remove members
CREATE POLICY "Creators can remove members"
  ON connection_group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = group_id AND creator_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: connection_group_rooms
-- ============================================================================

-- Group members can view rooms for their groups
CREATE POLICY "Group members can view rooms"
  ON connection_group_rooms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE group_id = connection_group_rooms.group_id
      AND user_id = auth.uid()
      AND status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = connection_group_rooms.group_id
      AND creator_id = auth.uid()
    )
  );

-- Group members can create rooms
CREATE POLICY "Members can create rooms"
  ON connection_group_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE group_id = connection_group_rooms.group_id
      AND user_id = auth.uid()
      AND status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = connection_group_rooms.group_id
      AND creator_id = auth.uid()
    )
  );

-- Group members can update room status (start/end call)
CREATE POLICY "Members can update room status"
  ON connection_group_rooms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE group_id = connection_group_rooms.group_id
      AND user_id = auth.uid()
      AND status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM connection_groups
      WHERE id = connection_group_rooms.group_id
      AND creator_id = auth.uid()
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON connection_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON connection_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON connection_group_rooms TO authenticated;

-- Grant full access to service_role (for admin operations)
GRANT ALL ON connection_groups TO service_role;
GRANT ALL ON connection_group_members TO service_role;
GRANT ALL ON connection_group_rooms TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To apply this migration:
-- 1. Open Supabase SQL Editor
-- 2. Paste this entire file
-- 3. Execute
-- 4. Verify tables created: SELECT * FROM connection_groups;
-- ============================================================================
