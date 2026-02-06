/**
 * Connection Recommendation Helper Functions
 *
 * Utilities for fetching, creating, and managing connection and group recommendations
 */

/**
 * Get connection recommendations for the current user
 * Deduplicates by recommended_user_id and filters out already-connected users
 */
export async function getMyConnectionRecommendations(supabase, limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch recommendations and existing connections in parallel
  const [recsResult, existingConnections] = await Promise.all([
    supabase
      .from('connection_recommendations')
      .select(`
        *,
        meetup:meetups(id, title, date)
      `)
      .eq('user_id', user.id)
      .neq('status', 'dismissed')
      .order('match_score', { ascending: false }), // Order by match_score to keep best ones

    supabase
      .from('user_interests')
      .select('interested_in_user_id')
      .eq('user_id', user.id)
  ]);

  if (recsResult.error) {
    console.error('Error fetching connection recommendations:', recsResult.error);
    return [];
  }

  // Get set of already-connected user IDs
  const connectedUserIds = new Set(
    (existingConnections.data || []).map(c => c.interested_in_user_id)
  );

  // Deduplicate by recommended_user_id and filter out already-connected
  const seenUserIds = new Set();
  const deduplicatedRecs = (recsResult.data || []).filter(rec => {
    const recUserId = rec.recommended_user_id;

    // Skip if already connected
    if (connectedUserIds.has(recUserId)) {
      return false;
    }

    // Skip duplicates (keep first = highest match score)
    if (seenUserIds.has(recUserId)) {
      return false;
    }

    seenUserIds.add(recUserId);
    return true;
  });

  // Fetch profiles separately for the deduplicated recommendations
  const recUserIds = deduplicatedRecs.map(r => r.recommended_user_id).filter(Boolean);
  let profileMap = {};
  if (recUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, career, bio, profile_picture')
      .in('id', recUserIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  // Merge profiles into recommendations
  const recsWithProfiles = deduplicatedRecs.map(rec => ({
    ...rec,
    recommended_user: profileMap[rec.recommended_user_id] || null
  }));

  return recsWithProfiles.slice(0, limit);
}

/**
 * Get group recommendations for the current user
 * Deduplicates by suggested_group_id or suggested_name
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
    .order('match_score', { ascending: false }); // Order by match_score to keep best ones

  if (error) {
    console.error('Error fetching group recommendations:', error);
    return [];
  }

  // Deduplicate by suggested_group_id or suggested_name
  const seenGroups = new Set();
  const deduplicatedRecs = (data || []).filter(rec => {
    const groupKey = rec.suggested_group_id || rec.suggested_name || rec.id;
    if (seenGroups.has(groupKey)) {
      return false;
    }
    seenGroups.add(groupKey);
    return true;
  });

  return deduplicatedRecs.slice(0, limit);
}

/**
 * Get recommendations for a specific call/channel
 * Deduplicates by recommended_user_id and filters out already-connected users
 */
export async function getRecommendationsForCall(supabase, channelName, userId) {
  const [connResult, groupResult, existingConnections] = await Promise.all([
    supabase
      .from('connection_recommendations')
      .select('*')
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
      .order('match_score', { ascending: false }),

    // Get existing connections to filter them out
    supabase
      .from('user_interests')
      .select('interested_in_user_id')
      .eq('user_id', userId)
  ]);

  // Get set of already-connected user IDs
  const connectedUserIds = new Set(
    (existingConnections.data || []).map(c => c.interested_in_user_id)
  );

  // Deduplicate connection recommendations by recommended_user_id
  // Keep only the highest scoring recommendation for each user
  // Also filter out already-connected users
  const seenUserIds = new Set();
  const deduplicatedConnRecs = (connResult.data || []).filter(rec => {
    const recUserId = rec.recommended_user_id;

    // Skip if already connected
    if (connectedUserIds.has(recUserId)) {
      return false;
    }

    // Skip if we've already seen this user (keep first = highest match score)
    if (seenUserIds.has(recUserId)) {
      return false;
    }

    seenUserIds.add(recUserId);
    return true;
  });

  // Fetch profiles separately for deduplicated connection recs
  const recUserIds = deduplicatedConnRecs.map(r => r.recommended_user_id).filter(Boolean);
  let profileMap = {};
  if (recUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, career, bio, profile_picture')
      .in('id', recUserIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  // Merge profiles into connection recommendations
  const connRecsWithProfiles = deduplicatedConnRecs.map(rec => ({
    ...rec,
    recommended_user: profileMap[rec.recommended_user_id] || null
  }));

  // Deduplicate group recommendations by suggested_group_id or suggested_name
  const seenGroups = new Set();
  const deduplicatedGroupRecs = (groupResult.data || []).filter(rec => {
    const groupKey = rec.suggested_group_id || rec.suggested_name || rec.id;
    if (seenGroups.has(groupKey)) {
      return false;
    }
    seenGroups.add(groupKey);
    return true;
  });

  return {
    connectionRecs: connRecsWithProfiles,
    groupRecs: deduplicatedGroupRecs
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
