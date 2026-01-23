import { NextResponse } from 'next/server';

/**
 * Generate AI summary for call recap
 *
 * POST /api/generate-recap-summary
 * Body: { transcript, messages, participants, duration }
 *
 * Returns structured recap:
 * - summary: Brief overview of the call
 * - topicsDiscussed: Array of topics discussed
 * - keyTakeaways: Array of key insights/takeaways
 */
export async function POST(request) {
  try {
    const { transcript, messages, participants, duration } = await request.json();

    // Check if we have content to summarize
    if ((!transcript || transcript.length === 0) && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: 'No content to summarize' },
        { status: 400 }
      );
    }

    // Helper to get display name
    const getDisplayName = (p) => {
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
      .filter(Boolean)
      .join(', ') || 'the participants';

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

    let result = {
      summary: '',
      topicsDiscussed: [],
      keyTakeaways: []
    };

    if (openaiKey) {
      // Use OpenAI
      result = await generateWithOpenAI(openaiKey, contentToSummarize, participantNames, durationMinutes);
    } else if (anthropicKey) {
      // Use Anthropic Claude
      result = await generateWithAnthropic(anthropicKey, contentToSummarize, participantNames, durationMinutes);
    } else {
      // Generate simple summary without AI
      result = generateSimpleSummary(transcript, messages, participantNames, durationMinutes);
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

/**
 * Generate structured summary using OpenAI
 */
async function generateWithOpenAI(apiKey, content, participants, duration) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that analyzes video call conversations. Return a JSON object with the following structure:
{
  "summary": "A brief 1-2 sentence overview of the call",
  "topicsDiscussed": ["topic 1", "topic 2", ...],
  "keyTakeaways": ["takeaway 1", "takeaway 2", ...]
}

Guidelines:
- summary: Brief, professional overview (1-2 sentences)
- topicsDiscussed: 2-5 main topics or themes discussed (short phrases)
- keyTakeaways: 2-4 key insights, action items, or memorable moments from the call

Return ONLY valid JSON, no additional text.`
          },
          {
            role: 'user',
            content: `Analyze this ${duration} minute call with ${participants}:\n\n${content}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.choices[0]?.message?.content;

      try {
        const parsed = JSON.parse(responseText);
        return {
          summary: parsed.summary || '',
          topicsDiscussed: Array.isArray(parsed.topicsDiscussed) ? parsed.topicsDiscussed : [],
          keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : []
        };
      } catch (parseError) {
        console.error('Failed to parse OpenAI JSON response:', parseError);
        // Fall back to using the response as summary
        return {
          summary: responseText || '',
          topicsDiscussed: [],
          keyTakeaways: []
        };
      }
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }

  return generateSimpleSummary(null, null, participants, duration);
}

/**
 * Generate structured summary using Anthropic Claude
 */
async function generateWithAnthropic(apiKey, content, participants, duration) {
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
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze this ${duration} minute video call with ${participants}. Return a JSON object with the following structure:
{
  "summary": "A brief 1-2 sentence overview of the call",
  "topicsDiscussed": ["topic 1", "topic 2", ...],
  "keyTakeaways": ["takeaway 1", "takeaway 2", ...]
}

Guidelines:
- summary: Brief, professional overview (1-2 sentences)
- topicsDiscussed: 2-5 main topics or themes discussed (short phrases)
- keyTakeaways: 2-4 key insights, action items, or memorable moments from the call

Return ONLY valid JSON, no additional text.

Call content:
${content}`
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.content[0]?.text;

      try {
        const parsed = JSON.parse(responseText);
        return {
          summary: parsed.summary || '',
          topicsDiscussed: Array.isArray(parsed.topicsDiscussed) ? parsed.topicsDiscussed : [],
          keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : []
        };
      } catch (parseError) {
        console.error('Failed to parse Anthropic JSON response:', parseError);
        // Fall back to using the response as summary
        return {
          summary: responseText || '',
          topicsDiscussed: [],
          keyTakeaways: []
        };
      }
    }
  } catch (e) {
    console.error('Anthropic error:', e);
  }

  return generateSimpleSummary(null, null, participants, duration);
}

/**
 * Generate a simple structured summary without AI
 */
function generateSimpleSummary(transcript, messages, participants, duration) {
  const transcriptCount = transcript?.length || 0;
  const messageCount = messages?.length || 0;

  // Build a more engaging summary
  let summary = '';
  const topicsDiscussed = [];
  const keyTakeaways = [];

  if (duration > 0) {
    summary = `You had a ${duration} minute video call`;
    if (participants && participants !== 'the participants') {
      summary += ` with ${participants}`;
    }
    summary += '.';
  } else {
    summary = participants && participants !== 'the participants'
      ? `You connected with ${participants}.`
      : 'A video call session.';
  }

  if (transcriptCount > 0) {
    // Extract unique speakers
    const speakers = [...new Set(transcript.map(t => t.speakerName).filter(Boolean))];
    if (speakers.length > 0) {
      summary += ` The conversation included ${speakers.length} active speaker${speakers.length > 1 ? 's' : ''}.`;
      keyTakeaways.push(`Active conversation with ${speakers.length} participant${speakers.length > 1 ? 's' : ''}`);
    }

    // Try to identify topics from keywords
    const allText = transcript.map(t => t.text).join(' ').toLowerCase();

    // Topic detection with more categories
    if (allText.includes('project') || allText.includes('work') || allText.includes('team')) {
      topicsDiscussed.push('Work & Projects');
    }
    if (allText.includes('idea') || allText.includes('think') || allText.includes('suggest') || allText.includes('plan')) {
      topicsDiscussed.push('Ideas & Planning');
    }
    if (allText.includes('question') || allText.includes('help') || allText.includes('how') || allText.includes('what')) {
      topicsDiscussed.push('Q&A Discussion');
    }
    if (allText.includes('coffee') || allText.includes('meet') || allText.includes('connect') || allText.includes('network')) {
      topicsDiscussed.push('Networking');
    }
    if (allText.includes('learn') || allText.includes('study') || allText.includes('course') || allText.includes('skill')) {
      topicsDiscussed.push('Learning & Growth');
    }
    if (allText.includes('business') || allText.includes('startup') || allText.includes('company') || allText.includes('entrepreneur')) {
      topicsDiscussed.push('Business & Startups');
    }
    if (allText.includes('tech') || allText.includes('software') || allText.includes('code') || allText.includes('developer')) {
      topicsDiscussed.push('Technology');
    }
    if (allText.includes('career') || allText.includes('job') || allText.includes('hire') || allText.includes('interview')) {
      topicsDiscussed.push('Career Development');
    }

    // Generate key takeaways from content
    if (allText.includes('thanks') || allText.includes('thank') || allText.includes('appreciate')) {
      keyTakeaways.push('Mutual appreciation shared');
    }
    if (allText.includes('follow up') || allText.includes('next time') || allText.includes('schedule')) {
      keyTakeaways.push('Follow-up planned');
    }
    if (allText.includes('great') || allText.includes('awesome') || allText.includes('love')) {
      keyTakeaways.push('Positive interaction');
    }
    if (allText.includes('share') || allText.includes('send') || allText.includes('link')) {
      keyTakeaways.push('Resources shared');
    }
  } else if (messageCount > 0) {
    summary += ` You exchanged ${messageCount} chat message${messageCount > 1 ? 's' : ''} during the call.`;

    // Try to extract topics from messages
    const allMessages = messages?.map(m => m.message || m.text || '').join(' ').toLowerCase() || '';

    if (allMessages.includes('nice') || allMessages.includes('great') || allMessages.includes('good')) {
      topicsDiscussed.push('General conversation');
      keyTakeaways.push('Positive exchange');
    }
    if (allMessages.includes('help') || allMessages.includes('question')) {
      topicsDiscussed.push('Helpful discussion');
    }
    if (allMessages.includes('thanks') || allMessages.includes('thank')) {
      keyTakeaways.push('Gratitude expressed');
    }
  }

  // Ensure we have at least one topic if we had a conversation
  if (topicsDiscussed.length === 0 && (transcriptCount > 0 || messageCount > 0)) {
    topicsDiscussed.push('General conversation');
  }

  // Add a general takeaway if none detected
  if (keyTakeaways.length === 0 && (transcriptCount > 0 || messageCount > 0)) {
    keyTakeaways.push('Connection made');
  }

  return {
    summary,
    topicsDiscussed,
    keyTakeaways
  };
}
