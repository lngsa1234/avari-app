// lib/connectionGroupHelpers.js
// Helper functions for connection group video calls
// Allows users with 2+ mutual connections to create small group chats (3-4 people)

import { supabase } from './supabase';
import { parseLocalDate } from './dateUtils';

/**
 * Check if user meets eligibility requirements
 * @returns {Promise<boolean>}
 */
export async function checkGroupEligibility() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // All authenticated users are eligible to create groups
    return true;
  } catch (error) {
    console.error('Error checking group eligibility:', error);
    return false;
  }
}

/**
 * Get eligible connections for group creation
 * @returns {Promise<Array>}
 */
export async function getEligibleConnections() {
  try {
    console.log('🔍 Loading eligible connections for group creation...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get all mutual matches
    const { data: matches, error } = await supabase
      .rpc('get_mutual_matches', { for_user_id: user.id });

    if (error) throw error;

    // Need at least 2 connections to create a group (creator + 2 others = 3 people minimum)
    if (!matches || matches.length < 2) {
      console.log('⚠️ User has fewer than 2 connections');
      return [];
    }

    console.log(`✅ Found ${matches.length} mutual connections`);

    // Get profile details
    const userIds = matches.map(m => m.matched_user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, career, city, state, bio')
      .in('id', userIds);

    if (profileError) throw profileError;

    return profiles || [];
  } catch (error) {
    console.error('❌ Error loading eligible connections:', error);
    return [];
  }
}

/**
 * Create a connection group
 * @param {Object} params
 * @param {string} params.name - Group name
 * @param {Array<string>} params.invitedUserIds - Array of user IDs to invite (2-9 people)
 * @returns {Promise<Object>}
 */
export async function createConnectionGroup({ name, invitedUserIds }) {
  try {
    console.log('🎨 Creating connection group:', name);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate: 3-10 people total (creator + 2-9 invitees)
    if (invitedUserIds.length < 2 || invitedUserIds.length > 9) {
      throw new Error('Groups must have 3-10 people total (including you)');
    }

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('connection_groups')
      .insert({
        name: name.trim(),
        creator_id: user.id
      })
      .select()
      .single();

    if (groupError) {
      console.error('❌ Error creating group:', groupError);
      throw groupError;
    }

    console.log('✅ Group created:', group.id);

    // Add invited members with 'invited' status
    const memberInserts = invitedUserIds.map(userId => ({
      group_id: group.id,
      user_id: userId,
      status: 'invited'
    }));

    const { error: memberError } = await supabase
      .from('connection_group_members')
      .insert(memberInserts);

    if (memberError) {
      console.error('❌ Error inviting members:', memberError);
      throw memberError;
    }

    // Creator is automatically a member with 'accepted' status
    const { error: creatorError } = await supabase
      .from('connection_group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        status: 'accepted'
      });

    if (creatorError) {
      console.error('❌ Error adding creator as member:', creatorError);
      throw creatorError;
    }

    console.log('✅ Members invited successfully');

    return group;
  } catch (error) {
    console.error('❌ Error creating connection group:', error);
    throw error;
  }
}

/**
 * Get user's connection groups (created or member of)
 * OPTIMIZED: Batches queries to reduce database roundtrips
 * @returns {Promise<Array>}
 */
export async function getMyConnectionGroups() {
  try {
    console.log('📋 Loading connection groups (optimized)...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get groups where user is accepted member (with group details in one query)
    const { data: memberGroups, error: memberError } = await supabase
      .from('connection_group_members')
      .select(`
        group_id,
        status,
        connection_groups!inner (
          id,
          name,
          creator_id,
          created_at,
          updated_at,
          is_active
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    if (memberError) throw memberError;

    if (!memberGroups || memberGroups.length === 0) {
      console.log('⚠️ No groups found');
      return [];
    }

    // Extract groups from the join result
    const groups = memberGroups.map(mg => ({
      ...mg.connection_groups,
      members: [],
      creator: null,
      lastMessage: null,
      nextMeetup: null
    }));

    const groupIds = groups.map(g => g.id);
    const creatorIds = [...new Set(groups.map(g => g.creator_id))];

    // Batch fetch all data in parallel
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [
      membersResult,
      creatorsResult,
      messagesResult,
      meetupsResult,
      pastMeetupsResult
    ] = await Promise.all([
      // 1. Get ALL members for ALL groups in one query
      supabase
        .from('connection_group_members')
        .select('id, status, user_id, group_id')
        .in('group_id', groupIds),

      // 2. Get ALL creator profiles in one query
      supabase
        .from('profiles')
        .select('id, name')
        .in('id', creatorIds),

      // 3. Get recent messages for all groups (we'll pick the latest per group)
      supabase
        .from('connection_group_messages')
        .select('id, user_id, message, created_at, group_id')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),

      // 4. Get upcoming meetups for all circles (exclude cancelled/completed)
      supabase
        .from('meetups')
        .select('id, topic, date, time, location, circle_id, status, updated_at')
        .in('circle_id', groupIds)
        .gte('date', today)
        .not('status', 'in', '("cancelled","completed")')
        .order('date', { ascending: true }),

      // 5. Get past meetups for all circles (for session count + last topic)
      supabase
        .from('meetups')
        .select('id, topic, date, circle_id, status')
        .in('circle_id', groupIds)
        .lt('date', today)
        .order('date', { ascending: false })
    ]);

    // Get all unique member user IDs to fetch their profiles in one query
    const allMembers = membersResult.data || [];
    const memberUserIds = [...new Set(allMembers.map(m => m.user_id))];

    // Also get message sender IDs
    const allMessages = messagesResult.data || [];
    const senderIds = [...new Set(allMessages.map(m => m.user_id))];

    // Combine all user IDs we need profiles for
    const allUserIds = [...new Set([...memberUserIds, ...senderIds])];

    // 5. Get ALL member profiles in one query
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, name, career, last_active, profile_picture')
      .in('id', allUserIds);

    // Create lookup maps for fast access
    const profileMap = {};
    (allProfiles || []).forEach(p => { profileMap[p.id] = p; });

    const creatorMap = {};
    (creatorsResult.data || []).forEach(c => { creatorMap[c.id] = c; });

    // Group members by group_id
    const membersByGroup = {};
    allMembers.forEach(m => {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push({
        ...m,
        user: profileMap[m.user_id] || null
      });
    });

    // Get latest message per group
    const latestMessageByGroup = {};
    allMessages.forEach(msg => {
      if (!latestMessageByGroup[msg.group_id]) {
        latestMessageByGroup[msg.group_id] = {
          ...msg,
          sender: profileMap[msg.user_id] || null
        };
      }
    });

    // Get next meetup per circle
    // If multiple meetups are within 3 days of each other, prefer the most recently updated one
    // (handles rescheduled meetups where auto-generation created a phantom for the old date)
    const nextMeetupByCircle = {};
    (meetupsResult.data || []).forEach(meetup => {
      const existing = nextMeetupByCircle[meetup.circle_id];
      if (!existing) {
        nextMeetupByCircle[meetup.circle_id] = meetup;
      } else {
        // Check if this meetup is within 3 days of the current pick
        const existingDate = parseLocalDate(existing.date).getTime();
        const thisDate = parseLocalDate(meetup.date).getTime();
        const daysDiff = Math.abs(thisDate - existingDate) / (24 * 60 * 60 * 1000);
        if (daysDiff <= 3) {
          // Prefer the one that was more recently updated (manually rescheduled)
          if (new Date(meetup.updated_at) > new Date(existing.updated_at)) {
            nextMeetupByCircle[meetup.circle_id] = meetup;
          }
        }
        // If more than 3 days apart, keep the earlier one (already set)
      }
    });

    // Get past meetup count and last topic per circle
    const pastMeetupCountByCircle = {};
    const lastTopicByCircle = {};
    (pastMeetupsResult.data || []).forEach(meetup => {
      pastMeetupCountByCircle[meetup.circle_id] = (pastMeetupCountByCircle[meetup.circle_id] || 0) + 1;
      if (!lastTopicByCircle[meetup.circle_id] && meetup.topic) {
        lastTopicByCircle[meetup.circle_id] = meetup.topic;
      }
    });

    // Assemble final groups data
    for (const group of groups) {
      group.creator = creatorMap[group.creator_id] || null;
      group.members = membersByGroup[group.id] || [];
      group.lastMessage = latestMessageByGroup[group.id] || null;
      group.nextMeetup = nextMeetupByCircle[group.id] || null;
      group.pastSessionCount = pastMeetupCountByCircle[group.id] || 0;
      group.lastTopic = lastTopicByCircle[group.id] || null;
    }

    // Sort by created_at descending
    groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`✅ Loaded ${groups.length} connection groups (optimized)`);

    return groups;
  } catch (error) {
    console.error('❌ Error loading connection groups:', error);
    return [];
  }
}

/**
 * Get pending group invitations for current user
 * @returns {Promise<Array>}
 */
export async function getPendingGroupInvites() {
  try {
    console.log('📨 Loading pending group invitations...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: invites, error } = await supabase
      .from('connection_group_members')
      .select('id, group_id, user_id, status, invited_at, responded_at')
      .eq('user_id', user.id)
      .eq('status', 'invited')
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invites:', error);
      throw error;
    }

    if (!invites || invites.length === 0) {
      return [];
    }

    // Batch fetch all groups in one query
    const groupIds = [...new Set(invites.map(i => i.group_id))];
    const { data: groups } = await supabase
      .from('connection_groups')
      .select('id, name, creator_id, created_at, is_active')
      .in('id', groupIds);

    const groupMap = {};
    (groups || []).forEach(g => { groupMap[g.id] = g; });

    // Batch fetch all creator profiles in one query
    const creatorIds = [...new Set((groups || []).map(g => g.creator_id))];
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', creatorIds);

    const creatorMap = {};
    (creators || []).forEach(c => { creatorMap[c.id] = c; });

    // Assemble: attach group + creator to each invite
    for (const invite of invites) {
      const group = groupMap[invite.group_id];
      if (group) {
        group.creator = creatorMap[group.creator_id] || null;
        invite.group = group;
      }
    }

    console.log(`✅ Found ${invites.length} pending invitations`);

    return invites || [];
  } catch (error) {
    console.error('❌ Error loading group invites:', error);
    return [];
  }
}

/**
 * Accept group invitation
 * @param {string} membershipId - The membership ID
 * @returns {Promise<void>}
 */
export async function acceptGroupInvite(membershipId) {
  try {
    console.log('✅ Accepting group invitation:', membershipId);

    const { error } = await supabase
      .from('connection_group_members')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', membershipId);

    if (error) throw error;

    console.log('✅ Group invitation accepted');
  } catch (error) {
    console.error('❌ Error accepting group invite:', error);
    throw error;
  }
}

/**
 * Decline group invitation
 * @param {string} membershipId - The membership ID
 * @returns {Promise<void>}
 */
export async function declineGroupInvite(membershipId) {
  try {
    console.log('❌ Declining group invitation:', membershipId);

    const { error } = await supabase
      .from('connection_group_members')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', membershipId);

    if (error) throw error;

    console.log('✅ Group invitation declined');
  } catch (error) {
    console.error('❌ Error declining group invite:', error);
    throw error;
  }
}

/**
 * Create Agora room for connection group video call
 * @param {string} groupId - The connection group ID
 * @returns {Promise<{roomId: string, channelName: string, link: string}>}
 */
export async function createConnectionGroupRoom(groupId) {
  try {
    console.log('🎥 Creating connection group room for group:', groupId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const channelName = `connection-group-${groupId}`;

    // Check if room exists
    const { data: existing } = await supabase
      .from('connection_group_rooms')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (existing) {
      console.log('✅ Room already exists:', existing.channel_name);
      return {
        roomId: existing.id,
        channelName: existing.channel_name,
        link: `${window.location.origin}/call/circle/${existing.channel_name}`
      };
    }

    // Create new room
    const { data: room, error } = await supabase
      .from('connection_group_rooms')
      .insert({
        channel_name: channelName,
        group_id: groupId,
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error creating room:', error);

      if (error.code === '42P01') {
        throw new Error('Database table "connection_group_rooms" does not exist. Please run the database migration.');
      }

      throw error;
    }

    const link = `${window.location.origin}/call/circle/${channelName}`;

    console.log('✅ Connection group room created:', { channelName, link });

    return {
      roomId: room.id,
      channelName: room.channel_name,
      link
    };
  } catch (error) {
    console.error('❌ Error creating connection group room:', error);
    throw error;
  }
}

/**
 * Get room by channel name
 * @param {string} channelName - The Agora channel name
 * @returns {Promise<Object|null>}
 */
export async function getConnectionGroupRoomByChannel(channelName) {
  try {
    const { data, error } = await supabase
      .from('connection_group_rooms')
      .select(`
        *,
        group:connection_groups(
          id,
          name,
          creator_id
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
    console.error('Error getting connection group room:', error);
    return null;
  }
}

/**
 * Start connection group room (mark as started)
 * @param {string} channelName - The channel name
 * @returns {Promise<void>}
 */
export async function startConnectionGroupRoom(channelName) {
  try {
    const { error } = await supabase
      .from('connection_group_rooms')
      .update({
        started_at: new Date().toISOString(),
        is_active: true
      })
      .eq('channel_name', channelName);

    if (error) {
      console.error('Error starting connection group room:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * End connection group room (mark as ended)
 * @param {string} channelName - The channel name
 * @returns {Promise<void>}
 */
export async function endConnectionGroupRoom(channelName) {
  try {
    const { error } = await supabase
      .from('connection_group_rooms')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false
      })
      .eq('channel_name', channelName);

    if (error) {
      console.error('Error ending connection group room:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Check if room exists for a group
 * @param {string} groupId - The connection group ID
 * @returns {Promise<boolean>}
 */
export async function hasConnectionGroupRoom(groupId) {
  try {
    const { data } = await supabase
      .from('connection_group_rooms')
      .select('id')
      .eq('group_id', groupId)
      .single();

    return data !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a connection group (creator only)
 * @param {string} groupId - The connection group ID
 * @returns {Promise<void>}
 */
export async function deleteConnectionGroup(groupId) {
  try {
    console.log('🗑️ Deleting connection group:', groupId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify user is the creator
    const { data: group, error: fetchError } = await supabase
      .from('connection_groups')
      .select('creator_id')
      .eq('id', groupId)
      .single();

    if (fetchError) throw fetchError;

    if (group.creator_id !== user.id) {
      throw new Error('Only the group creator can delete the group');
    }

    // Delete the group (CASCADE will delete members and rooms)
    const { error: deleteError } = await supabase
      .from('connection_groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) throw deleteError;

    console.log('✅ Connection group deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting connection group:', error);
    throw error;
  }
}

// ============================================================================
// GROUP MESSAGING FUNCTIONS
// ============================================================================

/**
 * Send a message to a connection group
 * @param {Object} supabase - Supabase client
 * @param {string} groupId - The connection group ID
 * @param {string} message - The message text
 * @returns {Promise<Object>}
 */
export async function sendGroupMessage(supabase, groupId, message) {
  try {
    console.log('💬 Sending message to group:', groupId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('connection_group_messages')
      .insert({
        group_id: groupId,
        user_id: user.id,
        message: message.trim()
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Message sent');
    return data;
  } catch (error) {
    console.error('❌ Error sending group message:', error);
    throw error;
  }
}

/**
 * Get messages for a connection group
 * @param {Object} supabase - Supabase client
 * @param {string} groupId - The connection group ID
 * @param {number} limit - Max number of messages to retrieve (default 100)
 * @returns {Promise<Array>}
 */
export async function getGroupMessages(supabase, groupId, limit = 100) {
  try {
    console.log('📨 Loading messages for group:', groupId);

    const { data: messages, error } = await supabase
      .from('connection_group_messages')
      .select('id, user_id, message, created_at, is_deleted')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Fetch user profiles for each message
    const userIds = [...new Set(messages.map(m => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    // Map profiles to messages
    const profileMap = {};
    profiles?.forEach(p => {
      profileMap[p.id] = p;
    });

    messages.forEach(msg => {
      msg.user = profileMap[msg.user_id] || { name: 'Unknown' };
    });

    console.log(`✅ Loaded ${messages.length} messages`);
    return messages || [];
  } catch (error) {
    console.error('❌ Error loading group messages:', error);
    return [];
  }
}

/**
 * Delete a group message (soft delete)
 * @param {Object} supabase - Supabase client
 * @param {string} messageId - The message ID
 * @returns {Promise<void>}
 */
export async function deleteGroupMessage(supabase, messageId) {
  try {
    console.log('🗑️ Deleting message:', messageId);

    const { error } = await supabase
      .from('connection_group_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);

    if (error) throw error;

    console.log('✅ Message deleted');
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    throw error;
  }
}

/**
 * Get call recap data for connection group calls
 * @param {string} channelName - The channel name
 * @param {string} groupId - The connection group ID
 * @returns {Promise<Object>} Recap data
 */
export async function getConnectionGroupRecapData(channelName, groupId = null) {
  try {
    // Get room info for timestamps
    const { data: room } = await supabase
      .from('connection_group_rooms')
      .select('*')
      .eq('channel_name', channelName)
      .single();

    // Get participants from group members if groupId provided
    let participants = [];
    if (groupId) {
      const { data: members } = await supabase
        .from('connection_group_members')
        .select(`
          user_id,
          profiles:user_id (
            id,
            name,
            email,
            profile_picture,
            career
          )
        `)
        .eq('group_id', groupId)
        .eq('status', 'accepted');

      if (members) {
        participants = members
          .filter(m => m.profiles)
          .map(m => ({
            id: m.profiles.id,
            name: m.profiles.name,
            email: m.profiles.email,
            profile_picture: m.profiles.profile_picture,
            career: m.profiles.career
          }));
      }
    }

    // Get chat messages for this call
    const { data: messages } = await supabase
      .from('call_messages')
      .select('*')
      .eq('channel_name', channelName)
      .order('created_at', { ascending: true });

    // If no group participants, extract from messages
    if (participants.length === 0 && messages && messages.length > 0) {
      const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, profile_picture, career')
        .in('id', uniqueUserIds);

      if (profiles) {
        participants = profiles;
      }
    }

    return {
      room,
      participants,
      messages: messages || [],
      startedAt: room?.started_at,
      endedAt: room?.ended_at
    };
  } catch (error) {
    console.error('Error getting connection group recap data:', error);
    return {
      room: null,
      participants: [],
      messages: [],
      startedAt: null,
      endedAt: null
    };
  }
}
