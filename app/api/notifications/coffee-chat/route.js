import { NextResponse } from 'next/server';
import { sendCoffeeChatEmail } from '@/lib/emailHelpers';
import { authenticateRequest, createAdminClient } from '@/lib/apiAuth';

/**
 * POST /api/notifications/coffee-chat
 *
 * Sends an email notification for coffee chat events.
 * Best-effort: always returns { success: true }.
 */
export async function POST(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { notificationType, chatId } = await request.json();

    if (!notificationType || !chatId) {
      return NextResponse.json({ success: true, skipped: 'missing params' });
    }

    const supabase = createAdminClient();

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
