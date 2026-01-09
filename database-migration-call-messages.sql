-- Database Migration for Call Messaging Feature
-- Run this SQL in your Supabase SQL Editor

-- 1. Create call_messages table for in-call chat
CREATE TABLE IF NOT EXISTS public.call_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_messages_channel ON public.call_messages(channel_name);
CREATE INDEX IF NOT EXISTS idx_call_messages_created_at ON public.call_messages(created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.call_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for call_messages
-- Allow authenticated users to read all messages in channels they're in
CREATE POLICY "Allow authenticated users to read call messages"
  ON public.call_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert their own messages
CREATE POLICY "Allow authenticated users to send call messages"
  ON public.call_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Grant permissions
GRANT ALL ON public.call_messages TO authenticated;
GRANT ALL ON public.call_messages TO service_role;

-- 6. Create a function to automatically delete old messages (older than 24 hours)
CREATE OR REPLACE FUNCTION public.delete_old_call_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.call_messages
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration complete!
