-- Allow any authenticated user to view active circles for discovery
-- This enables the discover page to show circles the user hasn't joined yet

CREATE POLICY "select_active_groups_for_discovery"
ON connection_groups
FOR SELECT
TO authenticated
USING (is_active = true);

-- Allow any authenticated user to view memberships of active circles
-- This lets the discover page show member counts, avatars, and connection social proof
-- Only exposes memberships for active groups with accepted status

CREATE POLICY "select_memberships_for_discovery"
ON connection_group_members
FOR SELECT
TO authenticated
USING (
  status = 'accepted'
  AND EXISTS (
    SELECT 1 FROM connection_groups
    WHERE id = group_id
    AND is_active = true
  )
);

-- Allow circle creators to see pending join requests (status = 'invited')
-- This lets the home page show "wants to join" requests for circles the user created

CREATE POLICY "select_pending_memberships_as_creator"
ON connection_group_members
FOR SELECT
TO authenticated
USING (
  status = 'invited'
  AND is_group_creator(group_id)
);

-- Allow circle creators to update memberships (accept/decline join requests)
-- The existing UPDATE policy only allows user_id = auth.uid(), so creators can't approve others

CREATE POLICY "update_memberships_as_creator"
ON connection_group_members FOR UPDATE
TO authenticated
USING (is_group_creator(group_id))
WITH CHECK (is_group_creator(group_id));

-- Allow circle creators to delete memberships (decline join requests)

CREATE POLICY "delete_memberships_as_creator"
ON connection_group_members FOR DELETE
TO authenticated
USING (is_group_creator(group_id));
