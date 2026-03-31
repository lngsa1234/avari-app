import { NextResponse } from 'next/server';
import { logAgentExecution, callAI, parseJSONFromAI } from '@/lib/agentHelpers';
import { authenticateRequest, verifyCronAuth, cronUnauthorized, createAdminClient } from '@/lib/apiAuth';

/**
 * Generate suggested discussion topics for a meetup based on attendee profiles.
 * Topics are generated once and cached in meetup_icebreakers.discussion_topics.
 *
 * POST /api/agent/discussion-topics
 * - Single: { meetupId, title, description, attendees: [{name, career, interests}] }
 * - Batch:  { batch: true }  — finds meetups within 24h and generates topics for them
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (body.batch) {
      if (!verifyCronAuth(request)) return cronUnauthorized();
      return handleBatch();
    }

    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    return handleSingle(body);
  } catch (error) {
    console.error('[DiscussionTopics] Error:', error);
    return NextResponse.json({ error: 'Failed to generate discussion topics' }, { status: 500 });
  }
}

/**
 * Batch mode: find meetups happening in the next 24 hours that don't have
 * cached topics yet, and generate topics for each (max 20 per run).
 */
async function handleBatch() {
  const supabase = createAdminClient();

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = in24h.toISOString().split('T')[0];

  // Find meetups happening today or tomorrow
  const { data: meetups, error: meetupsError } = await supabase
    .from('meetups')
    .select('id, topic, description, date')
    .in('date', [todayStr, tomorrowStr]);

  if (meetupsError || !meetups?.length) {
    return NextResponse.json({
      processed: 0,
      message: meetupsError ? meetupsError.message : 'No upcoming meetups within 24h',
    });
  }

  // Regenerate topics for all upcoming meetups (refreshes with latest attendee list)
  const toGenerate = meetups.slice(0, 20);

  const results = [];

  for (const meetup of toGenerate) {
    try {
      // Fetch attendee profiles for this meetup
      const { data: signups } = await supabase
        .from('meetup_signups')
        .select('user_id')
        .eq('meetup_id', meetup.id);

      const userIds = (signups || []).map(s => s.user_id);

      let attendees = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('name, career, interests')
          .in('id', userIds);
        attendees = profiles || [];
      }

      if (attendees.length < 1) {
        results.push({ meetupId: meetup.id, status: 'skipped', reason: 'no attendees' });
        continue;
      }

      // Generate topics
      const { topics, tier } = await generateTopics(meetup.topic, meetup.description, attendees);

      // Cache
      await cacheTopics(supabase, meetup.id, topics, tier);
      await logAgentExecution(supabase, 'discussion_topics', tier);

      results.push({ meetupId: meetup.id, status: 'generated', tier, topicCount: topics.length });
    } catch (err) {
      console.error(`[DiscussionTopics] Batch error for meetup ${meetup.id}:`, err);
      results.push({ meetupId: meetup.id, status: 'error', error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

/**
 * Single mode: generate topics for one meetup (with cache check).
 */
async function handleSingle({ meetupId, title, description, attendees }) {
  if (!meetupId) {
    return NextResponse.json({ error: 'meetupId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check cache first
  const { data: cached } = await supabase
    .from('meetup_icebreakers')
    .select('discussion_topics')
    .eq('meetup_id', meetupId)
    .single();

  if (cached?.discussion_topics) {
    return NextResponse.json({ topics: cached.discussion_topics, cached: true });
  }

  // Generate
  const { topics, tier } = await generateTopics(title, description, attendees || []);

  // Cache
  await cacheTopics(supabase, meetupId, topics, tier);
  await logAgentExecution(supabase, 'discussion_topics', tier);

  return NextResponse.json({ topics, cached: false, tier });
}

/**
 * Get cached discussion topics for a meetup
 *
 * GET /api/agent/discussion-topics?meetupId=xxx
 */
export async function GET(request) {
  try {
    const { user, response } = await authenticateRequest(request);
    if (!user) return response;

    const { searchParams } = new URL(request.url);
    const meetupId = searchParams.get('meetupId');

    if (!meetupId) {
      return NextResponse.json({ error: 'meetupId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data } = await supabase
      .from('meetup_icebreakers')
      .select('discussion_topics')
      .eq('meetup_id', meetupId)
      .single();

    if (data?.discussion_topics) {
      return NextResponse.json({ topics: data.discussion_topics, found: true });
    }

    return NextResponse.json({ topics: null, found: false });
  } catch (error) {
    console.error('[DiscussionTopics] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch discussion topics' }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

async function generateTopics(title, description, attendees) {
  const hasAI = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  const hasContext = title || (attendees?.length >= 1 &&
    attendees.some(a => a.interests?.length > 0 || a.career));

  if (!hasContext || !hasAI) {
    return { topics: generateTemplateTopics(title, attendees), tier: 'rule' };
  }

  return generateAITopics(title, description, attendees);
}

async function cacheTopics(supabase, meetupId, topics, tier) {
  const { data: existing } = await supabase
    .from('meetup_icebreakers')
    .select('id')
    .eq('meetup_id', meetupId)
    .single();

  if (existing) {
    await supabase
      .from('meetup_icebreakers')
      .update({ discussion_topics: topics })
      .eq('meetup_id', meetupId);
  } else {
    await supabase
      .from('meetup_icebreakers')
      .insert({
        meetup_id: meetupId,
        icebreakers: [],
        discussion_topics: topics,
        generation_type: tier,
      });
  }
}

function generateTemplateTopics(title, attendees) {
  const allInterests = [...new Set((attendees || []).flatMap(a => a.interests || []))];
  const careers = [...new Set((attendees || []).map(a => a.career).filter(Boolean))];

  const topics = [];

  if (allInterests.length > 0) {
    allInterests.slice(0, 3).forEach(interest => {
      topics.push({
        topic: interest,
        reason: 'Shared interest among attendees',
        emoji: '💡',
      });
    });
  }

  if (careers.length > 1) {
    topics.push({
      topic: 'Cross-industry perspectives and trends',
      reason: `With backgrounds in ${careers.slice(0, 3).join(', ')}`,
      emoji: '🔄',
    });
  }

  const fallbacks = [
    { topic: 'Current projects and what excites you', reason: 'Great way to find collaboration opportunities', emoji: '🚀' },
    { topic: 'Industry trends and predictions', reason: 'Learn from different perspectives', emoji: '📈' },
    { topic: 'Lessons learned and career pivots', reason: 'Valuable shared experiences', emoji: '🎯' },
    { topic: 'Resources and tools you recommend', reason: 'Practical takeaways for everyone', emoji: '🛠️' },
  ];

  while (topics.length < 4) {
    topics.push(fallbacks[topics.length]);
  }

  return topics.slice(0, 5);
}

async function generateAITopics(title, description, attendees) {
  const careers = [...new Set((attendees || []).map(a => a.career).filter(Boolean))];
  const interests = [...new Set((attendees || []).flatMap(a => a.interests || []))];

  const prompt = `Generate 4-5 suggested discussion topics for a professional networking meetup. These should be topics the attendees would find engaging based on their backgrounds and interests.

Meetup: "${title}"
Description: ${description?.slice(0, 300) || 'General networking event'}
Number of attendees: ${attendees.length}
Attendee careers: ${careers.slice(0, 8).join(', ') || 'Various professionals'}
Attendee interests: ${interests.slice(0, 10).join(', ') || 'Professional growth'}

Requirements:
- Topics should be specific and actionable, not generic
- Consider overlapping interests and complementary career backgrounds
- Each topic should spark meaningful group conversation
- Include a brief reason why this topic would resonate with this group
- Include an appropriate emoji for each topic

Return ONLY a JSON array in this exact format:
[
  {"topic": "Topic title", "reason": "Why this would resonate with this group", "emoji": "🎯"}
]`;

  const aiResult = await callAI(prompt, 800);

  if (aiResult) {
    const parsed = parseJSONFromAI(aiResult.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        topics: parsed.slice(0, 5).map(t => ({
          topic: t.topic || t,
          reason: t.reason || '',
          emoji: t.emoji || '💡',
        })),
        tier: 'light_ai',
      };
    }
  }

  return {
    topics: generateTemplateTopics(title, attendees),
    tier: 'rule',
  };
}
