-- ============================================================================
-- FIX: Enable Real-Time for Group Messages
-- ============================================================================
-- This just enables real-time for the already existing table
-- Run this if you already ran the original migration
-- ============================================================================

-- Enable real-time for group messages
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'connection_group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE connection_group_messages;
    RAISE NOTICE 'Real-time enabled for connection_group_messages';
  ELSE
    RAISE NOTICE 'Real-time already enabled for connection_group_messages';
  END IF;
END $$;

-- Verify real-time is enabled
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'connection_group_messages';

-- If you see a result, real-time is enabled!
