// lib/videoMeeting.js
// Updated to work with CircleW's meetups table

import { supabase } from './supabase';

/**
 * Create a video meeting room for a meetup
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<{roomId: string, link: string}>}
 */
export async function createVideoMeeting({ meetupId }) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Generate unique room ID
    const roomId = generateRoomId();
    
    // Create video room in database
    const { data: room, error } = await supabase
      .from('video_rooms')
      .insert({
        room_id: roomId,
        meetup_id: meetupId,
        participants: [],
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Generate shareable link
    const link = `${window.location.origin}/meeting/${roomId}`;
    
    // Update meetup with video link
    const { error: updateError } = await supabase
      .from('meetups')
      .update({ video_link: link })
      .eq('id', meetupId);
    
    if (updateError) throw updateError;
    
    console.log('✅ Video meeting created:', { roomId, link });
    
    return {
      roomId,
      link,
      room
    };
    
  } catch (error) {
    console.error('❌ Error creating video meeting:', error);
    throw error;
  }
}

/**
 * Get video meeting info
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<Object|null>}
 */
export async function getVideoMeeting(meetupId) {
  try {
    const { data, error } = await supabase
      .from('video_rooms')
      .select('*')
      .eq('meetup_id', meetupId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return data;
    
  } catch (error) {
    console.error('Error getting video meeting:', error);
    return null;
  }
}

/**
 * Mark video meeting as started
 * @param {string} roomId - The room ID
 */
export async function startVideoMeeting(roomId) {
  const { error } = await supabase
    .from('video_rooms')
    .update({ started_at: new Date().toISOString() })
    .eq('room_id', roomId);
  
  if (error) console.error('Error starting video:', error);
}

/**
 * Mark video meeting as ended
 * @param {string} roomId - The room ID
 */
export async function endVideoMeeting(roomId) {
  const { error } = await supabase
    .from('video_rooms')
    .update({ ended_at: new Date().toISOString() })
    .eq('room_id', roomId);
  
  if (error) console.error('Error ending video:', error);
}

/**
 * Generate a friendly room ID
 * @returns {string}
 */
function generateRoomId() {
  const adjectives = ['cozy', 'warm', 'bright', 'sunny', 'friendly', 'cheerful', 'lively', 'happy'];
  const nouns = ['coffee', 'chat', 'brew', 'meet', 'connect', 'talk', 'huddle', 'gather'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const random = Math.random().toString(36).substring(2, 8);
  
  return `${adj}-${noun}-${random}`;
}

/**
 * Check if a video meeting exists for a meetup
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<boolean>}
 */
export async function hasVideoMeeting(meetupId) {
  const meeting = await getVideoMeeting(meetupId);
  return meeting !== null;
}

/**
 * Get all participants for a meetup (from signups)
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<Array>}
 */
export async function getMeetupParticipants(meetupId) {
  try {
    const { data, error } = await supabase
      .from('meetup_signups')
      .select(`
        user_id,
        profiles (
          id,
          name,
          email,
          career
        )
      `)
      .eq('meetup_id', meetupId);
    
    if (error) throw error;
    
    return data || [];
    
  } catch (error) {
    console.error('Error getting participants:', error);
    return [];
  }
}
