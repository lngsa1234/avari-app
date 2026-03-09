-- Admin Analytics RPC functions for acquisition and retention metrics
-- Run this migration in the Supabase SQL editor

-- Main analytics function that returns all metrics in one call
CREATE OR REPLACE FUNCTION get_admin_analytics(days_back INT DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  -- Only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    -- Total counts
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_onboarded', (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true),
    'total_coffee_chats', (SELECT COUNT(*) FROM coffee_chats),
    'total_meetup_signups', (SELECT COUNT(*) FROM meetup_signups),
    'total_circles', (SELECT COUNT(*) FROM connection_groups WHERE is_active = true),

    -- Active users (based on last_active)
    'dau', (SELECT COUNT(*) FROM profiles WHERE last_active > now_ts - INTERVAL '1 day'),
    'wau', (SELECT COUNT(*) FROM profiles WHERE last_active > now_ts - INTERVAL '7 days'),
    'mau', (SELECT COUNT(*) FROM profiles WHERE last_active > now_ts - INTERVAL '30 days'),

    -- Signups by period (last N days, daily buckets)
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT
          DATE(created_at) AS day,
          COUNT(*) AS count
        FROM profiles
        WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY day
      ) t
    ),

    -- Signups by week
    'signups_by_week', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week), '[]'::jsonb)
      FROM (
        SELECT
          DATE_TRUNC('week', created_at)::DATE AS week,
          COUNT(*) AS count
        FROM profiles
        WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week
      ) t
    ),

    -- Onboarding funnel
    'onboarding_funnel', jsonb_build_object(
      'total_signups', (SELECT COUNT(*) FROM profiles WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'completed_onboarding', (SELECT COUNT(*) FROM profiles WHERE created_at > now_ts - (days_back || ' days')::INTERVAL AND onboarding_completed = true),
      'profile_50_plus', (SELECT COUNT(*) FROM profiles WHERE created_at > now_ts - (days_back || ' days')::INTERVAL AND profile_completion >= 50),
      'profile_complete', (SELECT COUNT(*) FROM profiles WHERE created_at > now_ts - (days_back || ' days')::INTERVAL AND profile_completion >= 100)
    ),

    -- Retention: users by last active bucket
    'activity_buckets', jsonb_build_object(
      'active_today', (SELECT COUNT(*) FROM profiles WHERE last_active > now_ts - INTERVAL '1 day'),
      'active_1_7d', (SELECT COUNT(*) FROM profiles WHERE last_active BETWEEN now_ts - INTERVAL '7 days' AND now_ts - INTERVAL '1 day'),
      'active_7_14d', (SELECT COUNT(*) FROM profiles WHERE last_active BETWEEN now_ts - INTERVAL '14 days' AND now_ts - INTERVAL '7 days'),
      'active_14_30d', (SELECT COUNT(*) FROM profiles WHERE last_active BETWEEN now_ts - INTERVAL '30 days' AND now_ts - INTERVAL '14 days'),
      'inactive_30d_plus', (SELECT COUNT(*) FROM profiles WHERE last_active < now_ts - INTERVAL '30 days' OR last_active IS NULL)
    ),

    -- Weekly cohort retention (signup week → % active last 7 days)
    'cohort_retention', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.cohort_week), '[]'::jsonb)
      FROM (
        SELECT
          DATE_TRUNC('week', p.created_at)::DATE AS cohort_week,
          COUNT(*) AS cohort_size,
          COUNT(*) FILTER (WHERE p.last_active > now_ts - INTERVAL '7 days') AS active_last_7d,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE p.last_active > now_ts - INTERVAL '7 days') / NULLIF(COUNT(*), 0),
            1
          ) AS retention_pct
        FROM profiles p
        WHERE p.created_at > now_ts - (days_back || ' days')::INTERVAL
        GROUP BY DATE_TRUNC('week', p.created_at)
        HAVING COUNT(*) >= 1
        ORDER BY cohort_week
      ) t
    ),

    -- Engagement metrics (last N days)
    'engagement', jsonb_build_object(
      'coffee_chats_completed', (SELECT COUNT(*) FROM coffee_chats WHERE status = 'completed' AND created_at > now_ts - (days_back || ' days')::INTERVAL),
      'coffee_chats_pending', (SELECT COUNT(*) FROM coffee_chats WHERE status = 'pending' AND created_at > now_ts - (days_back || ' days')::INTERVAL),
      'meetup_signups', (SELECT COUNT(*) FROM meetup_signups WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'messages_sent', (SELECT COUNT(*) FROM messages WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'circles_created', (SELECT COUNT(*) FROM connection_groups WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'circles_joined', (SELECT COUNT(*) FROM connection_group_members WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'calls_made', (SELECT COUNT(*) FROM call_recaps WHERE created_at > now_ts - (days_back || ' days')::INTERVAL),
      'total_call_minutes', (SELECT COALESCE(SUM(duration_seconds) / 60, 0) FROM call_recaps WHERE created_at > now_ts - (days_back || ' days')::INTERVAL)
    ),

    -- Engagement over time (weekly)
    'engagement_by_week', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week), '[]'::jsonb)
      FROM (
        SELECT
          d.week,
          COALESCE(cc.cnt, 0) AS coffee_chats,
          COALESCE(ms.cnt, 0) AS meetup_signups,
          COALESCE(msg.cnt, 0) AS messages
        FROM (
          SELECT DATE_TRUNC('week', dd)::DATE AS week
          FROM generate_series(
            now_ts - (days_back || ' days')::INTERVAL,
            now_ts,
            '1 week'::INTERVAL
          ) dd
        ) d
        LEFT JOIN (
          SELECT DATE_TRUNC('week', created_at)::DATE AS week, COUNT(*) AS cnt
          FROM coffee_chats WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) cc ON cc.week = d.week
        LEFT JOIN (
          SELECT DATE_TRUNC('week', created_at)::DATE AS week, COUNT(*) AS cnt
          FROM meetup_signups WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) ms ON ms.week = d.week
        LEFT JOIN (
          SELECT DATE_TRUNC('week', created_at)::DATE AS week, COUNT(*) AS cnt
          FROM messages WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) msg ON msg.week = d.week
        ORDER BY d.week
      ) t
    ),

    -- Top engaged users
    'top_users', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.total_actions DESC), '[]'::jsonb)
      FROM (
        SELECT
          p.id,
          p.name,
          p.email,
          p.last_active,
          p.created_at,
          COALESCE(cc.cnt, 0) AS coffee_chats,
          COALESCE(ms.cnt, 0) AS meetup_signups,
          COALESCE(msg.cnt, 0) AS messages_sent,
          COALESCE(cc.cnt, 0) + COALESCE(ms.cnt, 0) + COALESCE(msg.cnt, 0) AS total_actions
        FROM profiles p
        LEFT JOIN (
          SELECT requester_id AS uid, COUNT(*) AS cnt FROM coffee_chats
          WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) cc ON cc.uid = p.id
        LEFT JOIN (
          SELECT user_id AS uid, COUNT(*) AS cnt FROM meetup_signups
          WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) ms ON ms.uid = p.id
        LEFT JOIN (
          SELECT sender_id AS uid, COUNT(*) AS cnt FROM messages
          WHERE created_at > now_ts - (days_back || ' days')::INTERVAL
          GROUP BY 1
        ) msg ON msg.uid = p.id
        ORDER BY total_actions DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
