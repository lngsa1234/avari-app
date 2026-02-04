-- Circle AI Agent Database Migration
-- Run this in your Supabase SQL editor

-- Icebreakers for meetups
CREATE TABLE IF NOT EXISTS meetup_icebreakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID REFERENCES meetups(id) ON DELETE CASCADE,
  icebreakers JSONB NOT NULL,  -- [{question, category, difficulty}]
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generation_type TEXT DEFAULT 'ai',  -- 'ai' | 'template' | 'rule'
  UNIQUE(meetup_id)
);

-- User nudges (engagement prompts)
CREATE TABLE IF NOT EXISTS user_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL,  -- 'meetup_reminder' | 'connection_followup' | 'circle_invite' | 'inactive'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB,  -- context data (related user, meetup, etc.)
  status TEXT DEFAULT 'pending',  -- 'pending' | 'delivered' | 'clicked' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Circle matching scores (extends existing group_recommendations)
CREATE TABLE IF NOT EXISTS circle_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES connection_groups(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  match_reasons JSONB,  -- [{reason, weight}]
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, circle_id)
);

-- Event recommendations for users
CREATE TABLE IF NOT EXISTS event_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  meetup_id UUID REFERENCES meetups(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  match_reasons JSONB,  -- [{reason, weight}]
  source TEXT DEFAULT 'agent',  -- 'agent' | 'manual' | 'trending'
  status TEXT DEFAULT 'pending',  -- 'pending' | 'viewed' | 'rsvp' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  UNIQUE(user_id, meetup_id)
);

-- Agent execution log (for debugging & cost tracking)
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL,  -- 'icebreaker' | 'circle_match' | 'nudge' | 'event_recommendation'
  tier TEXT NOT NULL,   -- 'rule' | 'light_ai' | 'full_ai'
  input_tokens INT,
  output_tokens INT,
  cost_usd DECIMAL(10,6),
  duration_ms INT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nudges_user_status ON user_nudges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nudges_created ON user_nudges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_match_user ON circle_match_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_event_recs_user_status ON event_recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_event_recs_meetup ON event_recommendations(meetup_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_skill ON agent_executions(skill, executed_at DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS on new tables
ALTER TABLE meetup_icebreakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- Meetup icebreakers: anyone can read, only service role can write
CREATE POLICY "Anyone can read icebreakers" ON meetup_icebreakers
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage icebreakers" ON meetup_icebreakers
  FOR ALL USING (auth.role() = 'service_role');

-- User nudges: users can only see their own
CREATE POLICY "Users can read own nudges" ON user_nudges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own nudges" ON user_nudges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage nudges" ON user_nudges
  FOR ALL USING (auth.role() = 'service_role');

-- Circle match scores: users can only see their own
CREATE POLICY "Users can read own circle matches" ON circle_match_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage circle matches" ON circle_match_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Event recommendations: users can only see their own
CREATE POLICY "Users can read own event recs" ON event_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own event recs" ON event_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage event recs" ON event_recommendations
  FOR ALL USING (auth.role() = 'service_role');

-- Agent executions: only service role can access (for admin analytics)
CREATE POLICY "Service role can manage executions" ON agent_executions
  FOR ALL USING (auth.role() = 'service_role');
