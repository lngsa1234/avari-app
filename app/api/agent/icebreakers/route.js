import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAgentExecution, callAI, parseJSONFromAI } from '@/lib/agentHelpers';

/**
 * Generate icebreakers for a meetup
 *
 * POST /api/agent/icebreakers
 * Body: { meetupId, title, description, attendees: [{career, interests}] }
 */
export async function POST(request) {
  try {
    const { meetupId, callType, title, description, attendees } = await request.json();

    if (!meetupId) {
      return NextResponse.json({ error: 'meetupId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Check cache first (only for meetups — coffee/circle IDs aren't in this table)
    if (callType === 'meetup' || !callType) {
      const { data: cached } = await supabase
        .from('meetup_icebreakers')
        .select('icebreakers, generation_type')
        .eq('meetup_id', meetupId)
        .single();

      if (cached) {
        return NextResponse.json({
          icebreakers: cached.icebreakers,
          cached: true,
          tier: cached.generation_type
        });
      }
    }

    // Decide tier based on context richness
    const hasRichContext = attendees?.length > 3 && description?.length > 50;

    let icebreakers;
    let tier;

    if (!hasRichContext || !process.env.ANTHROPIC_API_KEY) {
      // Tier 1: Template-based (FREE)
      icebreakers = generateTemplateIcebreakers(title);
      tier = 'rule';
    } else {
      // Tier 2: Light AI (Haiku/GPT-4o-mini)
      const aiResult = await generateAIIcebreakers(title, description, attendees);
      icebreakers = aiResult.icebreakers;
      tier = aiResult.tier;
    }

    // Cache result (only for meetups — coffee/circle IDs would violate FK constraint)
    if (callType === 'meetup' || !callType) {
      const { error: cacheError } = await supabase.from('meetup_icebreakers').upsert({
        meetup_id: meetupId,
        icebreakers,
        generation_type: tier
      }, {
        onConflict: 'meetup_id'
      });

      if (cacheError) {
        console.error('[Icebreakers] Cache error:', cacheError);
      }
    }

    // Log execution for cost tracking
    await logAgentExecution(supabase, 'icebreaker', tier);

    return NextResponse.json({ icebreakers, cached: false, tier });
  } catch (error) {
    console.error('[Icebreakers] Error:', error);
    return NextResponse.json({ error: 'Failed to generate icebreakers' }, { status: 500 });
  }
}

/**
 * Get cached icebreakers for a meetup
 *
 * GET /api/agent/icebreakers?meetupId=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const meetupId = searchParams.get('meetupId');

    if (!meetupId) {
      return NextResponse.json({ error: 'meetupId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('meetup_icebreakers')
      .select('icebreakers, generation_type, generated_at')
      .eq('meetup_id', meetupId)
      .single();

    if (error || !data) {
      return NextResponse.json({ icebreakers: null, found: false });
    }

    return NextResponse.json({
      icebreakers: data.icebreakers,
      tier: data.generation_type,
      generatedAt: data.generated_at,
      found: true
    });
  } catch (error) {
    console.error('[Icebreakers] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch icebreakers' }, { status: 500 });
  }
}

/**
 * Generate template-based icebreakers (FREE tier)
 */
function generateTemplateIcebreakers(title) {
  const templates = {
    general: [
      { question: "What's one thing you're hoping to learn or achieve this month?", category: "goals" },
      { question: "What's a book, podcast, or article that's influenced your thinking recently?", category: "learning" },
      { question: "What's the best professional advice you've ever received?", category: "career" },
      { question: "What's something you're working on that you're excited about?", category: "projects" }
    ],
    tech: [
      { question: "What tool or technology are you most excited about right now?", category: "tech" },
      { question: "What's a problem you're trying to solve at work?", category: "work" },
      { question: "If you could learn any new technical skill instantly, what would it be?", category: "growth" },
      { question: "What's a tech trend you think is overhyped or underhyped?", category: "opinion" }
    ],
    marketing: [
      { question: "What's a campaign or brand story that inspired you recently?", category: "inspiration" },
      { question: "How has your approach to marketing evolved in the past year?", category: "growth" },
      { question: "What's your hot take on the future of marketing?", category: "opinion" },
      { question: "What marketing channel do you think is underutilized?", category: "strategy" }
    ],
    leadership: [
      { question: "What's the most valuable leadership lesson you've learned?", category: "wisdom" },
      { question: "How do you approach making difficult decisions?", category: "process" },
      { question: "What's one habit that's made you more effective as a leader?", category: "habits" },
      { question: "How do you balance being supportive vs. challenging your team?", category: "management" }
    ],
    startup: [
      { question: "What's the biggest challenge you're facing in your business right now?", category: "challenges" },
      { question: "What's one piece of advice you wish you'd gotten earlier?", category: "wisdom" },
      { question: "How do you stay motivated during tough times?", category: "mindset" },
      { question: "What's your superpower as a founder?", category: "strengths" }
    ],
    networking: [
      { question: "What brings you to this event today?", category: "intro" },
      { question: "What kind of connections are you hoping to make?", category: "goals" },
      { question: "What's something interesting you've learned from a recent conversation?", category: "learning" },
      { question: "Who's been a valuable connection for you and why?", category: "relationships" }
    ]
  };

  const titleLower = (title || '').toLowerCase();

  // Match keywords to template categories
  if (titleLower.includes('tech') || titleLower.includes('engineer') || titleLower.includes('dev') || titleLower.includes('software')) {
    return [...templates.general.slice(0, 2), ...templates.tech.slice(0, 2)];
  }
  if (titleLower.includes('marketing') || titleLower.includes('brand') || titleLower.includes('growth')) {
    return [...templates.general.slice(0, 2), ...templates.marketing.slice(0, 2)];
  }
  if (titleLower.includes('leader') || titleLower.includes('executive') || titleLower.includes('manager')) {
    return [...templates.general.slice(0, 2), ...templates.leadership.slice(0, 2)];
  }
  if (titleLower.includes('startup') || titleLower.includes('founder') || titleLower.includes('entrepreneur')) {
    return [...templates.general.slice(0, 2), ...templates.startup.slice(0, 2)];
  }
  if (titleLower.includes('network') || titleLower.includes('connect') || titleLower.includes('mixer')) {
    return [...templates.networking.slice(0, 2), ...templates.general.slice(0, 2)];
  }

  return templates.general;
}

/**
 * Generate AI-powered icebreakers (LIGHT AI tier)
 */
async function generateAIIcebreakers(title, description, attendees) {
  const careers = [...new Set((attendees || []).map(a => a.career).filter(Boolean))];
  const interests = [...new Set((attendees || []).flatMap(a => a.interests || []))];

  const prompt = `Generate 4 unique icebreaker questions for a professional networking meetup.

Meetup: "${title}"
Description: ${description?.slice(0, 300) || 'General networking event'}
Attendee backgrounds: ${careers.slice(0, 6).join(', ') || 'Various professionals'}
Common interests: ${interests.slice(0, 8).join(', ') || 'Professional growth'}

Requirements:
- Questions should be open-ended and encourage meaningful conversation
- Mix of professional and slightly personal (but appropriate) questions
- Relevant to the attendee backgrounds when possible
- Avoid yes/no questions
- Each question should have a category tag

Return ONLY a JSON array in this exact format:
[
  {"question": "Your question here?", "category": "category_name"},
  {"question": "Another question?", "category": "category_name"}
]

Categories can be: goals, learning, career, projects, inspiration, opinion, challenges, or relationships`;

  const aiResult = await callAI(prompt, 600);

  if (aiResult) {
    const parsed = parseJSONFromAI(aiResult.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        icebreakers: parsed.slice(0, 4).map(q => ({
          question: q.question || q,
          category: q.category || 'general'
        })),
        tier: 'light_ai'
      };
    }
  }

  // Fallback to templates
  return {
    icebreakers: generateTemplateIcebreakers(title),
    tier: 'rule'
  };
}
