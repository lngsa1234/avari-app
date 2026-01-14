import { NextResponse } from 'next/server';

/**
 * Generate AI summary for call recap
 *
 * POST /api/generate-recap-summary
 * Body: { transcript, messages, participants, duration }
 *
 * This endpoint can be extended to use OpenAI, Anthropic, or other LLM providers
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

    // Build context for summary
    const participantNames = participants
      ?.map(p => p.name || p.email || 'Unknown')
      .filter(Boolean)
      .join(', ') || 'Unknown participants';

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

    let summary = '';

    if (openaiKey) {
      // Use OpenAI
      summary = await generateWithOpenAI(openaiKey, contentToSummarize, participantNames, durationMinutes);
    } else if (anthropicKey) {
      // Use Anthropic Claude
      summary = await generateWithAnthropic(anthropicKey, contentToSummarize, participantNames, durationMinutes);
    } else {
      // Generate simple summary without AI
      summary = generateSimpleSummary(transcript, messages, participantNames, durationMinutes);
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[Generate Recap Summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}

/**
 * Generate summary using OpenAI
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
            content: 'You are a helpful assistant that summarizes video call conversations. Create a brief, professional summary highlighting key topics discussed and any action items mentioned. Keep the summary concise (2-3 sentences).'
          },
          {
            role: 'user',
            content: `Summarize this ${duration} minute call with ${participants}:\n\n${content}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || generateSimpleSummary(null, null, participants, duration);
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }

  return generateSimpleSummary(null, null, participants, duration);
}

/**
 * Generate summary using Anthropic Claude
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
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Summarize this ${duration} minute video call with ${participants} in 2-3 sentences, highlighting key topics and any action items:\n\n${content}`
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.content[0]?.text || generateSimpleSummary(null, null, participants, duration);
    }
  } catch (e) {
    console.error('Anthropic error:', e);
  }

  return generateSimpleSummary(null, null, participants, duration);
}

/**
 * Generate a simple summary without AI
 */
function generateSimpleSummary(transcript, messages, participants, duration) {
  const transcriptCount = transcript?.length || 0;
  const messageCount = messages?.length || 0;

  let summary = `A ${duration} minute call with ${participants}.`;

  if (transcriptCount > 0) {
    // Extract unique speakers
    const speakers = [...new Set(transcript.map(t => t.speakerName).filter(Boolean))];
    summary += ` ${speakers.length} participants spoke during the call.`;

    // Try to identify topics from keywords
    const allText = transcript.map(t => t.text).join(' ').toLowerCase();
    const topics = [];

    if (allText.includes('project') || allText.includes('work')) topics.push('work projects');
    if (allText.includes('meeting') || allText.includes('schedule')) topics.push('scheduling');
    if (allText.includes('idea') || allText.includes('think')) topics.push('brainstorming');
    if (allText.includes('question') || allText.includes('help')) topics.push('Q&A');

    if (topics.length > 0) {
      summary += ` Topics included: ${topics.join(', ')}.`;
    }
  } else if (messageCount > 0) {
    summary += ` ${messageCount} chat messages were exchanged during the call.`;
  }

  return summary;
}
