-- Database Migration: Network Discover Feature
-- Adds support for vibe categories, meetup requests (community wishlist), and related features

-- 1. Add vibe_category to existing tables
-- Add to meetups table
ALTER TABLE meetups ADD COLUMN IF NOT EXISTS vibe_category TEXT
  CHECK (vibe_category IN ('advice', 'vent', 'grow'));

-- Add to meetup_proposals table
ALTER TABLE meetup_proposals ADD COLUMN IF NOT EXISTS vibe_category TEXT
  CHECK (vibe_category IN ('advice', 'vent', 'grow'));

-- Add to connection_groups table
ALTER TABLE connection_groups ADD COLUMN IF NOT EXISTS vibe_category TEXT
  CHECK (vibe_category IN ('advice', 'vent', 'grow'));

-- 2. Create meetup_requests table (Community Wishlist)
CREATE TABLE IF NOT EXISTS meetup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  vibe_category TEXT CHECK (vibe_category IN ('advice', 'vent', 'grow')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'closed')),
  supporter_count INTEGER DEFAULT 1,
  fulfilled_by_meetup_id UUID REFERENCES meetups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create meetup_request_supporters table (tracks who supports each request)
CREATE TABLE IF NOT EXISTS meetup_request_supporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES meetup_requests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

-- 4. Create function to increment supporter count
CREATE OR REPLACE FUNCTION increment_request_supporters(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE meetup_requests
  SET supporter_count = supporter_count + 1,
      updated_at = NOW()
  WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to decrement supporter count
CREATE OR REPLACE FUNCTION decrement_request_supporters(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE meetup_requests
  SET supporter_count = GREATEST(0, supporter_count - 1),
      updated_at = NOW()
  WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetup_requests_status ON meetup_requests(status);
CREATE INDEX IF NOT EXISTS idx_meetup_requests_vibe ON meetup_requests(vibe_category);
CREATE INDEX IF NOT EXISTS idx_meetup_requests_user ON meetup_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_meetup_requests_supporters ON meetup_requests(supporter_count DESC);
CREATE INDEX IF NOT EXISTS idx_meetup_request_supporters_request ON meetup_request_supporters(request_id);
CREATE INDEX IF NOT EXISTS idx_meetup_request_supporters_user ON meetup_request_supporters(user_id);
CREATE INDEX IF NOT EXISTS idx_meetups_vibe ON meetups(vibe_category);
CREATE INDEX IF NOT EXISTS idx_connection_groups_vibe ON connection_groups(vibe_category);

-- 7. Enable Row Level Security
ALTER TABLE meetup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_request_supporters ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for meetup_requests

-- Anyone can view open requests
CREATE POLICY "Anyone can view open requests"
  ON meetup_requests FOR SELECT
  USING (status = 'open' OR user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own requests"
  ON meetup_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests
CREATE POLICY "Users can update own requests"
  ON meetup_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own requests
CREATE POLICY "Users can delete own requests"
  ON meetup_requests FOR DELETE
  USING (auth.uid() = user_id);

-- 9. RLS Policies for meetup_request_supporters

-- Anyone can view supporters
CREATE POLICY "Anyone can view supporters"
  ON meetup_request_supporters FOR SELECT
  USING (true);

-- Users can add themselves as supporters
CREATE POLICY "Users can support requests"
  ON meetup_request_supporters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own support
CREATE POLICY "Users can remove own support"
  ON meetup_request_supporters FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Add bio/hook field to profiles table if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- 11. Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to meetup_requests
DROP TRIGGER IF EXISTS update_meetup_requests_updated_at ON meetup_requests;
CREATE TRIGGER update_meetup_requests_updated_at
  BEFORE UPDATE ON meetup_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 12. Grant necessary permissions
GRANT ALL ON meetup_requests TO authenticated;
GRANT ALL ON meetup_request_supporters TO authenticated;
GRANT EXECUTE ON FUNCTION increment_request_supporters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_request_supporters(UUID) TO authenticated;
