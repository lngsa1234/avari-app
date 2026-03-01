-- Add meeting_format column to meetups table
ALTER TABLE meetups
  ADD COLUMN IF NOT EXISTS meeting_format TEXT DEFAULT 'virtual'
  CHECK (meeting_format IN ('virtual', 'in_person', 'hybrid'));

-- Backfill existing rows:
-- Rows where location is NULL or 'Virtual' → 'virtual', otherwise → 'in_person'
UPDATE meetups
  SET meeting_format = CASE
    WHEN location IS NULL OR location = 'Virtual' THEN 'virtual'
    ELSE 'in_person'
  END
  WHERE meeting_format IS NULL;

-- Add signup_type column to meetup_signups (for hybrid attendance tracking)
ALTER TABLE meetup_signups
  ADD COLUMN IF NOT EXISTS signup_type TEXT DEFAULT 'video'
  CHECK (signup_type IN ('in_person', 'video'));
