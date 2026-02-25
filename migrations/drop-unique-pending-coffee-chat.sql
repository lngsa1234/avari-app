-- Drop the unique pending request constraint on coffee_chats
-- This allows multiple pending requests between the same pair of users
DROP INDEX IF EXISTS idx_unique_pending_request;
