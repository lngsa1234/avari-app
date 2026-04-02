import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Auto-abandon stale coffee chats that never connected.
 *
 * Marks 'accepted'/'scheduled' coffee chats as 'abandoned' when:
 * - scheduled_time is more than 2 hours in the past
 * - No matching call_recaps exist (call never happened)
 *
 * Called by the daily cron orchestrator at /api/cron/agent
 */
export async function POST(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const incomingSecret = request.headers.get('x-cron-secret');
    if (cronSecret && incomingSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find stale accepted/scheduled chats past their window
    const { data: staleChatIds, error: fetchError } = await supabase
      .from('coffee_chats')
      .select('id')
      .in('status', ['accepted', 'scheduled'])
      .lt('scheduled_time', twoHoursAgo);

    if (fetchError) throw fetchError;
    if (!staleChatIds || staleChatIds.length === 0) {
      return NextResponse.json({ abandoned: 0 });
    }

    const ids = staleChatIds.map(c => c.id);

    // Check which ones have recaps (call actually happened)
    const { data: recaps } = await supabase
      .from('call_recaps')
      .select('channel_name')
      .or(ids.map(id => `channel_name.eq.coffee-${id}`).join(','));

    const recapChannels = new Set((recaps || []).map(r => r.channel_name));
    const toAbandon = ids.filter(id => !recapChannels.has(`coffee-${id}`));

    if (toAbandon.length === 0) {
      return NextResponse.json({ abandoned: 0, hadRecaps: ids.length });
    }

    const { error: updateError } = await supabase
      .from('coffee_chats')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .in('id', toAbandon);

    if (updateError) throw updateError;

    console.log(`[Cron] Abandoned ${toAbandon.length} stale coffee chats`);
    return NextResponse.json({ abandoned: toAbandon.length });
  } catch (error) {
    console.error('[Cron] abandon-stale error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
