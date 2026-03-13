-- Add discussion_topics column to meetup_icebreakers table
-- This caches AI-generated discussion topics so they're only generated once per meetup
ALTER TABLE meetup_icebreakers
ADD COLUMN IF NOT EXISTS discussion_topics JSONB;
