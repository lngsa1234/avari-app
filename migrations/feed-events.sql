-- ============================================================
-- CircleW Live Feed — feed_events table + RLS + auto-triggers
-- Adapted to actual schema: connection_groups, user_interests,
-- video_signals, profiles.name, profiles.profile_picture
-- ============================================================

-- 1. Add 'type' column to video_signals if not present
ALTER TABLE public.video_signals ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. ENUM for event types
DO $$ BEGIN
  CREATE TYPE feed_event_type AS ENUM (
    'coffee_live',
    'coffee_scheduled',
    'connection',
    'circle_join',
    'circle_schedule',
    'community_event'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add coffee_scheduled to existing enum if it was already created
ALTER TYPE feed_event_type ADD VALUE IF NOT EXISTS 'coffee_scheduled';

-- 3. Main feed_events table
CREATE TABLE IF NOT EXISTS public.feed_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    feed_event_type NOT NULL,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  circle_id     UUID REFERENCES public.connection_groups(id) ON DELETE CASCADE,
  metadata      JSONB DEFAULT '{}',
  is_live       BOOLEAN DEFAULT false,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS feed_events_created_at_idx ON public.feed_events (created_at DESC);
CREATE INDEX IF NOT EXISTS feed_events_is_live_idx ON public.feed_events (is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS feed_events_expires_at_idx ON public.feed_events (expires_at) WHERE expires_at IS NOT NULL;

-- 4. RLS
ALTER TABLE public.feed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view feed" ON public.feed_events;
CREATE POLICY "Anyone authenticated can view feed"
  ON public.feed_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System and actors can insert" ON public.feed_events;
CREATE POLICY "System and actors can insert"
  ON public.feed_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Actors can delete their own events" ON public.feed_events;
CREATE POLICY "Actors can delete their own events"
  ON public.feed_events FOR DELETE
  TO authenticated
  USING (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Actors can update their own events" ON public.feed_events;
CREATE POLICY "Actors can update their own events"
  ON public.feed_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = actor_id);

-- 5. Expire feed events (run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.expire_feed_events()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.feed_events
  WHERE expires_at IS NOT NULL AND expires_at < now();
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 6. Video signal → coffee_live feed event
--    JOIN: if first active user in channel, create live event
--    LEAVE: if no remaining active users, flip is_live off
CREATE OR REPLACE FUNCTION public.fn_video_signal_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NEW.type = 'join' THEN
    -- Count active users: joins minus leaves for this channel
    SELECT COUNT(*) INTO active_count
    FROM (
      SELECT user_id,
             SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) AS net
      FROM public.video_signals
      WHERE channel_name = NEW.channel_name
      GROUP BY user_id
      HAVING SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) > 0
    ) active;

    -- First active user → create live feed event
    IF active_count = 1 THEN
      INSERT INTO public.feed_events (event_type, actor_id, is_live, expires_at, metadata)
      VALUES (
        'coffee_live',
        NEW.user_id,
        true,
        now() + interval '2 hours',
        jsonb_build_object('channel_name', NEW.channel_name)
      );
    ELSIF active_count = 2 THEN
      -- Second user joined: update the feed event with target_id
      UPDATE public.feed_events
      SET target_id = NEW.user_id
      WHERE metadata->>'channel_name' = NEW.channel_name
        AND event_type = 'coffee_live'
        AND is_live = true;
    END IF;

  ELSIF NEW.type = 'leave' THEN
    -- Count remaining active users
    SELECT COUNT(*) INTO active_count
    FROM (
      SELECT user_id,
             SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) AS net
      FROM public.video_signals
      WHERE channel_name = NEW.channel_name
      GROUP BY user_id
      HAVING SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) > 0
    ) active;

    -- No one left → flip live off
    IF active_count = 0 THEN
      UPDATE public.feed_events
      SET is_live = false
      WHERE metadata->>'channel_name' = NEW.channel_name
        AND event_type = 'coffee_live'
        AND is_live = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_signal_feed_trigger ON public.video_signals;
CREATE TRIGGER video_signal_feed_trigger
  AFTER INSERT ON public.video_signals
  FOR EACH ROW EXECUTE FUNCTION public.fn_video_signal_feed();

-- 7. Mutual match → connection feed event
--    Fires on user_interests INSERT; checks if reverse interest exists
CREATE OR REPLACE FUNCTION public.fn_connection_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Check if the other person already expressed interest back
  IF EXISTS (
    SELECT 1 FROM public.user_interests
    WHERE user_id = NEW.interested_in_user_id
      AND interested_in_user_id = NEW.user_id
  ) THEN
    INSERT INTO public.feed_events (event_type, actor_id, target_id)
    VALUES ('connection', NEW.user_id, NEW.interested_in_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connection_feed_trigger ON public.user_interests;
CREATE TRIGGER connection_feed_trigger
  AFTER INSERT ON public.user_interests
  FOR EACH ROW EXECUTE FUNCTION public.fn_connection_feed();

-- 8. Circle join → circle_join feed event
--    Fires on connection_group_members INSERT with status = 'accepted'
CREATE OR REPLACE FUNCTION public.fn_circle_join_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    INSERT INTO public.feed_events (event_type, actor_id, circle_id, metadata)
    VALUES (
      'circle_join',
      NEW.user_id,
      NEW.group_id,
      jsonb_build_object('circle_name', (SELECT name FROM public.connection_groups WHERE id = NEW.group_id))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_join_feed_trigger ON public.connection_group_members;
CREATE TRIGGER circle_join_feed_trigger
  AFTER INSERT ON public.connection_group_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_circle_join_feed();

-- 9. Meetup insert → community_event or circle_schedule feed event
CREATE OR REPLACE FUNCTION public.fn_meetup_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.circle_id IS NULL THEN
    -- Community event
    INSERT INTO public.feed_events (event_type, actor_id, metadata)
    VALUES (
      'community_event',
      NEW.created_by,
      jsonb_build_object('title', COALESCE(NEW.topic, 'Community Event'), 'meetup_id', NEW.id, 'date', NEW.date, 'time', NEW.time, 'location', NEW.location, 'format', NEW.meeting_format)
    );
  ELSE
    -- Circle session scheduled
    INSERT INTO public.feed_events (event_type, actor_id, circle_id, metadata)
    VALUES (
      'circle_schedule',
      NEW.created_by,
      NEW.circle_id,
      jsonb_build_object(
        'circle_name', (SELECT name FROM public.connection_groups WHERE id = NEW.circle_id),
        'meetup_id', NEW.id,
        'date', NEW.date,
        'time', NEW.time
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meetup_feed_trigger ON public.meetups;
CREATE TRIGGER meetup_feed_trigger
  AFTER INSERT ON public.meetups
  FOR EACH ROW EXECUTE FUNCTION public.fn_meetup_feed();

-- 10. Coffee chat scheduled/accepted → coffee_scheduled feed event
--     INSERT: creates feed event with status 'pending'
--     UPDATE to 'accepted': updates existing feed event metadata
CREATE OR REPLACE FUNCTION public.fn_coffee_scheduled_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.feed_events (event_type, actor_id, target_id, metadata)
    VALUES (
      'coffee_scheduled',
      NEW.requester_id,
      NEW.recipient_id,
      jsonb_build_object(
        'chat_id', NEW.id,
        'topic', COALESCE(NEW.topic, 'Coffee Chat'),
        'scheduled_time', NEW.scheduled_time,
        'status', NEW.status
      )
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.feed_events
    SET metadata = metadata || jsonb_build_object('status', 'accepted'),
        created_at = now()
    WHERE event_type = 'coffee_scheduled'
      AND metadata->>'chat_id' = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coffee_scheduled_feed_trigger ON public.coffee_chats;
CREATE TRIGGER coffee_scheduled_feed_trigger
  AFTER INSERT OR UPDATE ON public.coffee_chats
  FOR EACH ROW EXECUTE FUNCTION public.fn_coffee_scheduled_feed();

-- 11. Enable Realtime on feed_events
-- 12. New member joined → member_joined feed event
CREATE OR REPLACE FUNCTION public.fn_member_joined_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    INSERT INTO public.feed_events (event_type, actor_id, metadata)
    VALUES (
      'member_joined',
      NEW.id,
      jsonb_build_object(
        'career', COALESCE(NEW.career, ''),
        'location', COALESCE(NEW.city || CASE WHEN NEW.state IS NOT NULL THEN ', ' || NEW.state ELSE '' END, ''),
        'industry', COALESCE(NEW.industry, ''),
        'hook', COALESCE(NEW.hook, '')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_joined_feed_trigger ON public.profiles;
CREATE TRIGGER member_joined_feed_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_member_joined_feed();

-- 13. Enable Realtime on feed_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_events;
