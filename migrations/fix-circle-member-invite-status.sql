-- Fix: Only creators can insert with status='invited'
-- Non-creator members can only insert with status='pending' (requires admin approval)

DROP POLICY IF EXISTS "members_can_invite" ON connection_group_members;

CREATE POLICY "members_can_invite"
  ON connection_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Creators can insert any status (invited, pending, etc.)
    is_group_creator(group_id)
    OR (
      -- Accepted members can only insert with 'pending' status (admin must approve)
      status = 'pending'
      AND EXISTS (
        SELECT 1 FROM connection_group_members existing
        WHERE existing.group_id = connection_group_members.group_id
        AND existing.user_id = auth.uid()
        AND existing.status = 'accepted'
      )
    )
    OR (
      -- Users can request to join themselves with 'pending' status
      status = 'pending'
      AND user_id = auth.uid()
    )
  );
