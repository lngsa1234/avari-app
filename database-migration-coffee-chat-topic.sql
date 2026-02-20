-- ============================================================================
-- DATABASE MIGRATION: Add topic column to coffee_chats
-- ============================================================================
-- Run this in your Supabase SQL editor

ALTER TABLE public.coffee_chats
ADD COLUMN IF NOT EXISTS topic TEXT;

COMMENT ON COLUMN coffee_chats.topic IS 'Topic/subject for the coffee chat';
