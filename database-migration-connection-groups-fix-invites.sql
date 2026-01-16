-- ============================================================================
-- FIX: Allow invited users to see groups they've been invited to
-- ============================================================================
-- This fixes the issue where invited users can't see their pending invitations
-- because the policy only allows accepted members to view groups
-- ============================================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view groups they are members of" ON connection_groups;

-- Create updated helper function that includes invited status
CREATE OR REPLACE FUNCTION is_connection_group_member_or_invited(group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM connection_group_members
    WHERE connection_group_members.group_id = is_connection_group_member_or_invited.group_id
    AND connection_group_members.user_id = auth.uid()
    AND connection_group_members.status IN ('accepted', 'invited')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy that allows invited users to see groups
CREATE POLICY "Users can view groups they are members of or invited to"
  ON connection_groups FOR SELECT
  TO authenticated
  USING (is_connection_group_member_or_invited(id));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this, invited users should be able to:
-- 1. See their pending invitations in the "Invitations" tab
-- 2. See the group name and creator information
-- 3. Accept or decline the invitation
-- ============================================================================
