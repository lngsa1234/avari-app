// lib/coffeeChatHelpers.js
// Helper functions for video chat system

// Get current user
const getCurrentUser = async (supabase) => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper to fetch profiles by IDs
const fetchProfiles = async (supabase, userIds) => {
  if (!userIds || userIds.length === 0) return {};

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  console.log('🔍 Fetching profiles for IDs:', uniqueIds);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, email, career, city, state, profile_picture')
    .in('id', uniqueIds);

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return {};
  }

  console.log('✅ Fetched profiles:', profiles);

  // Convert to map for easy lookup
  const profileMap = {};
  (profiles || []).forEach(p => {
    profileMap[p.id] = p;
  });

  return profileMap;
};

// Request a video chat
export const requestCoffeeChat = async (supabase, { recipientId, scheduledTime, notes }) => {
  try {
    console.log('Requesting video chat with:', recipientId);

    const user = await getCurrentUser(supabase);
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

    console.log('Video chat request created:', data);
    return data;
  } catch (error) {
    console.error('Error requesting video chat:', error);
    throw error;
  }
};

// Accept a video chat request
export const acceptCoffeeChat = async (supabase, chatId) => {
  try {
    console.log('Accepting video chat:', chatId);

    // Generate a unique video room URL
    const roomUrl = `https://circlew.daily.co/${chatId}-${Date.now()}`;

    const { data, error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'accepted',
        room_url: roomUrl,
        video_link: roomUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;

    console.log('Video chat accepted, room created:', roomUrl);
    return data;
  } catch (error) {
    console.error('Error accepting video chat:', error);
    throw error;
  }
};

// Decline a video chat request
export const declineCoffeeChat = async (supabase, chatId) => {
  try {
    console.log('Declining video chat:', chatId);

    const { error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (error) throw error;

    console.log('Video chat declined');
  } catch (error) {
    console.error('Error declining video chat:', error);
    throw error;
  }
};

// Cancel a video chat
export const cancelCoffeeChat = async (supabase, chatId) => {
  try {
    console.log('Canceling video chat:', chatId);

    const { error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (error) throw error;

    console.log('Video chat cancelled');
  } catch (error) {
    console.error('Error canceling video chat:', error);
    throw error;
  }
};

// Complete a video chat (mark as completed after call ends)
export const completeCoffeeChat = async (supabase, chatId) => {
  try {
    console.log('Completing video chat:', chatId);

    const { error } = await supabase
      .from('coffee_chats')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (error) throw error;

    console.log('Video chat completed');
  } catch (error) {
    console.error('Error completing video chat:', error);
    throw error;
  }
};

// Get my video chats
export const getMyCoffeeChats = async (supabase) => {
  try {
    console.log('Loading my video chats...');

    const user = await getCurrentUser(supabase);
    if (!user) throw new Error('Not authenticated');

    // First, fetch the coffee chats
    const { data: chats, error } = await supabase
      .from('coffee_chats')
      .select('*')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    if (!chats || chats.length === 0) {
      return [];
    }

    // Collect all user IDs we need to fetch
    const userIds = [];
    chats.forEach(chat => {
      if (chat.requester_id) userIds.push(chat.requester_id);
      if (chat.recipient_id) userIds.push(chat.recipient_id);
    });

    // Fetch all profiles at once
    const profileMap = await fetchProfiles(supabase, userIds);

    // Attach profiles to chats
    const chatsWithProfiles = chats.map(chat => {
      const requester = profileMap[chat.requester_id] || null;
      const recipient = profileMap[chat.recipient_id] || null;

      console.log('📎 Attaching profiles to chat:', {
        chatId: chat.id,
        requester_id: chat.requester_id,
        recipient_id: chat.recipient_id,
        requesterFound: !!requester,
        recipientFound: !!recipient,
        requesterName: requester?.name,
        recipientName: recipient?.name
      });

      return {
        ...chat,
        requester,
        recipient
      };
    });

    console.log('✅ Loaded', chatsWithProfiles.length, 'video chats with profiles');
    return chatsWithProfiles;
  } catch (error) {
    console.error('Error loading video chats:', error);
    throw error;
  }
};

// Get pending requests (received by me)
export const getPendingRequests = async (supabase) => {
  try {
    console.log('Loading pending requests...');

    const user = await getCurrentUser(supabase);
    if (!user) throw new Error('Not authenticated');

    // First, fetch the pending requests
    const { data: requests, error } = await supabase
      .from('coffee_chats')
      .select('*')
      .eq('recipient_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      return [];
    }

    // Auto-decline stale requests whose scheduled_time passed over 24 hours ago
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const stale = requests.filter(r => r.scheduled_time && new Date(r.scheduled_time) < staleThreshold);
    const active = requests.filter(r => !r.scheduled_time || new Date(r.scheduled_time) >= staleThreshold);

    if (stale.length > 0) {
      const staleIds = stale.map(r => r.id);
      await supabase
        .from('coffee_chats')
        .update({ status: 'declined', updated_at: now.toISOString() })
        .in('id', staleIds);
      console.log('Auto-declined', stale.length, 'stale coffee chat requests');
    }

    if (active.length === 0) {
      return [];
    }

    // Fetch requester profiles
    const requesterIds = active.map(r => r.requester_id).filter(Boolean);
    const profileMap = await fetchProfiles(supabase, requesterIds);

    // Attach profiles to requests
    const requestsWithProfiles = active.map(request => ({
      ...request,
      requester: profileMap[request.requester_id] || null
    }));

    console.log('Loaded', requestsWithProfiles.length, 'pending requests');
    return requestsWithProfiles;
  } catch (error) {
    console.error('Error loading pending requests:', error);
    throw error;
  }
};

// Get sent requests (by me)
export const getSentRequests = async (supabase) => {
  try {
    console.log('Loading sent requests...');

    const user = await getCurrentUser(supabase);
    if (!user) throw new Error('Not authenticated');

    // First, fetch the sent requests
    const { data: requests, error } = await supabase
      .from('coffee_chats')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      return [];
    }

    // Fetch recipient profiles
    const recipientIds = requests.map(r => r.recipient_id).filter(Boolean);
    const profileMap = await fetchProfiles(supabase, recipientIds);

    // Attach profiles to requests
    const requestsWithProfiles = requests.map(request => ({
      ...request,
      recipient: profileMap[request.recipient_id] || null
    }));

    console.log('Loaded', requestsWithProfiles.length, 'sent requests');
    return requestsWithProfiles;
  } catch (error) {
    console.error('Error loading sent requests:', error);
    throw error;
  }
};
