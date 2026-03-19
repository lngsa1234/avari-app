-- Table to track connection requests a user has chosen to ignore (soft ignore)
-- The sender's interest record is NOT deleted; the request is just hidden for the receiver.
CREATE TABLE IF NOT EXISTS ignored_connection_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ignored_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ignored_user_id)
);

ALTER TABLE ignored_connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ignores"
  ON ignored_connection_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own ignores"
  ON ignored_connection_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ignores"
  ON ignored_connection_requests FOR DELETE
  USING (user_id = auth.uid());

-- When a user withdraws their interest (deletes user_interests row),
-- automatically clean up the corresponding ignore record.
-- e.g. Ling Wang withdraws interest in Admin → delete Admin's ignore of Ling Wang.
-- Uses SECURITY DEFINER so the trigger can delete another user's ignore record.
CREATE OR REPLACE FUNCTION cleanup_ignored_on_interest_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.ignored_connection_requests
  WHERE user_id = OLD.interested_in_user_id
    AND ignored_user_id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_cleanup_ignored_on_interest_delete
  AFTER DELETE ON user_interests
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_ignored_on_interest_delete();
