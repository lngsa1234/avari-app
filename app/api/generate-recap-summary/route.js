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

    let result = generateSimpleSummary(transcript, messages, participantNames, durationMinutes, meetingTitle);

    if (openaiKey) {
      // Use OpenAI
      result = await generateWithOpenAI(openaiKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType);
    } else if (anthropicKey) {
      // Use Anthropic Claude
      result = await generateWithAnthropic(anthropicKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Generate Recap Summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

const ENHANCED_SYSTEM_PROMPT = `You are a helpful assistant that analyzes video call conversations and generates comprehensive meeting summaries. Return a JSON object with the following structure:

{
  "summary": "A brief 2-3 sentence overview of the call highlighting the main purpose and outcome",
  "sentiment": {
    "overall": "A 2-3 word description of the meeting vibe (e.g., 'Energizing & Inspiring', 'Productive & Focused', 'Warm & Supportive')",
    "emoji": "A single emoji that represents the vibe",
    "highlights": ["3 short highlight tags like 'Great energy', 'Actionable advice', 'Deep connection'"]
  },
  "keyTakeaways": [
    { "emoji": "💡", "text": "Key insight or learning from the conversation" },
    { "emoji": "🎯", "text": "Another important takeaway" }
  ],
  "topicsDiscussed": [
    { "topic": "Topic name", "mentions": 5 },
    { "topic": "Another topic", "mentions": 3 }
  ],
  "memorableQuotes": [
    { "quote": "An impactful or memorable statement from the conversation", "author": "Speaker Name" }
  ],
  "actionItems": [
    { "text": "Specific action item or follow-up task mentioned", "done": false }
  ],
  "suggestedFollowUps": [
    { "personName": "Name", "reason": "Why you should follow up", "suggestedTopic": "What to discuss" }
  ]
}

Guidelines:
- summary: 2-3 sentences, professional but warm tone
- sentiment: Capture the emotional tone and energy of the meeting
- keyTakeaways: 3-5 items, each with a relevant emoji (💡🎯⚡🤝💪🌟✨🔥)
- topicsDiscussed: 3-6 main topics with estimated mention frequency
- memorableQuotes: 1-3 impactful quotes if present (skip if none stand out)
- actionItems: 2-5 concrete next steps or tasks mentioned
- suggestedFollowUps: 1-3 suggested follow-up conversations based on shared interests

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
        console.error('Failed to parse Anthropic JSON response:', parseError);
        return generateSimpleSummary(null, null, participants, duration, meetingTitle);
      }
    }
  } catch (e) {
    console.error('Anthropic error:', e);
  }

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

  // Build summary
  let summary = '';
  if (duration > 0) {
    summary = `You had a ${duration} minute video call`;
    if (participantList.length > 0) {
      summary += ` with ${participantList.join(', ')}`;
    }
    summary += '.';
  } else {
    summary = participantList.length > 0
      ? `You connected with ${participantList.join(', ')}.`
      : 'A video call session.';
  }

  // Detect topics and sentiment from content
  const topicsDiscussed = [];
  const keyTakeaways = [];
  const actionItems = [];
  let sentiment = { overall: 'Productive', emoji: '✨', highlights: ['Connection made'] };

  const allText = transcript?.map(t => t.text).join(' ').toLowerCase() ||
                  messages?.map(m => m.message || m.text || '').join(' ').toLowerCase() || '';

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

  if (topicsDiscussed.length === 0) {
    topicsDiscussed.push({ topic: 'General conversation', mentions: 1 });
  }

  // Sort by mentions
  topicsDiscussed.sort((a, b) => b.mentions - a.mentions);

  // Sentiment detection
  const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excited', 'happy', 'wonderful'];
  const actionWords = ['thanks', 'follow up', 'schedule', 'send', 'share', 'help'];

  const positiveCount = positiveWords.filter(w => allText.includes(w)).length;
  if (positiveCount >= 3) {
    sentiment = { overall: 'Energizing & Inspiring', emoji: '🔥', highlights: ['Great energy', 'Positive vibes', 'Authentic connection'] };
  } else if (positiveCount >= 1) {
    sentiment = { overall: 'Warm & Supportive', emoji: '🤝', highlights: ['Good conversation', 'Mutual support'] };
  }

  // Key takeaways
  if (allText.includes('learn') || allText.includes('insight')) {
    keyTakeaways.push({ emoji: '💡', text: 'New insights shared' });
  }
  if (allText.includes('connect') || allText.includes('network')) {
    keyTakeaways.push({ emoji: '🤝', text: 'Valuable networking opportunity' });
  }
  if (allText.includes('help') || allText.includes('support')) {
    keyTakeaways.push({ emoji: '💪', text: 'Mutual support offered' });
  }
  if (keyTakeaways.length === 0) {
    keyTakeaways.push({ emoji: '✨', text: 'Meaningful connection made' });
  }

  // Action items
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
