import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAgentExecution, callAI, parseJSONFromAI, calculateInterestOverlap } from '@/lib/agentHelpers';
import { parseLocalDate } from '@/lib/dateUtils';

/**
 * Generate event recommendations for a user
 *
 * POST /api/agent/event-recommendations
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
      return await generateBatchEventRecs(supabase);
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    return await generateUserEventRecs(supabase, userId);
  } catch (error) {
    console.error('[EventRecs] Error:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}

/**
 * Get event recommendations for a user
 *
 * GET /api/agent/event-recommendations?userId=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch recommendations without join
    const { data: recsData, error } = await supabase
      .from('event_recommendations')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'viewed'])
      .order('match_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[EventRecs] GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
    }

    if (!recsData || recsData.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

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
    const activeRecs = recsData
      .map(rec => ({ ...rec, meetup: meetupMap[rec.meetup_id] || null }))
      .filter(r => r.meetup && parseLocalDate(r.meetup.date) > now);

    return NextResponse.json({ recommendations: activeRecs });
  } catch (error) {
    console.error('[EventRecs] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

/**
 * Update event recommendation status
 *
 * PATCH /api/agent/event-recommendations
 * Body: { recId, status }
 */
export async function PATCH(request) {
  try {
    const { recId, status } = await request.json();

    if (!recId || !status) {
      return NextResponse.json({ error: 'recId and status are required' }, { status: 400 });
    }

    const validStatuses = ['viewed', 'rsvp', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

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

    if (error) {
      console.error('[EventRecs] PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[EventRecs] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
  }
}

/**
 * Generate event recommendations for a specific user
 */
async function generateUserEventRecs(supabase, userId) {
  // Fetch user profile, past attendance, connections, and existing recs in parallel
  const [
    profileResult,
    pastAttendanceResult,
    connectionsResult,
    existingRecsResult,
    upcomingEventsResult
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),

    supabase.from('meetup_attendees')
      .select('meetup_id, meetups(id, title, description)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase.from('user_interests')
      .select('interested_in_user_id')
      .eq('user_id', userId),

    supabase.from('event_recommendations')
      .select('meetup_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'viewed', 'rsvp']),

    supabase.from('meetups')
      .select(`
        id, title, description, date, location, is_virtual,
        created_by,
        meetup_attendees(user_id)
      `)
      .gt('date', new Date().toISOString())
      .eq('is_public', true)
      .order('date', { ascending: true })
      .limit(50)
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = profileResult.data;
  const pastMeetupIds = new Set((pastAttendanceResult.data || []).map(a => a.meetup_id));
  const connectionIds = (connectionsResult.data || []).map(c => c.interested_in_user_id);
  const existingRecMeetupIds = new Set((existingRecsResult.data || []).map(r => r.meetup_id));
  const upcomingEvents = upcomingEventsResult.data || [];

  // Filter out events user already attended/RSVP'd or already recommended
  const eligibleEvents = upcomingEvents.filter(e =>
    !pastMeetupIds.has(e.id) && !existingRecMeetupIds.has(e.id)
  );

  if (eligibleEvents.length === 0) {
    return NextResponse.json({
      recommendations: [],
      message: 'No new events to recommend'
    });
  }

  // Score each event using rule-based matching
  const scoredEvents = scoreEvents(profile, eligibleEvents, connectionIds, pastAttendanceResult.data);

  // Check if we need AI to differentiate similar scores
  const topScores = scoredEvents.slice(0, 5).map(e => e.score);
  const scoresAreSimilar = topScores.length > 2 &&
    (Math.max(...topScores) - Math.min(...topScores)) < 0.15;

  let finalRecs = scoredEvents;
  let tier = 'rule';

  // Use AI only when rule-based scores are too close
  if (scoresAreSimilar && process.env.ANTHROPIC_API_KEY && scoredEvents.length >= 5) {
    const aiResult = await enhanceWithAI(profile, scoredEvents.slice(0, 10));
    if (aiResult) {
      finalRecs = aiResult;
      tier = 'light_ai';
    }
  }

  // Save top 5 recommendations
  const recsToSave = finalRecs
    .filter(r => r.score >= 0.25)
    .slice(0, 5)
    .map(r => ({
      user_id: userId,
      meetup_id: r.eventId,
      match_score: r.score,
      match_reasons: r.reasons,
      source: 'agent',
      status: 'pending'
    }));

  if (recsToSave.length > 0) {
    const { error: saveError } = await supabase.from('event_recommendations').upsert(recsToSave, {
      onConflict: 'user_id,meetup_id'
    });

    if (saveError) {
      console.error('[EventRecs] Save error:', saveError);
    }
  }

  await logAgentExecution(supabase, 'event_recommendation', tier);

  return NextResponse.json({
    recommendations: finalRecs.slice(0, 5),
    tier,
    totalEligible: eligibleEvents.length
  });
}

/**
 * Rule-based event scoring
 */
function scoreEvents(profile, events, connectionIds, pastAttendance) {
  const userInterests = new Set((profile?.interests || []).map(i => i.toLowerCase()));
  const userCareer = (profile?.career || '').toLowerCase();
  const userCareerWords = userCareer.split(/\s+/).filter(w => w.length > 3);

  // Extract patterns from past events
  const pastEventTitles = (pastAttendance || [])
    .map(a => a.meetups?.title?.toLowerCase() || '')
    .filter(Boolean);

  return events.map(event => {
    let score = 0;
    const reasons = [];

    const titleLower = (event.title || '').toLowerCase();
    const descLower = (event.description || '').toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;

    // 1. Interest match (weight: up to 0.35)
    const matchingInterests = [...userInterests].filter(interest =>
      combinedText.includes(interest)
    );
    if (matchingInterests.length > 0) {
      const interestScore = Math.min(matchingInterests.length * 0.12, 0.35);
      score += interestScore;
      reasons.push({
        reason: `Matches your interests: ${matchingInterests.slice(0, 2).join(', ')}`,
        weight: interestScore
      });
    }

    // 2. Career relevance (weight: up to 0.25)
    const careerMatch = userCareerWords.some(keyword =>
      combinedText.includes(keyword.toLowerCase())
    );
    if (careerMatch) {
      score += 0.25;
      reasons.push({ reason: 'Relevant to your career', weight: 0.25 });
    }

    // 3. Connections attending (weight: up to 0.20)
    const attendeeIds = (event.meetup_attendees || []).map(a => a.user_id);
    const connectionsAttending = attendeeIds.filter(id => connectionIds.includes(id));
    if (connectionsAttending.length > 0) {
      const connectionScore = Math.min(connectionsAttending.length * 0.08, 0.20);
      score += connectionScore;
      reasons.push({
        reason: `${connectionsAttending.length} connection(s) attending`,
        weight: connectionScore
      });
    }

    // 4. Similar to past events (weight: up to 0.15)
    const similarToPast = pastEventTitles.some(pastTitle => {
      const pastWords = pastTitle.split(/\s+/).filter(w => w.length > 4);
      return pastWords.some(word => titleLower.includes(word));
    });
    if (similarToPast) {
      score += 0.15;
      reasons.push({ reason: 'Similar to events you enjoyed', weight: 0.15 });
    }

    // 5. Timing - events soon get slight boost (weight: up to 0.05)
    const daysUntil = (parseLocalDate(event.date) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 7 && daysUntil >= 1) {
      score += 0.05;
      reasons.push({ reason: 'Happening soon', weight: 0.05 });
    }

    // 6. Host is a connection (weight: 0.10)
    if (connectionIds.includes(event.created_by)) {
      score += 0.10;
      reasons.push({
        reason: `Hosted by ${event.profiles?.name || 'a connection'}`,
        weight: 0.10
      });
    }

    // 7. Event popularity bonus (weight: up to 0.05)
    if (attendeeIds.length >= 5) {
      score += 0.05;
      reasons.push({ reason: `${attendeeIds.length} people attending`, weight: 0.05 });
    }

    return {
      eventId: event.id,
      title: event.title,
      description: event.description?.slice(0, 150),
      date: event.date,
      location: event.location,
      isVirtual: event.is_virtual,
      hostName: event.profiles?.name,
      attendeeCount: attendeeIds.length,
      score: Math.min(score, 1.0),
      reasons
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * AI-enhanced ranking when rule-based scores are similar
 */
async function enhanceWithAI(profile, scoredEvents) {
  const prompt = `You are matching a professional to networking events.

USER PROFILE:
- Career: ${profile.career || 'Not specified'}
- Interests: ${(profile.interests || []).join(', ') || 'Not specified'}
- Bio: ${profile.bio?.slice(0, 150) || 'Not provided'}

CANDIDATE EVENTS (pre-scored):
${scoredEvents.map((e, i) => `
${i + 1}. "${e.title}" (${parseLocalDate(e.date).toLocaleDateString()})
   Score: ${e.score.toFixed(2)} | ${e.attendeeCount} attending
   Reasons: ${e.reasons.map(r => r.reason).join('; ')}
`).join('')}

Re-rank the top 5 events that would be BEST for this user's professional growth and networking.
Consider career relevance, networking potential, and interest alignment.

Return ONLY a JSON array of event indices (1-based) in best-fit order:
[3, 1, 5, 2, 4]`;

  const aiResult = await callAI(prompt, 200);

  if (aiResult) {
    const ranking = parseJSONFromAI(aiResult.text);

    if (Array.isArray(ranking) && ranking.length > 0) {
      return ranking
        .filter(idx => idx >= 1 && idx <= scoredEvents.length)
        .slice(0, 5)
        .map((idx, position) => {
          const event = scoredEvents[idx - 1];
          const aiBoost = (5 - position) * 0.03;
          return {
            ...event,
            score: Math.min(event.score + aiBoost, 1.0),
            reasons: [
              ...event.reasons,
              { reason: 'AI-ranked as strong match', weight: aiBoost }
            ]
          };
        });
    }
  }

  return null;
}

/**
 * Batch generate recommendations for active users
 */
async function generateBatchEventRecs(supabase) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get users with recent recommendations to exclude
  const { data: recentRecUsers } = await supabase
    .from('event_recommendations')
    .select('user_id')
    .gt('created_at', sevenDaysAgo);

  const recentRecUserIds = new Set((recentRecUsers || []).map(r => r.user_id));

  // Get active users
  const { data: activeUsers } = await supabase
    .from('profiles')
    .select('id')
    .gt('last_active', thirtyDaysAgo)
    .limit(200);

  const eligibleUsers = (activeUsers || []).filter(u => !recentRecUserIds.has(u.id));

  let processed = 0;
  let generated = 0;

  for (const user of eligibleUsers.slice(0, 50)) {
    try {
      const response = await generateUserEventRecs(supabase, user.id);
      const result = await response.json();

      processed++;
      if (result.recommendations?.length > 0) generated++;
    } catch (e) {
      console.error(`[EventRecs] Batch error for user ${user.id}:`, e);
    }
  }

  return NextResponse.json({
    processed,
    generated,
    eligible: eligibleUsers.length
  });
}
