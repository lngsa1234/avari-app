-- ============================================================================
-- DATABASE MIGRATION FIX: CONNECTION GROUPS
-- ============================================================================
-- This fixes the infinite recursion issue in RLS policies
-- Run this AFTER the original migration to replace the problematic policies
-- ============================================================================

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their connection groups" ON connection_groups;
DROP POLICY IF EXISTS "Users can view relevant group memberships" ON connection_group_members;
DROP POLICY IF EXISTS "Creators can invite members" ON connection_group_members;

-- ============================================================================
-- FIXED RLS POLICIES: connection_groups
-- ============================================================================

-- Simplified: Users can view groups they created
CREATE POLICY "Users can view groups they created"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- Simplified: Users can view groups where they are members (via helper function)
CREATE OR REPLACE FUNCTION is_connection_group_member(group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM connection_group_members
    WHERE connection_group_members.group_id = is_connection_group_member.group_id
    AND connection_group_members.user_id = auth.uid()
    AND connection_group_members.status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view groups they are members of"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (is_connection_group_member(id));

-- ============================================================================
-- FIXED RLS POLICIES: connection_group_members
-- ============================================================================

-- Users can view their own memberships
CREATE POLICY "Users can view their own memberships"
  ON connection_group_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Helper function to check if user created the group
CREATE OR REPLACE FUNCTION is_group_creator(group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM connection_groups
    WHERE connection_groups.id = is_group_creator.group_id
    AND connection_groups.creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creators can view all memberships of their groups
CREATE POLICY "Creators can view group memberships"
  ON connection_group_members FOR SELECT
  TO authenticated
  USING (is_group_creator(group_id));

-- Creators can invite members
CREATE POLICY "Creators can invite members"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_creator(group_id));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the policies are working:
--
-- List all policies on connection_groups:
-- SELECT * FROM pg_policies WHERE tablename = 'connection_groups';
--
-- List all policies on connection_group_members:
-- SELECT * FROM pg_policies WHERE tablename = 'connection_group_members';
-- ============================================================================
