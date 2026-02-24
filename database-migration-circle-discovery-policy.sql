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
