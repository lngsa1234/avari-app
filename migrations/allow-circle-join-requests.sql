-- Allow users to submit their own join requests to circles
-- 1. Add 'pending' to the status CHECK constraint
-- 2. Update RLS policy to allow self-insert with status='pending'

-- Step 1: Update CHECK constraint to allow 'pending' status
ALTER TABLE connection_group_members DROP CONSTRAINT IF EXISTS connection_group_members_status_check;
ALTER TABLE connection_group_members ADD CONSTRAINT connection_group_members_status_check
  CHECK (status IN ('invited', 'accepted', 'declined', 'pending'));

-- Step 2: Update RLS INSERT policy
DROP POLICY IF EXISTS "members_can_invite" ON connection_group_members;
DROP POLICY IF EXISTS "members_can_invite_or_request" ON connection_group_members;

CREATE POLICY "members_can_invite_or_request"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Creators and accepted members can invite others
    is_group_creator(group_id)
    OR EXISTS (
      SELECT 1 FROM connection_group_members existing
      WHERE existing.group_id = connection_group_members.group_id
      AND existing.user_id = auth.uid()
      AND existing.status = 'accepted'
    )
    -- Users can request to join (insert their own pending membership)
    OR (user_id = auth.uid() AND status = 'pending')
  );

-- Step 3: Allow users to delete their own membership (leave circle or withdraw request)
DROP POLICY IF EXISTS "withdraw_own_pending_request" ON connection_group_members;
DROP POLICY IF EXISTS "delete_own_membership" ON connection_group_members;

CREATE POLICY "delete_own_membership"
  ON connection_group_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
