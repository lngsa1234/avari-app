import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Generate AI-powered connection and group recommendations
 *
 * POST /api/generate-connection-recommendations
 * Body: {
 *   callRecapId: string,
 *   meetupId: string,
 *   channelName: string,
 *   transcript: [{speakerId, speakerName, text, timestamp}],
 *   participants: [{id, name, email, career, bio, interests}],
 *   existingGroups: [{id, name, creator_id, member_count, topics}]
 * }
 */
export async function POST(request) {
  try {
    const {
      callRecapId,
      meetupId,
      channelName,
      transcript,
      participants,
      existingGroups
    } = await request.json();

    // Validate inputs
    if (!participants || participants.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 participants for recommendations' },
        { status: 400 }
      );
    }

    // Build participant context for AI
    const participantContext = participants.map(p => ({
      id: p.id,
      name: p.name || p.email?.split('@')[0] || 'Unknown',
      career: p.career || 'Not specified',
      bio: p.bio || '',
      interests: p.interests || []
    }));

    // Build conversation context
    const conversationSummary = transcript?.length > 0
      ? transcript.map(t => `${t.speakerName || 'Speaker'}: ${t.text}`).join('\n')
      : '';

    // Generate recommendations using AI
    const { connectionRecs, groupRecs } = await generateAIRecommendations(
      participantContext,
      conversationSummary,
      existingGroups || []
    );

    // Save recommendations to database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Save connection recommendations
    if (connectionRecs.length > 0) {
      const connectionRecsToInsert = connectionRecs.map(rec => ({
        call_recap_id: callRecapId,
        meetup_id: meetupId,
        channel_name: channelName,
        user_id: rec.userId,
        recommended_user_id: rec.recommendedUserId,
        match_score: rec.matchScore,
        reason: rec.reason,
        shared_topics: rec.sharedTopics,
        status: 'pending'
      }));

      const { error: connError } = await supabase
        .from('connection_recommendations')
        .upsert(connectionRecsToInsert, {
          onConflict: 'call_recap_id,user_id,recommended_user_id'
        });

      if (connError) {
        console.error('[Recommendations] Error saving connections:', connError);
      }
    }

    // Save group recommendations
    if (groupRecs.length > 0) {
      const groupRecsToInsert = groupRecs.map(rec => ({
        call_recap_id: callRecapId,
        meetup_id: meetupId,
        channel_name: channelName,
        user_id: rec.userId,
        recommendation_type: rec.type,
        suggested_group_id: rec.type === 'join_existing' ? rec.groupId : null,
        suggested_members: rec.type === 'form_new' ? rec.suggestedMembers : null,
        suggested_name: rec.suggestedName,
        suggested_topic: rec.suggestedTopic,
        match_score: rec.matchScore,
        reason: rec.reason,
        status: 'pending'
      }));

      const { error: groupError } = await supabase
        .from('group_recommendations')
        .insert(groupRecsToInsert);

      if (groupError) {
        console.error('[Recommendations] Error saving groups:', groupError);
      }
    }

    return NextResponse.json({
      success: true,
      connectionCount: connectionRecs.length,
      groupCount: groupRecs.length
    });

  } catch (error) {
    console.error('[Generate Recommendations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations using AI (OpenAI or Anthropic)
 */
async function generateAIRecommendations(participants, conversationSummary, existingGroups) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const prompt = buildRecommendationPrompt(participants, conversationSummary, existingGroups);

  let aiResponse = null;

  if (openaiKey) {
    aiResponse = await generateWithOpenAI(openaiKey, prompt);
  } else if (anthropicKey) {
    aiResponse = await generateWithAnthropic(anthropicKey, prompt);
  }

  if (aiResponse) {
    return parseAIRecommendations(aiResponse, participants);
  }

  // Fallback: simple profile-based matching
  return generateSimpleRecommendations(participants, existingGroups);
}

function buildRecommendationPrompt(participants, conversation, existingGroups) {
  const participantList = participants.map(p =>
    `- ID: ${p.id}, Name: ${p.name}, Career: ${p.career}${p.bio ? ', Bio: ' + p.bio.slice(0, 100) : ''}${p.interests?.length ? ', Interests: ' + p.interests.join(', ') : ''}`
  ).join('\n');

  const groupList = existingGroups.length > 0
    ? existingGroups.map(g =>
        `- ID: ${g.id}, Name: "${g.name}", Members: ${g.member_count || 'unknown'}`
      ).join('\n')
    : 'No existing groups available';

  return `Analyze this meetup to suggest meaningful connections and group formations.

PARTICIPANTS (${participants.length}):
${participantList}

EXISTING CONNECTION GROUPS:
${groupList}

CONVERSATION:
${conversation ? conversation.slice(0, 4000) : 'No transcript available - base recommendations on profiles only'}

Generate recommendations in this exact JSON format:
{
  "connections": [
    {
      "user1Id": "uuid1",
      "user2Id": "uuid2",
      "matchScore": 0.85,
      "reason": "Both work in AI/ML and discussed model optimization",
      "sharedTopics": ["AI", "machine learning", "optimization"]
    }
  ],
  "groups": [
    {
      "type": "form_new",
      "forUsers": ["uuid1", "uuid2", "uuid3"],
      "suggestedName": "AI/ML Cohort",
      "suggestedTopic": "Machine Learning",
      "matchScore": 0.9,
      "reason": "Three participants with strong AI backgrounds who engaged deeply on ML topics"
    },
    {
      "type": "join_existing",
      "forUser": "uuid1",
      "groupId": "existing-group-uuid",
      "matchScore": 0.75,
      "reason": "User's interests align with this group's focus"
    }
  ]
}

Rules:
1. Only include connections with matchScore >= 0.5
2. For "form_new" groups, need 3-4 participants with strong shared interests
3. For "join_existing", match users to existing groups based on career/interests
4. Focus on genuine, meaningful connections
5. Keep reasons concise (1-2 sentences)
6. Return valid JSON only`;
}

async function generateWithOpenAI(apiKey, prompt) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing professional networking conversations and identifying meaningful connection opportunities. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content;
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }
  return null;
}

async function generateWithAnthropic(apiKey, prompt) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.content[0]?.text;
    }
  } catch (e) {
    console.error('Anthropic error:', e);
  }
  return null;
}

function parseAIRecommendations(aiResponse, participants) {
  const connectionRecs = [];
  const groupRecs = [];

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = aiResponse;
    const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    // Process connection recommendations
    if (parsed.connections && Array.isArray(parsed.connections)) {
      for (const conn of parsed.connections) {
        // Validate UUIDs exist in participants
        const user1 = participants.find(p => p.id === conn.user1Id);
        const user2 = participants.find(p => p.id === conn.user2Id);

        if (user1 && user2 && conn.matchScore >= 0.5) {
          // Create bidirectional recommendations
          connectionRecs.push({
            userId: conn.user1Id,
            recommendedUserId: conn.user2Id,
            matchScore: Math.min(conn.matchScore, 1.0),
            reason: conn.reason || 'Based on shared interests',
            sharedTopics: conn.sharedTopics || []
          });
          connectionRecs.push({
            userId: conn.user2Id,
            recommendedUserId: conn.user1Id,
            matchScore: Math.min(conn.matchScore, 1.0),
            reason: conn.reason || 'Based on shared interests',
            sharedTopics: conn.sharedTopics || []
          });
        }
      }
    }

    // Process group recommendations
    if (parsed.groups && Array.isArray(parsed.groups)) {
      for (const group of parsed.groups) {
        if (group.type === 'form_new' && group.forUsers?.length >= 3) {
          // Create recommendation for each suggested member
          for (const userId of group.forUsers) {
            if (participants.find(p => p.id === userId)) {
              groupRecs.push({
                userId,
                type: 'form_new',
                suggestedMembers: group.forUsers.filter(id => id !== userId),
                suggestedName: group.suggestedName,
                suggestedTopic: group.suggestedTopic,
                matchScore: Math.min(group.matchScore || 0.7, 1.0),
                reason: group.reason || 'Based on shared interests from the meetup'
              });
            }
          }
        } else if (group.type === 'join_existing' && group.forUser && group.groupId) {
          if (participants.find(p => p.id === group.forUser)) {
            groupRecs.push({
              userId: group.forUser,
              type: 'join_existing',
              groupId: group.groupId,
              matchScore: Math.min(group.matchScore || 0.6, 1.0),
              reason: group.reason || 'Your interests align with this group'
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing AI recommendations:', e);
  }

  return { connectionRecs, groupRecs };
}

/**
 * Fallback: Generate simple recommendations based on profile matching
 */
function generateSimpleRecommendations(participants, existingGroups) {
  const connectionRecs = [];
  const groupRecs = [];

  // Generate connection recommendations based on interests overlap
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const p1 = participants[i];
      const p2 = participants[j];

      // Calculate match based on interests and career similarity
      const sharedInterests = (p1.interests || []).filter(
        int => (p2.interests || []).some(i2 =>
          i2.toLowerCase().includes(int.toLowerCase()) ||
          int.toLowerCase().includes(i2.toLowerCase())
        )
      );

      const careerMatch = p1.career && p2.career &&
        (p1.career.toLowerCase().includes(p2.career.toLowerCase().split(' ')[0]) ||
         p2.career.toLowerCase().includes(p1.career.toLowerCase().split(' ')[0]));

      let matchScore = 0.5;
      if (sharedInterests.length > 0) matchScore += sharedInterests.length * 0.1;
      if (careerMatch) matchScore += 0.15;
      matchScore = Math.min(matchScore, 1.0);

      if (matchScore >= 0.5) {
        const reason = sharedInterests.length > 0
          ? `You both share interests in ${sharedInterests.slice(0, 2).join(' and ')}`
          : careerMatch
            ? `You both work in similar fields`
            : 'You attended the same meetup';

        // Bidirectional recommendations
        connectionRecs.push({
          userId: p1.id,
          recommendedUserId: p2.id,
          matchScore,
          reason,
          sharedTopics: sharedInterests.slice(0, 4)
        });
        connectionRecs.push({
          userId: p2.id,
          recommendedUserId: p1.id,
          matchScore,
          reason,
          sharedTopics: sharedInterests.slice(0, 4)
        });
      }
    }
  }

  // If 3+ participants have shared interests, suggest forming a group
  if (participants.length >= 3) {
    // Find common interests across all participants
    const allInterests = participants.flatMap(p => p.interests || []);
    const interestCounts = {};
    for (const interest of allInterests) {
      const key = interest.toLowerCase();
      interestCounts[key] = (interestCounts[key] || 0) + 1;
    }

    // Find interests shared by 3+ people
    const sharedByMany = Object.entries(interestCounts)
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (sharedByMany.length > 0) {
      const topInterest = sharedByMany[0][0];
      const relevantParticipants = participants.filter(p =>
        (p.interests || []).some(i => i.toLowerCase() === topInterest)
      );

      if (relevantParticipants.length >= 3) {
        const suggestedName = `${topInterest.charAt(0).toUpperCase() + topInterest.slice(1)} Cohort`;

        for (const p of relevantParticipants) {
          groupRecs.push({
            userId: p.id,
            type: 'form_new',
            suggestedMembers: relevantParticipants.filter(rp => rp.id !== p.id).map(rp => rp.id),
            suggestedName,
            suggestedTopic: topInterest,
            matchScore: 0.75,
            reason: `${relevantParticipants.length} meetup participants share an interest in ${topInterest}`
          });
        }
      }
    }
  }

  // Suggest joining existing groups based on interests
  for (const group of existingGroups) {
    for (const p of participants) {
      // Simple name-based matching
      const groupNameLower = (group.name || '').toLowerCase();
      const hasMatchingInterest = (p.interests || []).some(i =>
        groupNameLower.includes(i.toLowerCase()) ||
        i.toLowerCase().includes(groupNameLower.split(' ')[0])
      );

      if (hasMatchingInterest) {
        groupRecs.push({
          userId: p.id,
          type: 'join_existing',
          groupId: group.id,
          matchScore: 0.65,
          reason: `Your interests align with the "${group.name}" group`
        });
      }
    }
  }

  return { connectionRecs, groupRecs };
}
