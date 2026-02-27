import { NextResponse } from 'next/server';

/**
 * Generate AI summary for call recap
 *
 * POST /api/generate-recap-summary
 * Body: { transcript, messages, participants, duration, meetingTitle, meetingType }
 *
 * Returns structured recap matching UX design:
 * - summary: Brief overview of the call
 * - sentiment: { overall, emoji, highlights }
 * - keyTakeaways: [{ emoji, text }]
 * - topicsDiscussed: [{ topic, mentions }]
 * - memorableQuotes: [{ quote, author }]
 * - actionItems: [{ text, done }]
 * - suggestedFollowUps: [{ personName, reason, suggestedTopic }]
 */
export async function POST(request) {
  try {
    const { transcript, messages, participants, duration, meetingTitle, meetingType } = await request.json();

    // Check if we have content to summarize
    if ((!transcript || transcript.length === 0) && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: 'No content to summarize' },
        { status: 400 }
      );
    }

    // Helper to get display name
    const getDisplayName = (p) => {
      if (typeof p === 'string') return p;
      if (p.name && p.name !== 'Unknown' && !p.name.includes('-')) {
        return p.name;
      }
      if (p.email) {
        const emailPart = p.email.split('@')[0];
        return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
      }
      return null;
    };

    // Build context for summary
    const participantNames = participants
      ?.map(p => getDisplayName(p))
      .filter(Boolean) || [];

    const participantList = participantNames.join(', ') || 'the participants';
    const durationMinutes = Math.floor((duration || 0) / 60);

    // Prepare content for summarization
    let contentToSummarize = '';

    if (transcript && transcript.length > 0) {
      // Use transcript for richer summary
      contentToSummarize = transcript
        .map(t => `${t.speakerName || 'Speaker'}: ${t.text}`)
        .join('\n');
    } else if (messages && messages.length > 0) {
      // Fall back to chat messages
      contentToSummarize = messages
        .map(m => `${m.user_name || 'User'}: ${m.message}`)
        .join('\n');
    }

    // Check for AI provider configuration
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    console.log('[Generate Recap Summary] Provider check — OpenAI:', !!openaiKey, 'Anthropic:', !!anthropicKey);
    console.log('[Generate Recap Summary] Content length:', contentToSummarize.length, 'Transcript entries:', transcript?.length, 'Messages:', messages?.length);

    let result = generateSimpleSummary(transcript, messages, participantNames, durationMinutes, meetingTitle);

    if (openaiKey) {
      // Use OpenAI
      console.log('[Generate Recap Summary] Using OpenAI');
      result = await generateWithOpenAI(openaiKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType);
    } else if (anthropicKey) {
      // Use Anthropic Claude
      console.log('[Generate Recap Summary] Using Anthropic');
      result = await generateWithAnthropic(anthropicKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType);
    } else {
      console.log('[Generate Recap Summary] No AI provider configured, using simple summary');
    }

    console.log('[Generate Recap Summary] Result summary:', result?.summary?.substring(0, 100));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Generate Recap Summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

const ENHANCED_SYSTEM_PROMPT = `You are a helpful assistant that analyzes video call transcripts. Your job is to summarize ONLY what was ACTUALLY SAID in the transcript.

CRITICAL RULES:
1. ONLY include information that was explicitly stated in the transcript
2. DO NOT infer, assume, or make up content based on meeting titles or context
3. If the transcript is minimal (e.g., just greetings or test messages), return minimal/empty results
4. NEVER hallucinate or fabricate discussions that didn't happen
5. If someone just said "hello" or "this is a test", do NOT pretend they discussed business topics

Return a JSON object with this structure:

{
  "summary": "Brief overview of what was ACTUALLY said (or 'Brief call with minimal conversation' if little was said)",
  "sentiment": {
    "overall": "Vibe description based on actual tone",
    "emoji": "Single emoji",
    "highlights": ["Only highlights from actual content, empty array if none"]
  },
  "keyTakeaways": [
    { "emoji": "💡", "text": "ONLY takeaways from things actually discussed" }
  ],
  "topicsDiscussed": [
    { "topic": "ONLY topics actually mentioned", "mentions": 1 }
  ],
  "memorableQuotes": [
    { "quote": "Actual quote from transcript", "author": "Speaker Name" }
  ],
  "actionItems": [
    { "text": "ONLY action items explicitly mentioned", "done": false }
  ],
  "suggestedFollowUps": []
}

Guidelines:
- If transcript has minimal content, return mostly empty arrays
- summary: Describe what actually happened, even if it's just "Brief test call"
- keyTakeaways: EMPTY array if nothing substantive was discussed
- topicsDiscussed: EMPTY array if no real topics were covered
- actionItems: EMPTY array if no actions were mentioned
- DO NOT make up professional-sounding takeaways that weren't discussed

Return ONLY valid JSON, no additional text or markdown.`;

/**
 * Generate structured summary using OpenAI
 */
async function generateWithOpenAI(apiKey, content, participants, duration, meetingTitle, meetingType) {
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
            content: ENHANCED_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Analyze this ${duration} minute ${meetingType || 'video call'}${meetingTitle ? ` titled "${meetingTitle}"` : ''} with ${participants.join(', ') || 'the participants'}:\n\n${content}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.choices[0]?.message?.content;

      try {
        // Try to extract JSON from the response (handle markdown code blocks)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr);
        return normalizeResponse(parsed, participants, duration, meetingTitle);
      } catch (parseError) {
        console.error('Failed to parse OpenAI JSON response:', parseError);
        return generateSimpleSummary(null, null, participants, duration, meetingTitle);
      }
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }

  return generateSimpleSummary(null, null, participants, duration, meetingTitle);
}

/**
 * Generate structured summary using Anthropic Claude
 */
async function generateWithAnthropic(apiKey, content, participants, duration, meetingTitle, meetingType) {
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
            content: `${ENHANCED_SYSTEM_PROMPT}

Analyze this ${duration} minute ${meetingType || 'video call'}${meetingTitle ? ` titled "${meetingTitle}"` : ''} with ${participants.join(', ') || 'the participants'}:

${content}`
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.content[0]?.text;
      console.log('[Anthropic] Response received, length:', responseText?.length);

      try {
        // Try to extract JSON from the response (handle markdown code blocks)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr);
        console.log('[Anthropic] Parsed successfully, summary:', parsed.summary?.substring(0, 80));
        return normalizeResponse(parsed, participants, duration, meetingTitle);
      } catch (parseError) {
        console.error('[Anthropic] Failed to parse JSON response:', parseError, 'Raw:', responseText?.substring(0, 200));
        return generateSimpleSummary(null, null, participants, duration, meetingTitle);
      }
    } else {
      const errBody = await response.text();
      console.error('[Anthropic] API error:', response.status, errBody.substring(0, 300));
    }
  } catch (e) {
    console.error('[Anthropic] Fetch error:', e);
  }

  console.log('[Anthropic] Falling back to simple summary');
  return generateSimpleSummary(null, null, participants, duration, meetingTitle);
}

/**
 * Normalize and validate the AI response
 */
function normalizeResponse(parsed, participants, duration, meetingTitle) {
  return {
    summary: parsed.summary || `A ${duration} minute meeting${meetingTitle ? ` about ${meetingTitle}` : ''}.`,
    sentiment: {
      overall: parsed.sentiment?.overall || 'Productive & Engaging',
      emoji: parsed.sentiment?.emoji || '✨',
      highlights: Array.isArray(parsed.sentiment?.highlights) ? parsed.sentiment.highlights : ['Good conversation']
    },
    keyTakeaways: Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways.map(t => ({
          emoji: t.emoji || '💡',
          text: typeof t === 'string' ? t : (t.text || '')
        }))
      : [{ emoji: '💡', text: 'Connection made' }],
    topicsDiscussed: Array.isArray(parsed.topicsDiscussed)
      ? parsed.topicsDiscussed.map(t => ({
          topic: typeof t === 'string' ? t : (t.topic || ''),
          mentions: t.mentions || 1
        }))
      : [{ topic: 'General conversation', mentions: 1 }],
    memorableQuotes: Array.isArray(parsed.memorableQuotes) ? parsed.memorableQuotes : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(a => ({
          text: typeof a === 'string' ? a : (a.text || ''),
          done: a.done || false
        }))
      : [],
    suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
      ? parsed.suggestedFollowUps.map(f => ({
          personName: f.personName || f.person?.name || '',
          reason: f.reason || '',
          suggestedTopic: f.suggestedTopic || ''
        }))
      : participants.slice(0, 2).map(p => ({
          personName: typeof p === 'string' ? p : (p.name || ''),
          reason: 'Continue the conversation',
          suggestedTopic: 'Follow up on discussion'
        }))
  };
}

/**
 * Generate a simple structured summary without AI
 */
function generateSimpleSummary(transcript, messages, participants, duration, meetingTitle) {
  const transcriptCount = transcript?.length || 0;
  const messageCount = messages?.length || 0;
  const participantList = Array.isArray(participants) ? participants : [];

  const allText = transcript?.map(t => t.text).join(' ').toLowerCase() ||
                  messages?.map(m => m.message || m.text || '').join(' ').toLowerCase() || '';

  // If there's no actual content, return minimal summary without fake insights
  const hasContent = allText.trim().length > 20; // At least some meaningful content

  // Build summary
  let summary = '';
  if (duration > 0) {
    summary = `You had a ${duration} minute video call`;
    if (participantList.length > 0) {
      summary += ` with ${participantList.join(', ')}`;
    }
    summary += '.';
    if (!hasContent) {
      summary += ' No conversation was transcribed.';
    }
  } else {
    summary = participantList.length > 0
      ? `You connected with ${participantList.join(', ')}.`
      : 'A video call session.';
  }

  // If no real content, return minimal response without fake takeaways
  if (!hasContent) {
    return {
      summary,
      sentiment: { overall: 'Brief call', emoji: '📞', highlights: [] },
      keyTakeaways: [],
      topicsDiscussed: [],
      memorableQuotes: [],
      actionItems: [],
      suggestedFollowUps: participantList.slice(0, 2).map(name => ({
        personName: name,
        reason: 'Continue the conversation',
        suggestedTopic: 'Catch up'
      }))
    };
  }

  // Detect topics and sentiment from content
  const topicsDiscussed = [];
  const keyTakeaways = [];
  const actionItems = [];
  let sentiment = { overall: 'Productive', emoji: '✨', highlights: ['Connection made'] };

  // Topic detection
  const topicKeywords = {
    'Career & Growth': ['career', 'job', 'growth', 'promotion', 'skill', 'learn'],
    'Networking': ['connect', 'network', 'meet', 'coffee', 'intro'],
    'Business & Strategy': ['business', 'startup', 'company', 'strategy', 'market'],
    'Technology': ['tech', 'software', 'code', 'developer', 'app'],
    'Work & Projects': ['project', 'work', 'team', 'deadline', 'task'],
    'Personal Development': ['mindset', 'habit', 'goal', 'balance', 'wellness']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const mentions = keywords.filter(k => allText.includes(k)).length;
    if (mentions > 0) {
      topicsDiscussed.push({ topic, mentions: mentions * 2 });
    }
  }

  // Sort by mentions
  topicsDiscussed.sort((a, b) => b.mentions - a.mentions);

  // Sentiment detection
  const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excited', 'happy', 'wonderful'];

  const positiveCount = positiveWords.filter(w => allText.includes(w)).length;
  if (positiveCount >= 3) {
    sentiment = { overall: 'Energizing & Inspiring', emoji: '🔥', highlights: ['Great energy', 'Positive vibes', 'Authentic connection'] };
  } else if (positiveCount >= 1) {
    sentiment = { overall: 'Warm & Supportive', emoji: '🤝', highlights: ['Good conversation', 'Mutual support'] };
  }

  // Key takeaways - only add if detected from actual content
  if (allText.includes('learn') || allText.includes('insight')) {
    keyTakeaways.push({ emoji: '💡', text: 'New insights shared' });
  }
  if (allText.includes('connect') || allText.includes('network')) {
    keyTakeaways.push({ emoji: '🤝', text: 'Valuable networking opportunity' });
  }
  if (allText.includes('help') || allText.includes('support')) {
    keyTakeaways.push({ emoji: '💪', text: 'Mutual support offered' });
  }

  // Action items - only add if detected from actual content
  if (allText.includes('follow up') || allText.includes('next time')) {
    actionItems.push({ text: 'Schedule a follow-up conversation', done: false });
  }
  if (allText.includes('send') || allText.includes('share')) {
    actionItems.push({ text: 'Share resources discussed', done: false });
  }
  if (allText.includes('connect') && allText.includes('linkedin')) {
    actionItems.push({ text: 'Connect on LinkedIn', done: false });
  }

  // Suggested follow-ups
  const suggestedFollowUps = participantList.slice(0, 2).map(name => ({
    personName: name,
    reason: 'Continue building the connection',
    suggestedTopic: topicsDiscussed[0]?.topic || 'Catch up'
  }));

  return {
    summary,
    sentiment,
    keyTakeaways,
    topicsDiscussed: topicsDiscussed.slice(0, 5),
    memorableQuotes: [],
    actionItems,
    suggestedFollowUps
  };
}
