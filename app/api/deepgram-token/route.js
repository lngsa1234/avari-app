import { NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';

/**
 * Generate a temporary Deepgram API key for client-side transcription
 *
 * POST /api/deepgram-token
 */
export async function POST() {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    const projectId = process.env.DEEPGRAM_PROJECT_ID;

    if (!apiKey || !projectId) {
      console.error('[Deepgram Token] API credentials not configured');
      return NextResponse.json(
        { error: 'Deepgram not configured' },
        { status: 500 }
      );
    }

    const deepgram = createClient(apiKey);

    const { result, error } = await deepgram.manage.createProjectKey(projectId, {
      comment: 'Temporary transcription key',
      scopes: ['usage:write'],
      time_to_live_in_seconds: 60,
    });

    if (error) {
      console.error('[Deepgram Token] Error creating key:', error);
      return NextResponse.json(
        { error: 'Failed to generate Deepgram token' },
        { status: 500 }
      );
    }

    console.log('[Deepgram Token] Generated temporary key');

    return NextResponse.json({ key: result.key });
  } catch (error) {
    console.error('[Deepgram Token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Deepgram token' },
      { status: 500 }
    );
  }
}
