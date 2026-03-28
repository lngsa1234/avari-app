-- Fix video_signals: add missing columns if needed
-- Table already exists with: id, room_id, type, data, created_at, sender_id, channel_name
-- The feed-events trigger references user_id but the column is sender_id — fix the trigger

-- Update the feed trigger to use sender_id instead of user_id
CREATE OR REPLACE FUNCTION public.fn_video_signal_feed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NEW.type = 'join' THEN
    SELECT COUNT(*) INTO active_count
    FROM (
      SELECT sender_id,
             SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) AS net
      FROM public.video_signals
      WHERE channel_name = NEW.channel_name
      GROUP BY sender_id
      HAVING SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) > 0
    ) active;

    IF active_count = 1 THEN
      INSERT INTO public.feed_events (event_type, actor_id, is_live, expires_at, metadata)
      VALUES (
        'coffee_live',
        NEW.sender_id,
        true,
        now() + interval '2 hours',
        jsonb_build_object('channel_name', NEW.channel_name)
      );
    ELSIF active_count = 2 THEN
      UPDATE public.feed_events
      SET target_id = NEW.sender_id
      WHERE metadata->>'channel_name' = NEW.channel_name
        AND event_type = 'coffee_live'
        AND is_live = true;
    END IF;

  ELSIF NEW.type = 'leave' THEN
    SELECT COUNT(*) INTO active_count
    FROM (
      SELECT sender_id,
             SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) AS net
      FROM public.video_signals
      WHERE channel_name = NEW.channel_name
      GROUP BY sender_id
      HAVING SUM(CASE WHEN type = 'join' THEN 1 ELSE -1 END) > 0
    ) active;

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
