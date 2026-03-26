import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

/**
 * Save AI-generated recap summary to call_recaps.
 * Uses service role to bypass RLS (any participant can trigger this).
 *
 * POST /api/save-recap-summary
 * Body: { recapId, aiSummary }
 */
export async function POST(request) {
  try {
    const { recapId, aiSummary } = await request.json();

    if (!recapId || !aiSummary) {
      return NextResponse.json({ error: 'Missing recapId or aiSummary' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('call_recaps')
      .update({ ai_summary: aiSummary })
      .eq('id', recapId);

    if (error) {
      console.error('[SaveRecapSummary] Update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SaveRecapSummary] Error:', error);
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
  }
}
