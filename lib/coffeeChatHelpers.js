// lib/coffeeChatHelpers.js
// Helper functions for video chat system

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get current user
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Request a video chat
export const requestCoffeeChat = async ({ recipientId, scheduledTime, notes }) => {
  try {
    console.log('📞 Requesting video chat with:', recipientId);
    
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Insert the video chat request
    const { data, error } = await supabase
      .from('coffee_chats')
      .insert([{
        requester_id: user.id,
        recipient_id: recipientId,
        scheduled_time: scheduledTime.toISOString(),
        notes: notes || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Video chat request created:', data);
    return data;
  } catch (error) {
    console.error('❌ Error requesting video chat:', error);
    throw error;
  }
};

// Accept a video chat request
export const acceptCoffeeChat = async (chatId) => {
  try {
    console.log('✅ Accepting video chat:', chatId);
    
    // Generate a unique video room URL
    const roomUrl = `https://avari.daily.co/${chatId}-${Date.now()}`;

    const { data, error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'accepted',
        room_url: roomUrl,
        video_link: roomUrl, // Add video_link for VideoCallButton compatibility
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Video chat accepted, room created:', roomUrl);
    return data;
  } catch (error) {
    console.error('❌ Error accepting video chat:', error);
    throw error;
  }
};

// Decline a video chat request
export const declineCoffeeChat = async (chatId) => {
  try {
    console.log('❌ Declining video chat:', chatId);
    
    const { error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (error) throw error;

    console.log('✅ Video chat declined');
  } catch (error) {
    console.error('❌ Error declining video chat:', error);
    throw error;
  }
};

// Cancel a video chat
export const cancelCoffeeChat = async (chatId) => {
  try {
    console.log('🚫 Canceling video chat:', chatId);
    
    const { error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (error) throw error;

    console.log('✅ Video chat cancelled');
  } catch (error) {
    console.error('❌ Error canceling video chat:', error);
    throw error;
  }
};

// Get my video chats
export const getMyCoffeeChats = async () => {
  try {
    console.log('📋 Loading my video chats...');
    
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('coffee_chats')
      .select(`
        *,
        requester:profiles!coffee_chats_requester_id_fkey(id, name, career, city, state),
        recipient:profiles!coffee_chats_recipient_id_fkey(id, name, career, city, state)
      `)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    console.log('✅ Loaded', data?.length || 0, 'video chats');
    return data || [];
  } catch (error) {
    console.error('❌ Error loading video chats:', error);
    throw error;
  }
};

// Get pending requests (received by me)
export const getPendingRequests = async () => {
  try {
    console.log('📬 Loading pending requests...');
    
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('coffee_chats')
      .select(`
        *,
        requester:profiles!coffee_chats_requester_id_fkey(id, name, career, city, state)
      `)
      .eq('recipient_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('✅ Loaded', data?.length || 0, 'pending requests');
    return data || [];
  } catch (error) {
    console.error('❌ Error loading pending requests:', error);
    throw error;
  }
};
