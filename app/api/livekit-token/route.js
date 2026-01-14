import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

/**
 * Generate LiveKit access token for video calls
 *
 * POST /api/livekit-token
 * Body: { roomId, participantId, participantName }
 */
export async function POST(request) {
  try {
    const { roomId, participantId, participantName } = await request.json();

    if (!roomId || !participantId) {
      return NextResponse.json(
        { error: 'Missing required fields: roomId and participantId' },
        { status: 400 }
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

    // Create access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName || participantId,
      // Token expires in 6 hours
      ttl: 6 * 60 * 60,
    });

    // Grant room access
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    console.log(`[LiveKit Token] Generated token for ${participantId} in room ${roomId}`);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('[LiveKit Token] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
