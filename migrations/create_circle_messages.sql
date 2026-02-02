-- Create circle_messages table for group chat in circles
-- Run this in your Supabase SQL editor

-- Create the circle_messages table
CREATE TABLE IF NOT EXISTS circle_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES connection_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_circle_messages_circle_id ON circle_messages(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_messages_sender_id ON circle_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_circle_messages_created_at ON circle_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in circles they are members of
CREATE POLICY "Users can view circle messages they are members of"
  ON circle_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE connection_group_members.group_id = circle_messages.circle_id
      AND connection_group_members.user_id = auth.uid()
    )
  );

-- Policy: Users can insert messages in circles they are members of
CREATE POLICY "Users can send messages in circles they are members of"
  ON circle_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM connection_group_members
      WHERE connection_group_members.group_id = circle_messages.circle_id
      AND connection_group_members.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON circle_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Grant permissions
GRANT ALL ON circle_messages TO authenticated;
GRANT ALL ON circle_messages TO service_role;
