-- ============================================================================
-- CONNECTION & GROUP RECOMMENDATIONS MIGRATION
-- AI-powered connection and group suggestions based on meetup conversations
-- ============================================================================

-- ============================================================================
-- TABLE 1: connection_recommendations
-- Individual 1:1 connection suggestions between meetup participants
-- ============================================================================

CREATE TABLE IF NOT EXISTS connection_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source context
  call_recap_id UUID REFERENCES call_recaps(id) ON DELETE CASCADE,
  meetup_id UUID REFERENCES meetups(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL,

  -- Recommendation pair
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recommended_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- AI-generated content
  match_score DECIMAL(3,2) CHECK (match_score >= 0 AND match_score <= 1),
  reason TEXT NOT NULL,
  shared_topics TEXT[],

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'connected', 'dismissed')),
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate recommendations for same pair in same call
  UNIQUE(call_recap_id, user_id, recommended_user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conn_rec_user ON connection_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_conn_rec_recommended ON connection_recommendations(recommended_user_id);
CREATE INDEX IF NOT EXISTS idx_conn_rec_meetup ON connection_recommendations(meetup_id);
CREATE INDEX IF NOT EXISTS idx_conn_rec_recap ON connection_recommendations(call_recap_id);
CREATE INDEX IF NOT EXISTS idx_conn_rec_status ON connection_recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conn_rec_created ON connection_recommendations(created_at DESC);

-- Enable RLS
ALTER TABLE connection_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view recommendations where they are the user OR the recommended user
CREATE POLICY "Users can view their connection recommendations"
  ON connection_recommendations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    auth.uid() = recommended_user_id
  );

-- Policy: Service can insert recommendations
CREATE POLICY "Service can insert connection recommendations"
  ON connection_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own recommendation status
CREATE POLICY "Users can update their connection recommendations"
  ON connection_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON connection_recommendations TO authenticated;
GRANT ALL ON connection_recommendations TO service_role;


-- ============================================================================
-- TABLE 2: group_recommendations
-- Suggestions to form new groups or join existing connection groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source context
  call_recap_id UUID REFERENCES call_recaps(id) ON DELETE CASCADE,
  meetup_id UUID REFERENCES meetups(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL,

  -- Who receives this recommendation
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Recommendation type
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('form_new', 'join_existing')),

  -- For 'join_existing': reference to existing group
  suggested_group_id UUID REFERENCES connection_groups(id) ON DELETE CASCADE,

  -- For 'form_new': suggested group details
  suggested_members UUID[],
  suggested_name TEXT,
  suggested_topic TEXT,

  -- AI-generated content
  match_score DECIMAL(3,2) CHECK (match_score >= 0 AND match_score <= 1),
  reason TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'acted', 'dismissed')),
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,

  -- If acted upon, reference to created/joined group
  result_group_id UUID REFERENCES connection_groups(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_group_rec_user ON group_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_group_rec_meetup ON group_recommendations(meetup_id);
CREATE INDEX IF NOT EXISTS idx_group_rec_recap ON group_recommendations(call_recap_id);
CREATE INDEX IF NOT EXISTS idx_group_rec_type ON group_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_group_rec_status ON group_recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_group_rec_created ON group_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_rec_suggested ON group_recommendations(suggested_group_id);

-- Enable RLS
ALTER TABLE group_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own group recommendations
CREATE POLICY "Users can view their group recommendations"
  ON group_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users who are suggested members can also view (for form_new)
CREATE POLICY "Suggested members can view group recommendations"
  ON group_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(suggested_members));

-- Policy: Service can insert recommendations
CREATE POLICY "Service can insert group recommendations"
  ON group_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own recommendation status
CREATE POLICY "Users can update their group recommendations"
  ON group_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON group_recommendations TO authenticated;
GRANT ALL ON group_recommendations TO service_role;
