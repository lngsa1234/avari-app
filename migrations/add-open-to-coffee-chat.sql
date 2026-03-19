-- Add "Open to Coffee Chat" toggle to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_to_coffee_chat BOOLEAN DEFAULT false;
