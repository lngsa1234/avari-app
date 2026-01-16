-- ============================================================================
-- DATABASE MIGRATION: MEETUP PROPOSALS
-- ============================================================================
-- This migration adds support for user-requested meetups that require admin
-- approval before becoming visible to all users.
--
-- Features:
-- - Users can propose meetups with topic, date, and time
-- - Admins review and approve/reject proposals
-- - Approved proposals become regular meetups
-- - Audit trail tracks reviewer and review decision
-- ============================================================================

-- ============================================================================
-- TABLE: meetup_proposals
-- ============================================================================
-- Stores user-proposed meetups awaiting admin review
CREATE TABLE IF NOT EXISTS public.meetup_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  approved_meetup_id UUID REFERENCES meetups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_title CHECK (char_length(title) >= 5 AND char_length(title) <= 200),
  CONSTRAINT valid_description CHECK (description IS NULL OR char_length(description) <= 1000),
  CONSTRAINT future_date CHECK (date >= CURRENT_DATE)
);

-- Indexes for meetup_proposals
CREATE INDEX idx_meetup_proposals_user ON meetup_proposals(user_id);
CREATE INDEX idx_meetup_proposals_status ON meetup_proposals(status);
CREATE INDEX idx_meetup_proposals_date ON meetup_proposals(date);
CREATE INDEX idx_meetup_proposals_created ON meetup_proposals(created_at);
CREATE INDEX idx_meetup_proposals_reviewed ON meetup_proposals(reviewed_by);

-- Comments
COMMENT ON TABLE meetup_proposals IS 'Stores user-proposed meetups awaiting admin approval';
COMMENT ON COLUMN meetup_proposals.title IS 'Meetup topic/title (5-200 characters)';
COMMENT ON COLUMN meetup_proposals.date IS 'Proposed meetup date (must be in future)';
COMMENT ON COLUMN meetup_proposals.time IS 'Proposed meetup time';
COMMENT ON COLUMN meetup_proposals.status IS 'Proposal status: pending, approved, rejected';
COMMENT ON COLUMN meetup_proposals.reviewed_by IS 'Admin who reviewed the proposal';
COMMENT ON COLUMN meetup_proposals.reviewed_at IS 'When the proposal was reviewed';
COMMENT ON COLUMN meetup_proposals.rejection_reason IS 'Reason for rejection (if rejected)';
COMMENT ON COLUMN meetup_proposals.approved_meetup_id IS 'ID of created meetup (if approved)';

-- ============================================================================
-- ALTER: meetups table
-- ============================================================================
-- Add column to link back to proposal if created from user request
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetups' AND column_name = 'proposal_id'
  ) THEN
    ALTER TABLE meetups ADD COLUMN proposal_id UUID REFERENCES meetup_proposals(id) ON DELETE SET NULL;
    CREATE INDEX idx_meetups_proposal ON meetups(proposal_id);
    COMMENT ON COLUMN meetups.proposal_id IS 'Links to user proposal if meetup was created from a proposal';
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on meetup_proposals
ALTER TABLE meetup_proposals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: meetup_proposals
-- ============================================================================

-- Users can view their own proposals
CREATE POLICY "Users can view own proposals"
  ON meetup_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all proposals
CREATE POLICY "Admins can view all proposals"
  ON meetup_proposals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can create proposals
CREATE POLICY "Users can create proposals"
  ON meetup_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending proposals
CREATE POLICY "Users can update own pending proposals"
  ON meetup_proposals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any proposal (for approval/rejection)
CREATE POLICY "Admins can update proposals"
  ON meetup_proposals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can delete their own pending proposals
CREATE POLICY "Users can delete own pending proposals"
  ON meetup_proposals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can delete any proposal
CREATE POLICY "Admins can delete proposals"
  ON meetup_proposals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON meetup_proposals TO authenticated;

-- Grant full access to service_role (for admin operations)
GRANT ALL ON meetup_proposals TO service_role;

-- ============================================================================
-- FUNCTION: Update updated_at timestamp
-- ============================================================================
-- Automatically update updated_at when proposal is modified
CREATE OR REPLACE FUNCTION update_meetup_proposal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS set_meetup_proposal_updated_at ON meetup_proposals;
CREATE TRIGGER set_meetup_proposal_updated_at
  BEFORE UPDATE ON meetup_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_meetup_proposal_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To apply this migration:
-- 1. Open Supabase SQL Editor
-- 2. Paste this entire file
-- 3. Execute
-- 4. Verify table created: SELECT * FROM meetup_proposals;
-- 5. Verify meetups.proposal_id column added: \d meetups
-- ============================================================================
