-- Track which recaps each user has viewed.
-- Separate table (not a column) because recaps can have multiple participants.
CREATE TABLE IF NOT EXISTS recap_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recap_id UUID NOT NULL REFERENCES call_recaps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recap_id, user_id)
);

ALTER TABLE recap_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recap views"
  ON recap_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own recap views"
  ON recap_views FOR INSERT
  WITH CHECK (user_id = auth.uid());
