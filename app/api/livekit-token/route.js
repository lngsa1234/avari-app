import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

/**
 * Generate LiveKit access token for video calls.
 *
 * POST /api/livekit-token
 * Body: { roomId, participantName? }
 *
 * Authenticates the caller, verifies they are a member of the requested room,
 * and issues a token whose identity is the authenticated user's id. The body's
 * participantId is ignored — identity always comes from the session.
 */
export async function POST(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { roomId, participantName } = await request.json();
    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid roomId' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const authorized = await isRoomMember(supabase, roomId, user.id);
    if (!authorized) {
      console.warn(`[LiveKit Token] Denied: user ${user.id} not a member of room ${roomId}`);
      return NextResponse.json(
        { error: 'Not authorized for this room' },
        { status: 403 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error('[LiveKit Token] API credentials not configured');
      return NextResponse.json(
        { error: 'LiveKit not configured' },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participantName || user.email || user.id,
      ttl: 6 * 60 * 60,
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    console.log(`[LiveKit Token] Issued token for user ${user.id} in room ${roomId}`);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[LiveKit Token] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);

/**
 * Verify the user is authorized to join the given room.
 *
 * Room id formats (see hooks/useCallRoom.js for the canonical mapping):
 *   coffee-{coffee_chat_id}              — requester_id or recipient_id must match
 *   meetup-{meetup_id}                   — signed up in meetup_signups OR meetup creator
 *   connection-group-{meetup_id|group_id} — accepted member of the resolved group
 */
async function isRoomMember(supabase, roomId, userId) {
  if (roomId.startsWith('coffee-')) {
    const chatId = roomId.slice('coffee-'.length);
    if (!isUuid(chatId)) return false;
    const { data } = await supabase
      .from('coffee_chats')
      .select('requester_id, recipient_id')
      .eq('id', chatId)
      .maybeSingle();
    if (!data) return false;
    return data.requester_id === userId || data.recipient_id === userId;
  }

  // Must check connection-group- BEFORE meetup- since neither is a substring
  // of the other, but order matters if any future prefix overlaps.
  if (roomId.startsWith('connection-group-')) {
    const extractedId = roomId.slice('connection-group-'.length);
    if (!isUuid(extractedId)) return false;

    // The extracted id may be a meetups.id (new format) that maps to a
    // connection_groups.id via meetups.circle_id, or a direct group id (legacy).
    let groupId = extractedId;
    const { data: meetupMatch } = await supabase
      .from('meetups')
      .select('circle_id')
      .eq('id', extractedId)
      .maybeSingle();
    if (meetupMatch?.circle_id) groupId = meetupMatch.circle_id;

    const { data } = await supabase
      .from('connection_group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();
    return !!data;
  }

  if (roomId.startsWith('meetup-')) {
    const meetupId = roomId.slice('meetup-'.length);
    if (!isUuid(meetupId)) return false;

    const [meetupRes, signupRes] = await Promise.all([
      supabase
        .from('meetups')
        .select('created_by')
        .eq('id', meetupId)
        .maybeSingle(),
      supabase
        .from('meetup_signups')
        .select('user_id')
        .eq('meetup_id', meetupId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (!meetupRes.data) return false;
    return meetupRes.data.created_by === userId || !!signupRes.data;
  }

  return false;
}
