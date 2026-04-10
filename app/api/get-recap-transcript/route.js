import { NextResponse } from 'next/server';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

const TRANSCRIPT_BUCKET = 'call-transcripts';

/**
 * Fetch transcript + AI summary from Supabase Storage.
 * Uses service role to bypass storage RLS policies.
 *
 * GET /api/get-recap-transcript?path=recaps/channel-name.json
 */
export async function GET(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const transcriptPath = searchParams.get('path');

    if (!transcriptPath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Validate path format to prevent directory traversal
    if (!transcriptPath.startsWith('recaps/') || transcriptPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.storage
      .from(TRANSCRIPT_BUCKET)
      .download(transcriptPath);

    if (error) {
      console.error('[GetRecapTranscript] Storage download error:', error);
      return NextResponse.json({ transcript: [], aiSummary: null });
    }

    const parsed = JSON.parse(await data.text());
    return NextResponse.json({
      transcript: parsed.transcript || [],
      aiSummary: parsed.aiSummary || null,
    });
  } catch (error) {
    console.error('[GetRecapTranscript] Error:', error);
    return NextResponse.json({ transcript: [], aiSummary: null });
  }
}
