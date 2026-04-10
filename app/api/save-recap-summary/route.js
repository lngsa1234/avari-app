import { NextResponse } from 'next/server';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

const TRANSCRIPT_BUCKET = 'call-transcripts';

/**
 * Save AI-generated recap summary to Supabase Storage.
 * Uses service role to bypass RLS (any participant can trigger this).
 *
 * POST /api/save-recap-summary
 * Body: { recapId, aiSummary }
 */
export async function POST(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { recapId, aiSummary } = await request.json();

    if (!recapId || !aiSummary) {
      return NextResponse.json({ error: 'Missing recapId or aiSummary' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the recap's storage path
    const { data: recap, error: fetchError } = await supabase
      .from('call_recaps')
      .select('id, channel_name, transcript_path')
      .eq('id', recapId)
      .single();

    if (fetchError) {
      console.error('[SaveRecapSummary] Fetch failed:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const storagePath = recap.transcript_path || `recaps/${recap.channel_name}.json`;

    // Download existing storage file, merge summary
    let existing = { transcript: [], aiSummary: null };
    const { data: fileData, error: dlError } = await supabase.storage
      .from(TRANSCRIPT_BUCKET)
      .download(storagePath);

    if (!dlError && fileData) {
      try {
        existing = JSON.parse(await fileData.text());
      } catch (e) {
        // File doesn't exist or invalid — will create new
      }
    }

    existing.aiSummary = aiSummary;

    const { error: uploadError } = await supabase.storage
      .from(TRANSCRIPT_BUCKET)
      .upload(storagePath, JSON.stringify(existing), {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      console.error('[SaveRecapSummary] Storage upload failed:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Update recap row: ensure transcript_path is set + write ai_summary to DB
    // so the Past tab can read it directly without a storage fetch
    const updateFields = { ai_summary: aiSummary };
    if (!recap.transcript_path) updateFields.transcript_path = storagePath;
    await supabase
      .from('call_recaps')
      .update(updateFields)
      .eq('id', recapId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SaveRecapSummary] Error:', error);
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
  }
}
