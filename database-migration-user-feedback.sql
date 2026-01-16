-- ============================================================================
-- USER FEEDBACK MIGRATION
-- Allows users to submit feedback and admins to view/manage them
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who submitted the feedback
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Feedback content
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'other')),
  subject TEXT NOT NULL CHECK (char_length(subject) >= 3 AND char_length(subject) <= 200),
  message TEXT NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 5000),

  -- Optional: which page/feature the feedback is about
  page_context TEXT,

  -- Rating (optional, 1-5 stars)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Admin management
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON user_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON user_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can submit feedback
CREATE POLICY "Users can submit feedback"
  ON user_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can update feedback (status, notes)
CREATE POLICY "Admins can update feedback"
  ON user_feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_feedback TO authenticated;
GRANT ALL ON user_feedback TO service_role;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_feedback_updated_at ON user_feedback;
CREATE TRIGGER trigger_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();
