-- ============================================================================
-- COMPLETE FIX: Connection Groups RLS Policies
-- ============================================================================
-- This script completely rebuilds all RLS policies for connection groups
-- to fix invitation visibility issues
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop all existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their connection groups" ON connection_groups;
DROP POLICY IF EXISTS "Users can view groups they created" ON connection_groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON connection_groups;
DROP POLICY IF EXISTS "Users can view groups they are members of or invited to" ON connection_groups;
DROP POLICY IF EXISTS "Users can create connection groups" ON connection_groups;
DROP POLICY IF EXISTS "Creators can update their groups" ON connection_groups;
DROP POLICY IF EXISTS "Creators can delete their groups" ON connection_groups;

DROP POLICY IF EXISTS "Users can view relevant group memberships" ON connection_group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON connection_group_members;
DROP POLICY IF EXISTS "Creators can view group memberships" ON connection_group_members;
DROP POLICY IF EXISTS "Creators can invite members" ON connection_group_members;
DROP POLICY IF EXISTS "Users can respond to invitations" ON connection_group_members;
DROP POLICY IF EXISTS "Creators can remove members" ON connection_group_members;

DROP POLICY IF EXISTS "Group members can view rooms" ON connection_group_rooms;
DROP POLICY IF EXISTS "Members can create rooms" ON connection_group_rooms;
DROP POLICY IF EXISTS "Members can update room status" ON connection_group_rooms;

-- ============================================================================
-- STEP 2: Drop existing helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS is_connection_group_member(UUID);
DROP FUNCTION IF EXISTS is_connection_group_member_or_invited(UUID);
DROP FUNCTION IF EXISTS is_group_creator(UUID);

-- ============================================================================
-- STEP 3: Create helper functions
-- ============================================================================

-- Check if user is creator of a group
CREATE OR REPLACE FUNCTION is_group_creator(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM connection_groups
    WHERE id = p_group_id
    AND creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is a member or invited to a group
CREATE OR REPLACE FUNCTION is_group_member_or_invited(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM connection_group_members
    WHERE group_id = p_group_id
    AND user_id = auth.uid()
    AND status IN ('accepted', 'invited')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 4: Create RLS policies for connection_groups
-- ============================================================================

-- Policy 1: Users can view groups they created
CREATE POLICY "select_own_created_groups"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Policy 2: Users can view groups they are members of or invited to
CREATE POLICY "select_member_or_invited_groups"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (is_group_member_or_invited(id));

-- Policy 3: Users can create groups
CREATE POLICY "insert_groups"
  ON connection_groups FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- Policy 4: Creators can update their groups
CREATE POLICY "update_own_groups"
  ON connection_groups FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Policy 5: Creators can delete their groups
CREATE POLICY "delete_own_groups"
  ON connection_groups FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- ============================================================================
-- STEP 5: Create RLS policies for connection_group_members
-- ============================================================================

-- Policy 1: Users can view their own memberships/invitations
CREATE POLICY "select_own_memberships"
  ON connection_group_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Creators can view all memberships in their groups
CREATE POLICY "select_group_memberships_as_creator"
  ON connection_group_members FOR SELECT
  TO authenticated
  USING (is_group_creator(group_id));

-- Policy 3: Creators can insert memberships (invite people)
CREATE POLICY "insert_memberships_as_creator"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_creator(group_id));

-- Policy 4: Users can update their own membership status (accept/decline)
CREATE POLICY "update_own_membership_status"
  ON connection_group_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 5: Creators can delete memberships in their groups
CREATE POLICY "delete_memberships_as_creator"
  ON connection_group_members FOR DELETE
  TO authenticated
  USING (is_group_creator(group_id));

-- ============================================================================
-- STEP 6: Create RLS policies for connection_group_rooms
-- ============================================================================

-- Policy 1: Users can view rooms for groups they're part of
CREATE POLICY "select_rooms_as_member"
  ON connection_group_rooms FOR SELECT
  TO authenticated
  USING (
    is_group_creator(group_id) OR
    is_group_member_or_invited(group_id)
  );

-- Policy 2: Members can create rooms for their groups
CREATE POLICY "insert_rooms_as_member"
  ON connection_group_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    is_group_creator(group_id) OR
    is_group_member_or_invited(group_id)
  );

-- Policy 3: Members can update room status
CREATE POLICY "update_rooms_as_member"
  ON connection_group_rooms FOR UPDATE
  TO authenticated
  USING (
    is_group_creator(group_id) OR
    is_group_member_or_invited(group_id)
  );

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_group_creator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_group_member_or_invited(UUID) TO authenticated;

-- ============================================================================
-- STEP 8: Verification Queries
-- ============================================================================

-- Run these queries after the migration to verify:

-- 1. Check all policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('connection_groups', 'connection_group_members', 'connection_group_rooms')
ORDER BY tablename, policyname;

-- 2. Check helper functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name LIKE 'is_group%'
AND routine_schema = 'public';

-- 3. Test group creation (run as authenticated user)
-- INSERT INTO connection_groups (name, creator_id) VALUES ('Test Group', auth.uid());

-- 4. Test viewing groups (run as authenticated user)
-- SELECT * FROM connection_groups;

-- 5. Test viewing memberships (run as authenticated user)
-- SELECT * FROM connection_group_members;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you still have issues, check:
-- 1. Is RLS enabled?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('connection_groups', 'connection_group_members', 'connection_group_rooms');

-- 2. Can you see any data at all? (Check if RLS is blocking everything)
SET ROLE authenticated;
SELECT COUNT(*) FROM connection_groups;
SELECT COUNT(*) FROM connection_group_members;

-- ============================================================================
