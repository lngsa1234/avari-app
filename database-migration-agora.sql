-- Database Migration for Agora Integration
-- Run this SQL in your Supabase SQL Editor

-- 1. Create agora_rooms table for group video calls
CREATE TABLE IF NOT EXISTS public.agora_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_name TEXT NOT NULL UNIQUE,
  meetup_id UUID REFERENCES public.meetups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_meetup_room UNIQUE(meetup_id)
);

-- 2. Add agora_link column to meetups table
ALTER TABLE public.meetups
ADD COLUMN IF NOT EXISTS agora_link TEXT;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agora_rooms_channel_name ON public.agora_rooms(channel_name);
CREATE INDEX IF NOT EXISTS idx_agora_rooms_meetup_id ON public.agora_rooms(meetup_id);
CREATE INDEX IF NOT EXISTS idx_agora_rooms_is_active ON public.agora_rooms(is_active);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.agora_rooms ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for agora_rooms
-- Allow authenticated users to read all agora rooms
CREATE POLICY "Allow authenticated users to read agora rooms"
  ON public.agora_rooms
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create agora rooms
CREATE POLICY "Allow authenticated users to create agora rooms"
  ON public.agora_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow creators to update their rooms
CREATE POLICY "Allow creators to update their agora rooms"
  ON public.agora_rooms
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Allow admins to update any room
CREATE POLICY "Allow admins to update any agora room"
  ON public.agora_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Grant permissions
GRANT ALL ON public.agora_rooms TO authenticated;
GRANT ALL ON public.agora_rooms TO service_role;

-- 7. Create a function to automatically create agora room when meetup is created
CREATE OR REPLACE FUNCTION public.create_agora_room_for_meetup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create agora room if meetup has a date in the future
  IF NEW.date >= CURRENT_DATE THEN
    INSERT INTO public.agora_rooms (channel_name, meetup_id, created_by)
    VALUES (
      'meetup-' || NEW.id::text,
      NEW.id,
      NEW.created_by
    )
    ON CONFLICT (meetup_id) DO NOTHING;

    -- Update the meetup with the agora link
    NEW.agora_link := '/group-meeting/meetup-' || NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create trigger to auto-create agora room (optional - uncomment if you want automatic creation)
-- DROP TRIGGER IF EXISTS trigger_create_agora_room ON public.meetups;
-- CREATE TRIGGER trigger_create_agora_room
--   BEFORE INSERT ON public.meetups
--   FOR EACH ROW
--   EXECUTE FUNCTION public.create_agora_room_for_meetup();

-- Migration complete!
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Add NEXT_PUBLIC_AGORA_APP_ID to your .env.local file
-- 3. Restart your Next.js development server
