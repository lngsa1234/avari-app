-- Fix meetups UPDATE RLS policy to allow circle admins (circle creators) to edit circle meetups
-- Previously only the meetup created_by user could update, but circle meetups are auto-generated
-- with created_by = circle.creator_id, so circle admins need update access too.

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own meetups" ON meetups;
DROP POLICY IF EXISTS "update_own_meetups" ON meetups;
DROP POLICY IF EXISTS "Allow update for meetup creator" ON meetups;

-- Create new update policy: allow if you created the meetup OR you're the creator of the circle it belongs to
CREATE POLICY "Users can update own or circle meetups"
  ON meetups FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (
      circle_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM connection_groups
        WHERE connection_groups.id = meetups.circle_id
        AND connection_groups.creator_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (
      circle_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM connection_groups
        WHERE connection_groups.id = meetups.circle_id
        AND connection_groups.creator_id = auth.uid()
      )
    )
  );
