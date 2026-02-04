import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAgentExecution, callAI, parseJSONFromAI, calculateInterestOverlap } from '@/lib/agentHelpers';

/**
 * Match user to circles
 *
 * POST /api/agent/circle-match
 * Body: { userId }
 */
export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch user profile and all active circles
    const [userResult, circlesResult, existingMemberships] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('connection_groups')
        .select(`
          id, name, created_at,
          connection_group_members(user_id, profiles(career, interests, bio))
        `)
        .eq('is_active', true),
      supabase.from('connection_group_members')
        .select('group_id')
        .eq('user_id', userId)
    ]);

    if (userResult.error || !userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.data;
    const circles = circlesResult.data || [];
    const memberOfIds = new Set((existingMemberships.data || []).map(m => m.group_id));

    // Filter out circles user already belongs to
    const eligibleCircles = circles.filter(c => !memberOfIds.has(c.id));

    if (eligibleCircles.length === 0) {
      return NextResponse.json({ matches: [], message: 'No new circles available' });
    }

    // Tier 1: Rule-based matching (always run first)
    const ruleMatches = computeRuleBasedMatches(user, eligibleCircles);

    // Only use AI if we have unclear results (multiple scores between 0.4-0.7)
    const midRangeScores = ruleMatches.filter(m => m.score >= 0.4 && m.score <= 0.7);
    const needsAI = midRangeScores.length >= 3 && process.env.ANTHROPIC_API_KEY;

    let finalMatches = ruleMatches;
    let tier = 'rule';

    if (needsAI && eligibleCircles.length <= 15) {
      // Tier 2: Light AI for better reasoning
      const aiResult = await computeAIMatches(user, eligibleCircles, ruleMatches);
      if (aiResult) {
        finalMatches = aiResult;
        tier = 'light_ai';
      }
    }

    // Save scores to database
    const scoresToSave = finalMatches
      .filter(m => m.score >= 0.3)
      .slice(0, 10)
      .map(m => ({
        user_id: userId,
        circle_id: m.circleId,
        match_score: m.score,
        match_reasons: m.reasons,
        computed_at: new Date().toISOString()
      }));

    if (scoresToSave.length > 0) {
      const { error: saveError } = await supabase.from('circle_match_scores').upsert(scoresToSave, {
        onConflict: 'user_id,circle_id'
      });

      if (saveError) {
        console.error('[CircleMatch] Save error:', saveError);
      }
    }

    await logAgentExecution(supabase, 'circle_match', tier);

    // Return top 5 matches
    return NextResponse.json({
      matches: finalMatches.filter(m => m.score >= 0.4).slice(0, 5),
      tier,
      totalEligible: eligibleCircles.length
    });
  } catch (error) {
    console.error('[CircleMatch] Error:', error);
    return NextResponse.json({ error: 'Failed to match circles' }, { status: 500 });
  }
}

/**
 * Get cached circle matches for a user
 *
 * GET /api/agent/circle-match?userId=xxx
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

    const { data, error } = await supabase
      .from('circle_match_scores')
      .select(`
        *,
        circle:connection_groups(id, name, is_active, connection_group_members(count))
      `)
      .eq('user_id', userId)
      .order('match_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[CircleMatch] GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }

    // Filter out inactive circles
    const activeMatches = (data || []).filter(m => m.circle?.is_active);

    return NextResponse.json({ matches: activeMatches });
  } catch (error) {
    console.error('[CircleMatch] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}

/**
 * Rule-based circle matching
 */
function computeRuleBasedMatches(user, circles) {
  const userInterests = new Set((user.interests || []).map(i => i.toLowerCase()));
  const userCareer = (user.career || '').toLowerCase();
  const userCareerWords = userCareer.split(/\s+/).filter(w => w.length > 3);

  return circles.map(circle => {
    let score = 0;
    const reasons = [];

    // Get circle member profiles
    const memberProfiles = (circle.connection_group_members || [])
      .map(m => m.profiles)
      .filter(Boolean);

    // 1. Interest overlap with circle members (weight: up to 0.40)
    const circleInterests = new Set(
      memberProfiles.flatMap(p => (p.interests || []).map(i => i.toLowerCase()))
    );
    const { overlap: sharedInterests, score: interestScore } = calculateInterestOverlap(
      [...userInterests],
      [...circleInterests]
    );

    if (sharedInterests.length > 0) {
      const interestWeight = Math.min(sharedInterests.length * 0.12, 0.40);
      score += interestWeight;
      reasons.push({
        reason: `Shared interests: ${sharedInterests.slice(0, 3).join(', ')}`,
        weight: interestWeight
      });
    }

    // 2. Career similarity (weight: up to 0.25)
    const circleCareers = memberProfiles.map(p => (p.career || '').toLowerCase());
    const careerMatches = circleCareers.filter(c => {
      const cWords = c.split(/\s+/).filter(w => w.length > 3);
      return userCareerWords.some(uw => cWords.some(cw =>
        cw.includes(uw) || uw.includes(cw)
      ));
    });

    if (careerMatches.length > 0) {
      const careerWeight = Math.min(careerMatches.length * 0.08, 0.25);
      score += careerWeight;
      reasons.push({
        reason: `${careerMatches.length} member(s) with similar career background`,
        weight: careerWeight
      });
    }

    // 3. Circle name keyword match (weight: up to 0.20)
    const nameLower = (circle.name || '').toLowerCase();
    const nameMatches = [...userInterests].filter(i => nameLower.includes(i));
    if (nameMatches.length > 0) {
      score += 0.20;
      reasons.push({
        reason: `Circle "${circle.name}" matches your interests`,
        weight: 0.20
      });
    }

    // 4. Size bonus - smaller circles are more intimate (weight: up to 0.10)
    const memberCount = memberProfiles.length;
    if (memberCount >= 3 && memberCount <= 8) {
      score += 0.10;
      reasons.push({
        reason: `Intimate group size (${memberCount} members)`,
        weight: 0.10
      });
    } else if (memberCount > 0 && memberCount < 3) {
      score += 0.05;
      reasons.push({
        reason: `Growing circle (${memberCount} members)`,
        weight: 0.05
      });
    }

    // 5. Bio keyword matching (weight: up to 0.15)
    if (user.bio) {
      const userBioWords = user.bio.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const circleBios = memberProfiles.map(p => (p.bio || '').toLowerCase()).join(' ');
      const bioMatches = userBioWords.filter(w => circleBios.includes(w));

      if (bioMatches.length >= 3) {
        score += 0.15;
        reasons.push({
          reason: 'Similar professional background',
          weight: 0.15
        });
      } else if (bioMatches.length >= 1) {
        score += 0.08;
        reasons.push({
          reason: 'Some shared professional context',
          weight: 0.08
        });
      }
    }

    return {
      circleId: circle.id,
      circleName: circle.name,
      score: Math.min(score, 1.0),
      reasons,
      memberCount
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * AI-enhanced circle matching
 */
async function computeAIMatches(user, circles, ruleMatches) {
  const top10 = ruleMatches.slice(0, 10);

  const prompt = `You are matching a professional to networking circles/groups.

USER PROFILE:
- Career: ${user.career || 'Not specified'}
- Interests: ${(user.interests || []).join(', ') || 'Not specified'}
- Bio: ${user.bio?.slice(0, 200) || 'Not provided'}

CANDIDATE CIRCLES (with pre-computed scores):
${top10.map((m, i) => `
${i + 1}. "${m.circleName}" (${m.memberCount} members)
   Score: ${m.score.toFixed(2)}
   Reasons: ${m.reasons.map(r => r.reason).join('; ')}
`).join('')}

Re-rank the top 5 circles that would be the BEST fit for this user.
Consider:
- Networking value and growth potential
- Complementary skills (not just identical backgrounds)
- Community fit

Return a JSON array of circle indices (1-based) in order of best fit:
[3, 1, 5, 2, 4]

Only return the JSON array, nothing else.`;

  const aiResult = await callAI(prompt, 200);

  if (aiResult) {
    const ranking = parseJSONFromAI(aiResult.text);

    if (Array.isArray(ranking) && ranking.length > 0) {
      // Reorder and adjust scores based on AI ranking
      return ranking
        .filter(idx => idx >= 1 && idx <= top10.length)
        .slice(0, 5)
        .map((idx, position) => {
          const match = top10[idx - 1];
          const aiBoost = (5 - position) * 0.04; // Boost based on AI ranking position
          return {
            ...match,
            score: Math.min(match.score + aiBoost, 1.0),
            reasons: [
              ...match.reasons,
              { reason: 'AI-ranked as strong fit', weight: aiBoost }
            ]
          };
        });
    }
  }

  // Fallback to rule-based results
  return null;
}
