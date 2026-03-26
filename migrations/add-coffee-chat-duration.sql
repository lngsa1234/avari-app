-- Add duration column to coffee_chats (in minutes, default 30)
ALTER TABLE public.coffee_chats ADD COLUMN IF NOT EXISTS duration integer DEFAULT 30;
