-- Add 'abandoned' and 'scheduled' to coffee_chats status constraint
-- 'abandoned' = call never connected or no-show (distinct from 'completed')
-- 'scheduled' = was already referenced in queries but missing from constraint
ALTER TABLE coffee_chats DROP CONSTRAINT IF EXISTS coffee_chats_status_check;
ALTER TABLE coffee_chats ADD CONSTRAINT coffee_chats_status_check
  CHECK (status IN ('pending', 'accepted', 'scheduled', 'declined', 'cancelled', 'completed', 'abandoned'));
