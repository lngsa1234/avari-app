-- Migration: Add completed status support for meetups and coffee chats
-- Run this in the Supabase SQL editor

-- 1. Add 'completed' to coffee_chats status CHECK constraint
-- First drop the existing constraint, then re-add with 'completed'
ALTER TABLE coffee_chats DROP CONSTRAINT IF EXISTS coffee_chats_status_check;
ALTER TABLE coffee_chats ADD CONSTRAINT coffee_chats_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

-- 2. Add completed_at timestamp to coffee_chats
ALTER TABLE coffee_chats ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 3. Add status column to meetups (default 'scheduled')
ALTER TABLE meetups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled'
  CHECK (status IN ('scheduled', 'completed', 'cancelled'));

-- 4. Add completed_at timestamp to meetups
ALTER TABLE meetups ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
