-- Fix: Allow accepted circle members to invite others (not just the creator)
-- The current policy only allows is_group_creator() which blocks members from inviting

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "insert_memberships_as_creator" ON connection_group_members;
DROP POLICY IF EXISTS "Creators can invite members" ON connection_group_members;

-- Create new policy: creators AND accepted members can invite
CREATE POLICY "members_can_invite"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_group_creator(group_id)
    OR EXISTS (
      SELECT 1 FROM connection_group_members existing
      WHERE existing.group_id = connection_group_members.group_id
      AND existing.user_id = auth.uid()
      AND existing.status = 'accepted'
    )
  );
