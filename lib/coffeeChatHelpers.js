// lib/coffeeChatHelpers.js
// Helper functions for managing 1:1 coffee chats

import { supabase } from './supabase';
import { createVideoMeeting } from './videoMeeting';

/**
 * Request a coffee chat with a connection
 * @param {string} recipientId - ID of the person to chat with
 * @param {Date} scheduledTime - When to schedule the chat
 * @param {string} notes - Optional notes/message
 * @returns {Promise<Object>} - The created coffee chat
 */
export async function requestCoffeeChat({ recipientId, scheduledTime, notes = '' }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if users are connected
    const { data: connection, error: connError } = await supabase
      .rpc('are_users_connected', { 
        user1_id: user.id, 
        user2_id: recipientId 
      });

    if (connError) throw connError;
    if (!connection) {
      throw new Error('You can only schedule coffee chats with people you\'ve connected with at meetups!');
    }

    // Create coffee chat request
    const { data: coffeeChat, error } = await supabase
      .from('coffee_chats')
      .insert({
        requester_id: user.id,
        recipient_id: recipientId,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending',
        notes: notes
      })
      .select(`
        *,
        requester:profiles!requester_id(id, name, career),
        recipient:profiles!recipient_id(id, name, career)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('You already have a pending request with this person!');
      }
      throw error;
    }

    console.log('✅ Coffee chat requested:', coffeeChat);
    return coffeeChat;

  } catch (error) {
    console.error('❌ Error requesting coffee chat:', error);
    throw error;
  }
}

/**
 * Accept a coffee chat request and create video room
 * @param {string} coffeeChatId - ID of the coffee chat to accept
 * @returns {Promise<Object>} - Updated coffee chat with video link
 */
export async function acceptCoffeeChat(coffeeChatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get the coffee chat
    const { data: coffeeChat, error: fetchError } = await supabase
      .from('coffee_chats')
      .select('*')
      .eq('id', coffeeChatId)
      .single();

    if (fetchError) throw fetchError;
    if (coffeeChat.recipient_id !== user.id) {
      throw new Error('Only the recipient can accept this request');
    }

    // Create video meeting room
    const { link, roomId } = await createVideoMeeting({
      meetupId: coffeeChatId // Using coffee chat ID as meetup ID
    });

    // Update coffee chat status and add video link
    const { data: updated, error: updateError } = await supabase
      .from('coffee_chats')
      .update({
        status: 'accepted',
        video_link: link
      })
      .eq('id', coffeeChatId)
      .select(`
        *,
        requester:profiles!requester_id(id, name, career),
        recipient:profiles!recipient_id(id, name, career)
      `)
      .single();

    if (updateError) throw updateError;

    console.log('✅ Coffee chat accepted with video:', updated);
    return updated;

  } catch (error) {
    console.error('❌ Error accepting coffee chat:', error);
    throw error;
  }
}

/**
 * Decline a coffee chat request
 * @param {string} coffeeChatId - ID of the coffee chat to decline
 */
export async function declineCoffeeChat(coffeeChatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('coffee_chats')
      .update({ status: 'declined' })
      .eq('id', coffeeChatId)
      .eq('recipient_id', user.id);

    if (error) throw error;

    console.log('✅ Coffee chat declined');

  } catch (error) {
    console.error('❌ Error declining coffee chat:', error);
    throw error;
  }
}

/**
 * Cancel a coffee chat (by requester or recipient)
 * @param {string} coffeeChatId - ID of the coffee chat to cancel
 */
export async function cancelCoffeeChat(coffeeChatId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('coffee_chats')
      .update({ status: 'cancelled' })
      .eq('id', coffeeChatId)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

    if (error) throw error;

    console.log('✅ Coffee chat cancelled');

  } catch (error) {
    console.error('❌ Error cancelling coffee chat:', error);
    throw error;
  }
}

/**
 * Mark coffee chat as completed
 * @param {string} coffeeChatId - ID of the coffee chat to complete
 */
export async function completeCoffeeChat(coffeeChatId) {
  try {
    const { error } = await supabase
      .from('coffee_chats')
      .update({ status: 'completed' })
      .eq('id', coffeeChatId);

    if (error) throw error;

    console.log('✅ Coffee chat marked as completed');

  } catch (error) {
    console.error('❌ Error completing coffee chat:', error);
    throw error;
  }
}

/**
 * Get all coffee chats for current user
 * @returns {Promise<Array>} - List of coffee chats
 */
export async function getMyCoffeeChats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('coffee_chats')
      .select(`
        *,
        requester:profiles!requester_id(id, name, career, city, state),
        recipient:profiles!recipient_id(id, name, career, city, state)
      `)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('❌ Error loading coffee chats:', error);
    return [];
  }
}

/**
 * Get pending coffee chat requests (received)
 * @returns {Promise<Array>} - List of pending requests
 */
export async function getPendingRequests() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('coffee_chats')
      .select(`
        *,
        requester:profiles!requester_id(id, name, career, city, state)
      `)
      .eq('recipient_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('❌ Error loading pending requests:', error);
    return [];
  }
}

/**
 * Get upcoming accepted coffee chats
 * @returns {Promise<Array>} - List of upcoming chats
 */
export async function getUpcomingChats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('coffee_chats')
      .select(`
        *,
        requester:profiles!requester_id(id, name, career),
        recipient:profiles!recipient_id(id, name, career)
      `)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .gte('scheduled_time', now)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('❌ Error loading upcoming chats:', error);
    return [];
  }
}
