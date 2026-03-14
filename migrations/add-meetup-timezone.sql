-- Add timezone column to meetups table
-- Stores IANA timezone string (e.g. 'America/New_York') so event times
-- can be correctly displayed and compared across timezones.

ALTER TABLE meetups ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Backfill existing events with America/New_York (most events are US-based)
UPDATE meetups SET timezone = 'America/New_York' WHERE timezone IS NULL;
