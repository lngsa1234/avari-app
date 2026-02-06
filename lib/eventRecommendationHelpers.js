/**
 * Event Recommendation Helper Functions
 *
 * Utilities for fetching, creating, and managing event recommendations
 */

/**
 * Get event recommendations for current user
 */
export async function getMyEventRecommendations(supabase, limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch recommendations without join
  const { data: recsData, error } = await supabase
    .from('event_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'viewed'])
    .order('match_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching event recommendations:', error);
    return [];
  }

  if (!recsData || recsData.length === 0) return [];

  // Fetch meetups separately
  const meetupIds = recsData.map(r => r.meetup_id).filter(Boolean);
  let meetupMap = {};

  if (meetupIds.length > 0) {
    const { data: meetups } = await supabase
      .from('meetups')
      .select('id, title, description, date, location, is_virtual, created_by')
      .in('id', meetupIds);

    const { data: attendeeCounts } = await supabase
      .from('meetup_attendees')
      .select('meetup_id')
      .in('meetup_id', meetupIds);

    const countMap = {};
    (attendeeCounts || []).forEach(a => {
      countMap[a.meetup_id] = (countMap[a.meetup_id] || 0) + 1;
    });

    (meetups || []).forEach(m => {
      meetupMap[m.id] = {
        ...m,
        meetup_attendees: [{ count: countMap[m.id] || 0 }]
      };
    });
  }

  // Merge and filter out past events
  const now = new Date();
  return recsData
    .map(rec => ({ ...rec, meetup: meetupMap[rec.meetup_id] || null }))
    .filter(r => r.meetup && new Date(r.meetup.date) > now);
}

/**
 * Get event recommendations for a specific user (admin/service use)
 */
export async function getEventRecommendationsForUser(supabase, userId, limit = 10) {
  // Fetch recommendations without join
  const { data: recsData, error } = await supabase
    .from('event_recommendations')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'viewed'])
    .order('match_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching event recommendations:', error);
    return [];
  }

  if (!recsData || recsData.length === 0) return [];

  // Fetch meetups separately
  const meetupIds = recsData.map(r => r.meetup_id).filter(Boolean);
  let meetupMap = {};

  if (meetupIds.length > 0) {
    const { data: meetups } = await supabase
      .from('meetups')
      .select('id, title, description, date, location, is_virtual, created_by')
      .in('id', meetupIds);

    const { data: attendeeCounts } = await supabase
      .from('meetup_attendees')
      .select('meetup_id')
      .in('meetup_id', meetupIds);

    const countMap = {};
    (attendeeCounts || []).forEach(a => {
      countMap[a.meetup_id] = (countMap[a.meetup_id] || 0) + 1;
    });

    (meetups || []).forEach(m => {
      meetupMap[m.id] = {
        ...m,
        meetup_attendees: [{ count: countMap[m.id] || 0 }]
      };
    });
  }

  // Merge and filter out past events
  const now = new Date();
  return recsData
    .map(rec => ({ ...rec, meetup: meetupMap[rec.meetup_id] || null }))
    .filter(r => r.meetup && new Date(r.meetup.date) > now);
}

/**
 * Update event recommendation status
 */
export async function updateEventRecommendationStatus(supabase, recId, status) {
  const updateData = { status };

  if (status === 'viewed') {
    updateData.viewed_at = new Date().toISOString();
  } else if (status === 'rsvp' || status === 'dismissed') {
    updateData.acted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('event_recommendations')
    .update(updateData)
    .eq('id', recId);

  return !error;
}

/**
 * Mark recommendation as RSVP'd and create attendee record
 */
export async function rsvpFromRecommendation(supabase, recommendation) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Add to meetup attendees
  const { error: attendeeError } = await supabase
    .from('meetup_attendees')
    .upsert({
      meetup_id: recommendation.meetup_id,
      user_id: user.id,
      status: 'confirmed'
    }, {
      onConflict: 'meetup_id,user_id'
    });

  if (attendeeError) {
    console.error('Error adding attendee:', attendeeError);
    return { success: false, error: attendeeError };
  }

  // Update recommendation status
  await updateEventRecommendationStatus(supabase, recommendation.id, 'rsvp');

  return { success: true };
}

/**
 * Dismiss a recommendation
 */
export async function dismissEventRecommendation(supabase, recId) {
  return await updateEventRecommendationStatus(supabase, recId, 'dismissed');
}

/**
 * Mark recommendation as viewed
 */
export async function markEventRecommendationViewed(supabase, recId) {
  return await updateEventRecommendationStatus(supabase, recId, 'viewed');
}

/**
 * Get recommendation stats for a user
 */
export async function getEventRecommendationStats(supabase, userId) {
  const { data, error } = await supabase
    .from('event_recommendations')
    .select('status')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching recommendation stats:', error);
    return { total: 0, pending: 0, viewed: 0, rsvp: 0, dismissed: 0 };
  }

  const stats = { total: data.length, pending: 0, viewed: 0, rsvp: 0, dismissed: 0 };
  for (const rec of data) {
    if (stats[rec.status] !== undefined) {
      stats[rec.status]++;
    }
  }

  return stats;
}

/**
 * Delete old dismissed recommendations (cleanup)
 */
export async function cleanupOldRecommendations(supabase, daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('event_recommendations')
    .delete()
    .eq('status', 'dismissed')
    .lt('created_at', cutoffDate);

  if (error) {
    console.error('Error cleaning up recommendations:', error);
    return false;
  }

  return true;
}
