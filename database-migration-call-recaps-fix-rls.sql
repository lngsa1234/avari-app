-- ============================================================================
-- Fix call_recaps RLS: Allow circle members to view recaps for their circle
-- ============================================================================
-- Problem: The existing RLS policy only allows the recap creator or listed
-- participants to view recaps. Circle members who didn't create the recap
-- (or weren't captured in participant_ids) cannot see AI recaps for their
-- circle's past sessions.
--
-- Fix: Replace the SELECT policy to also allow members of the circle
-- associated with the recap's channel_name to view it.
-- ============================================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own call recaps" ON call_recaps;

-- Create new policy that also allows circle members to view their circle's recaps
CREATE POLICY "Users can view their own call recaps"
  ON call_recaps FOR SELECT
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(participant_ids)
    OR (
      -- Allow circle members to view recaps for their circle
      -- channel_name format: 'connection-group-{meetupId}' (new) or 'connection-group-{groupId}' (legacy)
      channel_name LIKE 'connection-group-%'
      AND EXISTS (
        SELECT 1 FROM connection_group_members cgm
        WHERE cgm.user_id = auth.uid()
        AND cgm.status = 'accepted'
        AND (
          -- New format: meetupId in channel name, look up circle_id from meetups
          cgm.group_id IN (
            SELECT m.circle_id FROM meetups m
            WHERE m.id = CAST(
              REPLACE(call_recaps.channel_name, 'connection-group-', '') AS UUID
            )
          )
          -- Legacy format: groupId directly in channel name
          OR cgm.group_id = CAST(
            REPLACE(call_recaps.channel_name, 'connection-group-', '') AS UUID
          )
        )
      )
    )
  );
