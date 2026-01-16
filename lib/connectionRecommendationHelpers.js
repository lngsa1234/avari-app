/**
 * Connection Recommendation Helper Functions
 *
 * Utilities for fetching, creating, and managing connection and group recommendations
 */

/**
 * Get connection recommendations for the current user
 */
export async function getMyConnectionRecommendations(supabase, limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('connection_recommendations')
    .select(`
      *,
      recommended_user:profiles!connection_recommendations_recommended_user_id_fkey(
        id, name, email, career, bio, profile_picture
      ),
      meetup:meetups(id, title, date)
    `)
    .eq('user_id', user.id)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching connection recommendations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get group recommendations for the current user
 */
export async function getMyGroupRecommendations(supabase, limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_recommendations')
    .select(`
      *,
      suggested_group:connection_groups(id, name, creator_id, is_active),
      meetup:meetups(id, title, date)
    `)
    .eq('user_id', user.id)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching group recommendations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get recommendations for a specific call/channel
 */
export async function getRecommendationsForCall(supabase, channelName, userId) {
  const [connResult, groupResult] = await Promise.all([
    supabase
      .from('connection_recommendations')
      .select(`
        *,
        recommended_user:profiles!connection_recommendations_recommended_user_id_fkey(
          id, name, email, career, bio, profile_picture
        )
      `)
      .eq('channel_name', channelName)
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('match_score', { ascending: false }),

    supabase
      .from('group_recommendations')
      .select(`
        *,
        suggested_group:connection_groups(id, name, creator_id, is_active)
      `)
      .eq('channel_name', channelName)
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('match_score', { ascending: false })
  ]);

  return {
    connectionRecs: connResult.data || [],
    groupRecs: groupResult.data || []
  };
}

/**
 * Update connection recommendation status
 */
export async function updateConnectionRecommendationStatus(supabase, recId, status) {
  const updateData = { status };

  if (status === 'viewed') {
    updateData.viewed_at = new Date().toISOString();
  } else if (status === 'connected' || status === 'dismissed') {
    updateData.acted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('connection_recommendations')
    .update(updateData)
    .eq('id', recId);

  return !error;
}

/**
 * Update group recommendation status
 */
export async function updateGroupRecommendationStatus(supabase, recId, status, resultGroupId = null) {
  const updateData = { status };

  if (status === 'viewed') {
    updateData.viewed_at = new Date().toISOString();
  } else if (status === 'acted' || status === 'dismissed') {
    updateData.acted_at = new Date().toISOString();
  }

  if (resultGroupId) {
    updateData.result_group_id = resultGroupId;
  }

  const { error } = await supabase
    .from('group_recommendations')
    .update(updateData)
    .eq('id', recId);

  return !error;
}

/**
 * Mark all recommendations for a channel as viewed
 */
export async function markRecommendationsViewed(supabase, channelName, userId) {
  const timestamp = new Date().toISOString();

  await Promise.all([
    supabase
      .from('connection_recommendations')
      .update({ status: 'viewed', viewed_at: timestamp })
      .eq('channel_name', channelName)
      .eq('user_id', userId)
      .eq('status', 'pending'),

    supabase
      .from('group_recommendations')
      .update({ status: 'viewed', viewed_at: timestamp })
      .eq('channel_name', channelName)
      .eq('user_id', userId)
      .eq('status', 'pending')
  ]);
}

/**
 * Create a connection group from a recommendation
 * Returns the created group and membership records
 */
export async function createGroupFromRecommendation(supabase, recommendation, creatorId) {
  // Create the group
  const { data: group, error: groupError } = await supabase
    .from('connection_groups')
    .insert({
      name: recommendation.suggested_name || 'New Connection Group',
      creator_id: creatorId
    })
    .select()
    .single();

  if (groupError || !group) {
    console.error('Error creating group:', groupError);
    return { success: false, error: groupError };
  }

  // Add creator as accepted member
  const memberRecords = [
    {
      group_id: group.id,
      user_id: creatorId,
      status: 'accepted',
      responded_at: new Date().toISOString()
    }
  ];

  // Invite suggested members
  if (recommendation.suggested_members && recommendation.suggested_members.length > 0) {
    for (const memberId of recommendation.suggested_members) {
      memberRecords.push({
        group_id: group.id,
        user_id: memberId,
        status: 'invited'
      });
    }
  }

  const { error: memberError } = await supabase
    .from('connection_group_members')
    .insert(memberRecords);

  if (memberError) {
    console.error('Error adding members:', memberError);
    // Clean up the group if we couldn't add members
    await supabase.from('connection_groups').delete().eq('id', group.id);
    return { success: false, error: memberError };
  }

  // Update the recommendation status
  await updateGroupRecommendationStatus(supabase, recommendation.id, 'acted', group.id);

  return { success: true, group };
}

/**
 * Request to join an existing connection group
 */
export async function requestToJoinGroup(supabase, groupId, userId) {
  // Check if already a member
  const { data: existing } = await supabase
    .from('connection_group_members')
    .select('id, status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    if (existing.status === 'accepted') {
      return { success: false, error: 'Already a member of this group' };
    }
    // Already invited, just accept
    const { error } = await supabase
      .from('connection_group_members')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', existing.id);

    return { success: !error, error };
  }

  // Insert as invited (group creator will need to approve)
  const { error } = await supabase
    .from('connection_group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      status: 'invited'
    });

  return { success: !error, error };
}

/**
 * Get existing connection groups for matching (used by recommendation API)
 */
export async function getExistingGroupsForMatching(supabase, excludeUserIds = []) {
  const { data, error } = await supabase
    .from('connection_groups')
    .select(`
      id,
      name,
      creator_id,
      is_active,
      connection_group_members(count)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching groups:', error);
    return [];
  }

  // Transform to include member count
  return (data || []).map(g => ({
    id: g.id,
    name: g.name,
    creator_id: g.creator_id,
    member_count: g.connection_group_members?.[0]?.count || 0
  }));
}

/**
 * Fetch profiles for suggested members in a group recommendation
 */
export async function fetchSuggestedMemberProfiles(supabase, memberIds) {
  if (!memberIds || memberIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, career, bio, profile_picture')
    .in('id', memberIds);

  if (error) {
    console.error('Error fetching member profiles:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a user_interest record (for connection recommendations)
 */
export async function createConnectionFromRecommendation(supabase, recommendation) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Create user_interests record
  const { error } = await supabase
    .from('user_interests')
    .upsert({
      user_id: user.id,
      interested_in_user_id: recommendation.recommended_user_id
    }, {
      onConflict: 'user_id,interested_in_user_id'
    });

  if (error) {
    console.error('Error creating connection:', error);
    return { success: false, error };
  }

  // Update recommendation status
  await updateConnectionRecommendationStatus(supabase, recommendation.id, 'connected');

  return { success: true };
}
