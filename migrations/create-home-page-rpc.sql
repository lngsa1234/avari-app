-- Single RPC function that returns ALL home page data in one database round-trip
-- Including meetups + coffee profiles (eliminates Round 2)

CREATE OR REPLACE FUNCTION get_home_page_data(p_user_id UUID, p_cutoff_date TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_member_circle_ids UUID[];
BEGIN
  -- Pre-compute member circle IDs (used for meetups filter)
  SELECT COALESCE(array_agg(group_id), '{}')
  INTO v_member_circle_ids
  FROM connection_group_members
  WHERE user_id = p_user_id AND status = 'accepted';

  SELECT json_build_object(
    'member_circle_ids', COALESCE((
      SELECT json_agg(unnest) FROM unnest(v_member_circle_ids)
    ), '[]'::json),

    'user_signups', COALESCE((
      SELECT json_agg(meetup_id)
      FROM meetup_signups
      WHERE user_id = p_user_id
    ), '[]'::json),

    'coffee_chats', COALESCE((
      SELECT json_agg(row_to_json(c) ORDER BY c.scheduled_time ASC)
      FROM coffee_chats c
      WHERE c.status IN ('pending', 'accepted', 'scheduled')
        AND (c.requester_id = p_user_id OR c.recipient_id = p_user_id)
    ), '[]'::json),

    'unread_count', COALESCE((
      SELECT count(*)::int
      FROM messages
      WHERE receiver_id = p_user_id AND read = false
    ), 0),

    'groups_count', array_length(v_member_circle_ids, 1),

    'coffee_completed_count', COALESCE((
      SELECT count(*)::int
      FROM coffee_chats
      WHERE status = 'completed'
        AND (requester_id = p_user_id OR recipient_id = p_user_id)
    ), 0),

    'incoming_interests', COALESCE((
      SELECT json_agg(json_build_object('user_id', user_id, 'created_at', created_at))
      FROM user_interests
      WHERE interested_in_user_id = p_user_id
    ), '[]'::json),

    'attended_signups', COALESCE((
      SELECT json_agg(json_build_object(
        'meetup_id', ms.meetup_id,
        'date', m.date,
        'time', m.time
      ))
      FROM meetup_signups ms
      JOIN meetups m ON m.id = ms.meetup_id
      WHERE ms.user_id = p_user_id
    ), '[]'::json),

    'created_circles', COALESCE((
      SELECT json_agg(json_build_object('id', id, 'name', name))
      FROM connection_groups
      WHERE creator_id = p_user_id AND is_active = true
    ), '[]'::json),

    'circle_invitations', COALESCE((
      SELECT json_agg(json_build_object(
        'id', cgm.id,
        'group_id', cgm.group_id,
        'invited_at', cgm.invited_at,
        'circle_name', cg.name,
        'creator_id', cg.creator_id
      ))
      FROM connection_group_members cgm
      JOIN connection_groups cg ON cg.id = cgm.group_id
      WHERE cgm.user_id = p_user_id AND cgm.status = 'invited'
    ), '[]'::json),

    -- Upcoming meetups (public + user's circles), with host and circle info
    'meetups', COALESCE((
      SELECT json_agg(row_order)
      FROM (
        SELECT json_build_object(
          'id', m.id,
          'topic', m.topic,
          'description', m.description,
          'date', m.date,
          'time', m.time,
          'location', m.location,
          'duration', m.duration,
          'participant_limit', m.participant_limit,
          'circle_id', m.circle_id,
          'created_by', m.created_by,
          'status', m.status,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'vibe_category', m.vibe_category,
          'image_url', m.image_url,
          'timezone', m.timezone,
          'meeting_format', m.meeting_format,
          'connection_groups', CASE
            WHEN cg.id IS NOT NULL THEN json_build_object('id', cg.id, 'name', cg.name)
            ELSE NULL
          END,
          'host', CASE
            WHEN hp.id IS NOT NULL THEN json_build_object('id', hp.id, 'name', hp.name, 'profile_picture', hp.profile_picture)
            ELSE NULL
          END
        ) as row_order
        FROM meetups m
        LEFT JOIN connection_groups cg ON cg.id = m.circle_id
        LEFT JOIN profiles hp ON hp.id = m.created_by
        WHERE m.date >= p_cutoff_date
          AND m.status != 'cancelled'
          AND (m.circle_id IS NULL OR m.circle_id = ANY(v_member_circle_ids))
        ORDER BY m.date ASC, m.time ASC
      ) sub
    ), '[]'::json),

    -- Coffee chat partner profiles
    'coffee_profiles', COALESCE((
      SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
      FROM profiles p
      WHERE p.id IN (
        SELECT CASE
          WHEN c.requester_id = p_user_id THEN c.recipient_id
          ELSE c.requester_id
        END
        FROM coffee_chats c
        WHERE c.status IN ('pending', 'accepted', 'scheduled')
          AND (c.requester_id = p_user_id OR c.recipient_id = p_user_id)
      )
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
