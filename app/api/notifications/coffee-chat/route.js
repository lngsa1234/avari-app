import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendCoffeeChatEmail } from '@/lib/emailHelpers';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(url, key);
}

/**
 * POST /api/notifications/coffee-chat
 *
 * Sends an email notification for coffee chat events.
 * Best-effort: always returns { success: true }.
 */
export async function POST(request) {
  try {
    const { notificationType, chatId } = await request.json();

    if (!notificationType || !chatId) {
      return NextResponse.json({ success: true, skipped: 'missing params' });
    }

    const supabase = getSupabaseClient();

    // Fetch coffee chat with both profiles
    const { data: chat, error: chatError } = await supabase
      .from('coffee_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chat) {
      console.error('[Notification] Failed to fetch chat:', chatError);
      return NextResponse.json({ success: true, skipped: 'chat not found' });
    }

    // Fetch both profiles in parallel
    const [requesterResult, recipientResult] = await Promise.all([
      supabase.from('profiles').select('id, name, email, career').eq('id', chat.requester_id).single(),
      supabase.from('profiles').select('id, name, email, career').eq('id', chat.recipient_id).single(),
    ]);

    if (requesterResult.error || recipientResult.error) {
      console.error('[Notification] Failed to fetch profiles:', requesterResult.error, recipientResult.error);
      return NextResponse.json({ success: true, skipped: 'profiles not found' });
    }

    await sendCoffeeChatEmail(notificationType, chat, requesterResult.data, recipientResult.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notification] Error:', error);
    return NextResponse.json({ success: true, error: 'internal' });
  }
}
