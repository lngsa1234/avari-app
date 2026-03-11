-- Allow admins to delete and update meetup_requests
-- Run this migration to enable admin management of trending requests

CREATE POLICY "Admins can delete any request"
  ON meetup_requests FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update any request"
  ON meetup_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
