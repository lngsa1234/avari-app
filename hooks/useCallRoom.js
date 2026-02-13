'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCallTypeConfig } from '@/lib/video/callTypeConfig';

/**
 * Unified hook for fetching room data based on call type
 *
 * @param {string} callType - URL call type (coffee, meetup, circle)
 * @param {string} roomId - The room/channel ID
 * @returns {Object} Room data, related info, loading state, and error
 */
export function useCallRoom(callType, roomId) {
  const [room, setRoom] = useState(null);
  const [relatedData, setRelatedData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const config = getCallTypeConfig(callType);

  // Fetch room data based on call type
  const fetchRoom = useCallback(async () => {
    if (!config || !roomId) {
      setError('Invalid call type or room ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let roomData = null;
      let related = null;
      let participantsList = [];

      switch (callType) {
        case 'coffee': {
          // 1:1 Coffee Chat - uses video_rooms table
          const { data, error: roomError } = await supabase
            .from('video_rooms')
            .select(`
              *,
              coffee_chats (
                id,
                requester_id,
                recipient_id
              )
            `)
            .eq('room_id', roomId)
            .single();

          if (roomError && roomError.code !== 'PGRST116') throw roomError;
          roomData = data;

          if (data?.coffee_chats) {
            related = data.coffee_chats;
            // Fetch participant profiles
            const userIds = [data.coffee_chats.requester_id, data.coffee_chats.recipient_id].filter(Boolean);
            if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name, email, profile_picture, career')
                .in('id', userIds);
              participantsList = profiles || [];
            }
          }
          break;
        }

        case 'meetup': {
          // Group Meetup - uses agora_rooms table (but LiveKit provider)
          const { data, error: roomError } = await supabase
            .from('agora_rooms')
            .select('*')
            .eq('channel_name', roomId)
            .single();

          if (roomError && roomError.code !== 'PGRST116') throw roomError;
          roomData = data;

          // Fetch meetup details separately (more reliable than join)
          const meetupId = data?.meetup_id;
          if (meetupId) {
            const { data: meetupData } = await supabase
              .from('meetups')
              .select('id, topic, date, time, location, host_id')
              .eq('id', meetupId)
              .single();

            if (meetupData) {
              related = meetupData;

              // Fetch signups for participants
              const { data: signups } = await supabase
                .from('meetup_signups')
                .select('user_id')
                .eq('meetup_id', meetupData.id);

              if (signups && signups.length > 0) {
                const userIds = signups.map(s => s.user_id).filter(Boolean);
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, name, email, profile_picture, career')
                  .in('id', userIds);
                participantsList = profiles || [];
              }
            }
          }
          break;
        }

        case 'circle': {
          // Circle/Connection Group
          // Channel name format: "connection-group-{groupId}"
          console.log('[useCallRoom] Fetching circle room:', roomId);

          // Extract group ID from channel name
          const groupIdMatch = roomId.match(/connection-group-(.+)/);
          const groupId = groupIdMatch ? groupIdMatch[1] : null;
          console.log('[useCallRoom] Extracted group ID:', groupId);

          if (groupId) {
            // Fetch group info directly using the extracted group ID
            const { data: groupData, error: groupError } = await supabase
              .from('connection_groups')
              .select('id, name, creator_id')
              .eq('id', groupId)
              .single();

            console.log('[useCallRoom] Group data:', groupData, 'Error:', groupError);

            if (groupData) {
              // Fetch the latest meetup for this circle to get the topic
              const { data: meetupData } = await supabase
                .from('meetups')
                .select('id, topic, date, time')
                .eq('circle_id', groupId)
                .order('date', { ascending: false })
                .limit(1)
                .single();

              related = {
                ...groupData,
                meetupTopic: meetupData?.topic || null,
                meetupDate: meetupData?.date || null,
                meetupTime: meetupData?.time || null,
              };
              roomData = { channel_name: roomId, group_id: groupId };

              // Fetch group members
              const { data: members, error: membersError } = await supabase
                .from('connection_group_members')
                .select('user_id')
                .eq('group_id', groupId)
                .eq('status', 'accepted');

              console.log('[useCallRoom] Members:', members, 'Error:', membersError);

              if (members && members.length > 0) {
                const userIds = members.map(m => m.user_id).filter(Boolean);
                console.log('[useCallRoom] Fetching profiles for:', userIds);
                const { data: profiles, error: profilesError } = await supabase
                  .from('profiles')
                  .select('id, name, email, profile_picture, career')
                  .in('id', userIds);
                console.log('[useCallRoom] Profiles:', profiles, 'Error:', profilesError);
                participantsList = profiles || [];
              }
            }
          }
          break;
        }

        default:
          throw new Error(`Unknown call type: ${callType}`);
      }

      setRoom(roomData);
      setRelatedData(related);
      setParticipants(participantsList);
    } catch (err) {
      console.error('[useCallRoom] Error fetching room:', err);
      setError(err.message || 'Failed to fetch room data');
    } finally {
      setIsLoading(false);
    }
  }, [callType, roomId, config]);

  // Start room (mark as started)
  const startRoom = useCallback(async () => {
    if (!config || !roomId) return;

    try {
      const { error } = await supabase
        .from(config.roomTable)
        .update({
          started_at: new Date().toISOString(),
          is_active: true
        })
        .eq(callType === 'coffee' ? 'room_id' : 'channel_name', roomId);

      if (error) console.error('[useCallRoom] Error starting room:', error);
    } catch (err) {
      console.error('[useCallRoom] Error starting room:', err);
    }
  }, [callType, roomId, config]);

  // End room (mark as ended)
  const endRoom = useCallback(async () => {
    if (!config || !roomId) return;

    try {
      const { error } = await supabase
        .from(config.roomTable)
        .update({
          ended_at: new Date().toISOString(),
          is_active: false
        })
        .eq(callType === 'coffee' ? 'room_id' : 'channel_name', roomId);

      if (error) console.error('[useCallRoom] Error ending room:', error);
    } catch (err) {
      console.error('[useCallRoom] Error ending room:', err);
    }
  }, [callType, roomId, config]);

  // Get recap data for post-call summary
  const getRecapData = useCallback(async () => {
    if (!config || !roomId) return null;

    try {
      // Get chat messages for this call
      const { data: messages } = await supabase
        .from('call_messages')
        .select('*')
        .eq('channel_name', roomId)
        .order('created_at', { ascending: true });

      // Get transcripts if available
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('channel_name', roomId)
        .order('timestamp', { ascending: true });

      return {
        room,
        relatedData,
        participants,
        messages: messages || [],
        transcript: transcripts?.map(t => ({
          speakerId: t.user_id,
          speakerName: t.speaker_name,
          text: t.text,
          timestamp: t.timestamp,
          isFinal: t.is_final
        })) || [],
        startedAt: room?.started_at,
        endedAt: room?.ended_at
      };
    } catch (err) {
      console.error('[useCallRoom] Error getting recap data:', err);
      return null;
    }
  }, [roomId, room, relatedData, participants, config]);

  // Fetch room on mount and when dependencies change
  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  return {
    // Data
    room,
    relatedData,
    participants,
    config,

    // State
    isLoading,
    error,

    // Actions
    startRoom,
    endRoom,
    getRecapData,
    refetch: fetchRoom,
  };
}

export default useCallRoom;
