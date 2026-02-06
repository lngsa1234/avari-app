import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAgentExecution, canSendNudge } from '@/lib/agentHelpers';

/**
 * Generate nudges for a user (or batch for cron)
 *
 * POST /api/agent/nudges
 * Body: { userId } OR { batch: true }
 */
export async function POST(request) {
  try {
    const { userId, batch } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (batch) {
      return await generateBatchNudges(supabase);
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    return await generateUserNudges(supabase, userId);
  } catch (error) {
    console.error('[Nudges] Error:', error);
    return NextResponse.json({ error: 'Failed to generate nudges' }, { status: 500 });
  }
}

/**
 * Get pending nudges for current user
 *
 * GET /api/agent/nudges
 */
export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get user from auth header or query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_nudges')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[Nudges] GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch nudges' }, { status: 500 });
    }

    return NextResponse.json({ nudges: data || [] });
  } catch (error) {
    console.error('[Nudges] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch nudges' }, { status: 500 });
  }
}

/**
 * Update nudge status
 *
 * PATCH /api/agent/nudges
 * Body: { nudgeId, status }
 */
export async function PATCH(request) {
  try {
    const { nudgeId, status } = await request.json();

    if (!nudgeId || !status) {
      return NextResponse.json({ error: 'nudgeId and status are required' }, { status: 400 });
    }

    const validStatuses = ['delivered', 'clicked', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const updateData = { status };
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'clicked') {
      updateData.clicked_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('user_nudges')
      .update(updateData)
      .eq('id', nudgeId);

    if (error) {
      console.error('[Nudges] PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update nudge' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Nudges] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update nudge' }, { status: 500 });
  }
}

/**
 * Generate nudges for a specific user
 */
async function generateUserNudges(supabase, userId) {
  // Check rate limiting
  const canNudge = await canSendNudge(supabase, userId, 3);
  if (!canNudge) {
    return NextResponse.json({ nudges: [], reason: 'Rate limited - too recent' });
  }

  // Gather user context in parallel
  const [
    profileResult,
    recentMeetupsResult,
    pendingConnectionsResult,
    circleRecsResult,
    upcomingMeetupsResult
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),

    supabase.from('meetup_attendees')
      .select('meetup_id, created_at, meetups(id, title, date)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase.from('connection_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('match_score', { ascending: false })
      .limit(3),

    supabase.from('circle_match_scores')
      .select('*, circle:connection_groups(name)')
      .eq('user_id', userId)
      .order('match_score', { ascending: false })
      .limit(2),

    supabase.from('meetups')
      .select('id, title, date, description')
      .gt('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(10)
  ]);

  const profile = profileResult.data;
  const recentMeetups = recentMeetupsResult.data || [];
  const circleRecs = circleRecsResult.data || [];
  const upcomingMeetups = upcomingMeetupsResult.data || [];

  // Fetch profiles separately for pending connection recommendations
  const pendingConnectionsRaw = pendingConnectionsResult.data || [];
  let pendingConnections = pendingConnectionsRaw;
  if (pendingConnectionsRaw.length > 0) {
    const recUserIds = pendingConnectionsRaw.map(r => r.recommended_user_id).filter(Boolean);
    if (recUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', recUserIds);
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
      pendingConnections = pendingConnectionsRaw.map(rec => ({
        ...rec,
        recommended_user: profileMap[rec.recommended_user_id] || null
      }));
    }
  }

  const nudges = [];

  // Priority 1: Connection follow-up (highest engagement)
  if (pendingConnections.length > 0) {
    const top = pendingConnections[0];
    const name = top.recommended_user?.name || 'Someone';
    nudges.push({
      user_id: userId,
      nudge_type: 'connection_followup',
      title: 'New connection waiting',
      message: `${name} from your last meetup could be a great connection. You share similar interests!`,
      action_url: '/discover',
      action_label: 'View suggestions',
      metadata: { recommendation_id: top.id, match_score: top.match_score }
    });
  }

  // Priority 2: Circle invitation
  if (circleRecs.length > 0 && nudges.length === 0) {
    const top = circleRecs[0];
    const circleName = top.circle?.name || 'a circle';
    nudges.push({
      user_id: userId,
      nudge_type: 'circle_invite',
      title: 'Join a circle',
      message: `"${circleName}" looks like a great fit based on your interests. Join to connect with like-minded professionals.`,
      action_url: '/circles',
      action_label: 'Explore circles',
      metadata: { circle_id: top.circle_id, match_score: top.match_score }
    });
  }

  // Priority 3: Inactive user (no recent meetups)
  const lastMeetupDate = recentMeetups[0]?.meetups?.date;
  const daysSinceLastMeetup = lastMeetupDate
    ? (Date.now() - new Date(lastMeetupDate)) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceLastMeetup > 14 && nudges.length === 0) {
    nudges.push({
      user_id: userId,
      nudge_type: 'inactive',
      title: 'We miss you!',
      message: `It's been a while since your last meetup. New events are happening this week - come say hi!`,
      action_url: '/meetups',
      action_label: 'Browse meetups',
      metadata: { days_inactive: Math.floor(daysSinceLastMeetup) }
    });
  }

  // Priority 4: Matching upcoming event
  if (nudges.length === 0 && upcomingMeetups.length > 0 && profile?.interests?.length > 0) {
    const userInterests = (profile.interests || []).map(i => i.toLowerCase());

    const matchingMeetup = upcomingMeetups.find(m => {
      const text = `${m.title} ${m.description || ''}`.toLowerCase();
      return userInterests.some(i => text.includes(i));
    });

    if (matchingMeetup) {
      nudges.push({
        user_id: userId,
        nudge_type: 'meetup_reminder',
        title: 'Event for you',
        message: `"${matchingMeetup.title}" matches your interests. Don't miss out!`,
        action_url: `/meetups/${matchingMeetup.id}`,
        action_label: 'View event',
        metadata: { meetup_id: matchingMeetup.id }
      });
    }
  }

  // Save the best nudge (only one per check to avoid spam)
  if (nudges.length > 0) {
    const bestNudge = nudges[0];

    const { error } = await supabase.from('user_nudges').insert(bestNudge);

    if (error) {
      console.error('[Nudges] Insert error:', error);
    } else {
      await logAgentExecution(supabase, 'nudge', 'rule');
    }

    return NextResponse.json({ nudges: [bestNudge], generated: true });
  }

  return NextResponse.json({ nudges: [], reason: 'No relevant nudges' });
}

/**
 * Batch generate nudges for eligible users (for cron job)
 */
async function generateBatchNudges(supabase) {
  // Get users who haven't received nudge in 3+ days and were active in last 30 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get users with recent nudges to exclude
  const { data: recentNudgeUsers } = await supabase
    .from('user_nudges')
    .select('user_id')
    .gt('created_at', threeDaysAgo);

  const recentNudgeUserIds = new Set((recentNudgeUsers || []).map(r => r.user_id));

  // Get active users
  const { data: activeUsers } = await supabase
    .from('profiles')
    .select('id')
    .gt('last_active', thirtyDaysAgo)
    .limit(200);

  const eligibleUsers = (activeUsers || []).filter(u => !recentNudgeUserIds.has(u.id));

  let processed = 0;
  let generated = 0;

  for (const user of eligibleUsers.slice(0, 50)) { // Process max 50 per batch
    try {
      const response = await generateUserNudges(supabase, user.id);
      const result = await response.json();

      processed++;
      if (result.generated) generated++;
    } catch (e) {
      console.error(`[Nudges] Batch error for user ${user.id}:`, e);
    }
  }

  return NextResponse.json({
    processed,
    generated,
    eligible: eligibleUsers.length
  });
}
