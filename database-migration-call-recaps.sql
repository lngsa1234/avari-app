-- ============================================================================
-- Call Recaps Migration
-- Stores post-call recap data including transcripts, AI summaries, and metrics
-- ============================================================================

-- Create call_recaps table
CREATE TABLE IF NOT EXISTS call_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('1on1', 'meetup', 'group')),
  provider TEXT NOT NULL CHECK (provider IN ('webrtc', 'livekit', 'agora')),

  -- Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Participants
  participant_count INTEGER DEFAULT 0,
  participant_ids UUID[] DEFAULT '{}',

  -- Content
  transcript JSONB DEFAULT '[]', -- [{speakerId, speakerName, text, timestamp}]
  ai_summary TEXT,

  -- Metrics
  metrics JSONB DEFAULT '{}', -- {avg_latency, packet_loss, connection_quality, etc}

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_call_recaps_channel_name ON call_recaps(channel_name);
CREATE INDEX IF NOT EXISTS idx_call_recaps_call_type ON call_recaps(call_type);
CREATE INDEX IF NOT EXISTS idx_call_recaps_provider ON call_recaps(provider);
CREATE INDEX IF NOT EXISTS idx_call_recaps_created_by ON call_recaps(created_by);
CREATE INDEX IF NOT EXISTS idx_call_recaps_created_at ON call_recaps(created_at DESC);

-- Enable Row Level Security
ALTER TABLE call_recaps ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view recaps for calls they participated in
CREATE POLICY "Users can view their own call recaps"
  ON call_recaps FOR SELECT
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(participant_ids)
  );

-- Policy: Users can create recaps for calls they initiated
CREATE POLICY "Users can create call recaps"
  ON call_recaps FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can update their own recaps
CREATE POLICY "Users can update their own call recaps"
  ON call_recaps FOR UPDATE
  USING (created_by = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_recaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS call_recaps_updated_at ON call_recaps;
CREATE TRIGGER call_recaps_updated_at
  BEFORE UPDATE ON call_recaps
  FOR EACH ROW
  EXECUTE FUNCTION update_call_recaps_updated_at();

-- ============================================================================
-- Provider Performance Tracking
-- For A/B testing and comparing video providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('webrtc', 'livekit', 'agora')),
  call_type TEXT NOT NULL CHECK (call_type IN ('1on1', 'meetup', 'group')),
  channel_name TEXT NOT NULL,

  -- Performance metrics
  avg_latency_ms INTEGER,
  max_latency_ms INTEGER,
  min_latency_ms INTEGER,
  packet_loss_percent DECIMAL(5,2),
  avg_bitrate_kbps INTEGER,
  connection_quality TEXT, -- 'excellent', 'good', 'fair', 'poor'

  -- Call info
  participant_count INTEGER,
  duration_seconds INTEGER,

  -- Technical details
  video_resolution TEXT,
  fps INTEGER,
  reconnect_count INTEGER DEFAULT 0,

  -- Timestamps
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for provider metrics
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider ON provider_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_call_type ON provider_metrics(call_type);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_recorded_at ON provider_metrics(recorded_at DESC);

-- Enable RLS
ALTER TABLE provider_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can insert metrics
CREATE POLICY "Authenticated users can insert provider metrics"
  ON provider_metrics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Anyone can read metrics (for analytics)
CREATE POLICY "Anyone can read provider metrics"
  ON provider_metrics FOR SELECT
  USING (true);

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: Provider performance comparison
CREATE OR REPLACE VIEW provider_performance_summary AS
SELECT
  provider,
  call_type,
  COUNT(*) as total_calls,
  ROUND(AVG(avg_latency_ms), 0) as avg_latency,
  ROUND(AVG(packet_loss_percent), 2) as avg_packet_loss,
  ROUND(AVG(duration_seconds / 60.0), 1) as avg_duration_minutes,
  ROUND(AVG(participant_count), 1) as avg_participants,
  COUNT(CASE WHEN connection_quality = 'excellent' THEN 1 END) as excellent_quality_count,
  COUNT(CASE WHEN connection_quality = 'good' THEN 1 END) as good_quality_count,
  COUNT(CASE WHEN connection_quality = 'fair' THEN 1 END) as fair_quality_count,
  COUNT(CASE WHEN connection_quality = 'poor' THEN 1 END) as poor_quality_count
FROM provider_metrics
WHERE recorded_at > NOW() - INTERVAL '30 days'
GROUP BY provider, call_type
ORDER BY provider, call_type;

-- ============================================================================
-- Sample Queries for Analytics
-- ============================================================================

-- Get provider comparison for the last 7 days
-- SELECT * FROM provider_performance_summary;

-- Get detailed metrics for a specific provider
-- SELECT * FROM provider_metrics WHERE provider = 'livekit' ORDER BY recorded_at DESC LIMIT 100;

-- Get call recaps for a user
-- SELECT * FROM call_recaps WHERE created_by = 'user-uuid' ORDER BY created_at DESC;
