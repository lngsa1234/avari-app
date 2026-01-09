// lib/agoraHelpers.js
// Helper functions for Agora group video calls

import { supabase } from './supabase';

/**
 * Create an Agora video room for a group meetup
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<{roomId: string, channelName: string, link: string}>}
 */
export async function createAgoraRoom(meetupId) {
  try {
    console.log('🎥 Creating Agora room for meetup:', meetupId);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate unique channel name (Agora channel)
    // Use meetup ID as the channel name for consistency
    const channelName = `meetup-${meetupId}`;

    // Check if room already exists
    const { data: existingRoom } = await supabase
      .from('agora_rooms')
      .select('*')
      .eq('meetup_id', meetupId)
      .single();

    if (existingRoom) {
      console.log('✅ Agora room already exists:', existingRoom);
      return {
        roomId: existingRoom.id,
        channelName: existingRoom.channel_name,
        link: `${window.location.origin}/group-meeting/${existingRoom.channel_name}`
      };
    }

    // Create new Agora room in database
    const { data: room, error } = await supabase
      .from('agora_rooms')
      .insert({
        channel_name: channelName,
        meetup_id: meetupId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error creating Agora room:', error);

      // Check if table doesn't exist
      if (error.code === '42P01') {
        throw new Error('Database table "agora_rooms" does not exist. Please run the database migration in database-migration-agora.sql');
      }

      throw error;
    }

    // Generate shareable link
    const link = `${window.location.origin}/group-meeting/${channelName}`;

    // Update meetup with video link
    const { error: updateError } = await supabase
      .from('meetups')
      .update({
        agora_link: link,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetupId);

    if (updateError) {
      console.error('⚠️ Error updating meetup with Agora link:', updateError);
    }

    console.log('✅ Agora room created successfully:', { channelName, link });

    return {
      roomId: room.id,
      channelName: room.channel_name,
      link
    };

  } catch (error) {
    console.error('❌ Error creating Agora room:', error);
    throw error;
  }
}

/**
 * Get Agora room info for a meetup
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<Object|null>}
 */
export async function getAgoraRoom(meetupId) {
  try {
    const { data, error } = await supabase
      .from('agora_rooms')
      .select('*')
      .eq('meetup_id', meetupId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error getting Agora room:', error);
    return null;
  }
}

/**
 * Get Agora room by channel name
 * @param {string} channelName - The Agora channel name
 * @returns {Promise<Object|null>}
 */
export async function getAgoraRoomByChannel(channelName) {
  try {
    const { data, error } = await supabase
      .from('agora_rooms')
      .select(`
        *,
        meetups (
          id,
          date,
          time,
          location
        )
      `)
      .eq('channel_name', channelName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;

  } catch (error) {
    console.error('Error getting Agora room by channel:', error);
    return null;
  }
}

/**
 * Mark Agora room as started
 * @param {string} channelName - The channel name
 */
export async function startAgoraRoom(channelName) {
  try {
    const { error } = await supabase
      .from('agora_rooms')
      .update({
        started_at: new Date().toISOString(),
        is_active: true
      })
      .eq('channel_name', channelName);

    if (error) {
      console.error('Error starting Agora room:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Mark Agora room as ended
 * @param {string} channelName - The channel name
 */
export async function endAgoraRoom(channelName) {
  try {
    const { error } = await supabase
      .from('agora_rooms')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false
      })
      .eq('channel_name', channelName);

    if (error) {
      console.error('Error ending Agora room:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Check if an Agora room exists for a meetup
 * @param {string} meetupId - The ID of the meetup
 * @returns {Promise<boolean>}
 */
export async function hasAgoraRoom(meetupId) {
  const room = await getAgoraRoom(meetupId);
  return room !== null;
}

/**
 * Get participants count from a channel (from Agora room)
 * This would need real-time tracking - placeholder for now
 * @param {string} channelName - The channel name
 * @returns {Promise<number>}
 */
export async function getAgoraRoomParticipantCount(channelName) {
  try {
    // In a real implementation, you'd track this in real-time
    // For now, return 0 as placeholder
    return 0;
  } catch (error) {
    console.error('Error getting participant count:', error);
    return 0;
  }
}
