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
    const { transcript, messages, participants, duration, meetingTitle, meetingType, existingCircles } = await request.json();

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
      // Clean, deduplicate, and merge transcript entries
      const cleaned = cleanTranscript(transcript);
      contentToSummarize = cleaned;
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
    console.log('[Generate Recap Summary] Content length:', contentToSummarize.length, 'chars. Transcript entries (raw):', transcript?.length, 'Messages:', messages?.length);
    if (contentToSummarize.length > 200) {
      console.log('[Generate Recap Summary] Content preview:', contentToSummarize.substring(0, 200), '...');
    }

    let result = generateSimpleSummary(transcript, messages, participantNames, durationMinutes, meetingTitle);

    if (openaiKey) {
      // Use OpenAI
      console.log('[Generate Recap Summary] Using OpenAI');
      const aiResult = await generateWithOpenAI(openaiKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType, existingCircles);
      if (aiResult) result = aiResult;
    } else if (anthropicKey) {
      // Use Anthropic Claude
      console.log('[Generate Recap Summary] Using Anthropic');
      const aiResult = await generateWithAnthropic(anthropicKey, contentToSummarize, participantNames, durationMinutes, meetingTitle, meetingType, existingCircles);
      if (aiResult) result = aiResult;
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

/**
 * Clean, deduplicate, and merge transcript entries into readable conversation text.
 * - Removes near-duplicate entries (from auto-finalize + final overlap)
 * - Merges consecutive entries from the same speaker
 * - Intelligently truncates very long transcripts (samples beginning, middle, end)
 */
function cleanTranscript(transcript) {
  if (!transcript || transcript.length === 0) return '';

  // Step 1: Sort by timestamp
  const sorted = [...transcript].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Step 2: Remove near-duplicate entries (auto-finalize creates overlapping entries)
  const deduped = [];
  for (const entry of sorted) {
    const text = (entry.text || '').trim();
    if (!text) continue;

    // Skip if this text is a substring of the previous entry or vice versa
    const prev = deduped[deduped.length - 1];
    if (prev) {
      const prevText = prev.text;
      if (prevText.includes(text)) continue; // Previous already contains this
      if (text.includes(prevText) && prev.speakerName === (entry.speakerName || 'Speaker')) {
        // This entry is a more complete version — replace previous
        deduped[deduped.length - 1] = { speakerName: entry.speakerName || 'Speaker', text };
        continue;
      }
    }
    deduped.push({ speakerName: entry.speakerName || 'Speaker', text });
  }

  // Step 3: Merge consecutive entries from the same speaker
  const merged = [];
  for (const entry of deduped) {
    const prev = merged[merged.length - 1];
    if (prev && prev.speakerName === entry.speakerName) {
      prev.text += ' ' + entry.text;
    } else {
      merged.push({ ...entry });
    }
  }

  // Step 4: Format as conversation
  const formatted = merged.map(e => `${e.speakerName}: ${e.text}`);

  // Step 5: Truncate if too long (target ~12,000 chars to stay well within context limits)
  const MAX_CHARS = 12000;
  const full = formatted.join('\n');
  if (full.length <= MAX_CHARS) return full;

  // Sample from beginning, middle, and end to preserve conversation arc
  const sectionSize = Math.floor(MAX_CHARS / 3);
  const beginning = [];
  const middle = [];
  const end = [];

  let charCount = 0;
  const midStart = Math.floor(formatted.length * 0.35);
  const endStart = Math.floor(formatted.length * 0.75);

  // Beginning section
  for (let i = 0; i < midStart && charCount < sectionSize; i++) {
    beginning.push(formatted[i]);
    charCount += formatted[i].length + 1;
  }

  // Middle section
  charCount = 0;
  for (let i = midStart; i < endStart && charCount < sectionSize; i++) {
    middle.push(formatted[i]);
    charCount += formatted[i].length + 1;
  }

  // End section
  charCount = 0;
  for (let i = endStart; i < formatted.length && charCount < sectionSize; i++) {
    end.push(formatted[i]);
    charCount += formatted[i].length + 1;
  }

  return [
    ...beginning,
    '\n[... earlier part of conversation ...]\n',
    ...middle,
    '\n[... later part of conversation ...]\n',
    ...end,
  ].join('\n');
}

/**
 * Robustly extract a JSON object from an LLM response.
 * Handles: raw JSON, markdown code blocks, preamble/postamble text, BOM characters.
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or non-string response');
  }

  // Strip BOM and trim
  let cleaned = text.replace(/^\uFEFF/, '').trim();

  // 1. Try direct parse first (ideal case)
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* continue */ }

  // 2. Try extracting from markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) { /* continue */ }
  }

  // 3. Try finding the first { ... } that contains "summary" (our expected key)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (_) { /* continue */ }
  }

  // 4. Last resort: try to fix common JSON issues (trailing commas, single quotes)
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let candidate = cleaned.substring(firstBrace, lastBrace + 1);
    // Remove trailing commas before } or ]
    candidate = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(candidate);
    } catch (_) { /* continue */ }
  }

  throw new Error('Could not extract valid JSON from response');
}

const ENHANCED_SYSTEM_PROMPT = `You are a helpful assistant that summarizes video call transcripts. The transcript may be in any language (English, Chinese, etc.) and may contain speech recognition errors — do your best to understand the intent.

RULES:
1. Summarize what was ACTUALLY discussed based on the transcript content
2. DO NOT fabricate topics or discussions not present in the transcript
3. Write the summary in the same language as the majority of the transcript
4. If the transcript is truly just greetings or test messages with no real content, say so briefly

Return a JSON object with this structure:

{
  "summary": "2-3 sentence summary of the conversation and key points discussed",
  "sentiment": {
    "overall": "Overall mood/vibe of the conversation",
    "emoji": "Single emoji representing the mood",
    "highlights": ["Notable moments or positive aspects"]
  },
  "keyTakeaways": [
    { "emoji": "💡", "text": "Key point or insight from the discussion" }
  ],
  "topicsDiscussed": [
    { "topic": "Topic name", "details": ["Discussed specific aspect of the topic", "Explored another angle or conclusion"] }
  ],
  "memorableQuotes": [
    { "quote": "Notable quote from transcript", "author": "Speaker Name" }
  ],
  "actionItems": [
    { "text": "Action item if any were mentioned", "assignee": "Person Name", "done": false }
  ],
  "suggestedFollowUps": [
    { "personName": "Person Name", "reason": "Why to follow up with them", "suggestedTopic": "Topic to discuss" }
  ],
  "suggestedCircles": []
}

Guidelines:
- summary: Provide a warm, natural summary of the conversation. Mention what was discussed and the general vibe.
- keyTakeaways: Extract actual insights or decisions from the conversation
- topicsDiscussed: List 3-5 topics with exactly 2 bullet-point descriptions each. Each detail should start with a past-tense verb (e.g. "Discussed...", "Explored...", "Identified...", "Shared...")
- actionItems: Only include if specific action items were mentioned. Assign each to the person responsible using their name from the transcript
- suggestedFollowUps: Suggest 1-3 participants to follow up with based on the conversation. Use the participant names provided. Include a reason and a specific topic to discuss next
- suggestedCircles: ONLY suggest when the conversation reveals a strong shared interest that would benefit from ongoing group discussion. Each entry should have: "type" ("join" for an existing circle, "create" for a new one), "name" (circle name), "reason" (why this is relevant based on the conversation), and for "create" type, "suggestedMembers" (participant names who showed interest). If existing circles are provided in the context, check if any are a strong match. Leave this array EMPTY if there is no compelling reason — do not force suggestions
- If transcript is minimal (just greetings), keep arrays short but still describe what happened

Return ONLY valid JSON, no additional text or markdown.`;

/**
 * Generate structured summary using OpenAI
 */
function buildUserPrompt(content, participants, duration, meetingTitle, meetingType, existingCircles) {
  let prompt = `Analyze this ${duration} minute ${meetingType || 'video call'}${meetingTitle ? ` titled "${meetingTitle}"` : ''} with ${participants.join(', ') || 'the participants'}.

Note: The transcript may be sampled from a longer conversation (beginning, middle, and end sections). Sections marked with "[...]" indicate omitted portions. Synthesize across all sections for a complete summary.`;

  if (existingCircles && existingCircles.length > 0) {
    prompt += `\n\nExisting circles on the platform (only suggest joining if strongly relevant to the conversation):\n${existingCircles.map(c => `- ${c.name}`).join('\n')}`;
  }

  prompt += `\n\nTranscript:\n${content}`;
  return prompt;
}

async function generateWithOpenAI(apiKey, content, participants, duration, meetingTitle, meetingType, existingCircles) {
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
            content: buildUserPrompt(content, participants, duration, meetingTitle, meetingType, existingCircles)
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.choices[0]?.message?.content;

      try {
        const parsed = extractJSON(responseText);
        return normalizeResponse(parsed, participants, duration, meetingTitle);
      } catch (parseError) {
        console.error('Failed to parse OpenAI JSON response:', parseError);
        return null;
      }
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }

  console.log('[OpenAI] Falling back to simple summary');
  return null;
}

/**
 * Generate structured summary using Anthropic Claude
 */
async function generateWithAnthropic(apiKey, content, participants, duration, meetingTitle, meetingType, existingCircles) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `${ENHANCED_SYSTEM_PROMPT}\n\n${buildUserPrompt(content, participants, duration, meetingTitle, meetingType, existingCircles)}`
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.content[0]?.text;
      console.log('[Anthropic] Response received, length:', responseText?.length);

      try {
        const parsed = extractJSON(responseText);
        console.log('[Anthropic] Parsed successfully, summary:', parsed.summary?.substring(0, 80));
        return normalizeResponse(parsed, participants, duration, meetingTitle);
      } catch (parseError) {
        console.error('[Anthropic] Failed to parse JSON response:', parseError, 'Raw:', responseText?.substring(0, 300));
        return null;
      }
    } else {
      const errBody = await response.text();
      console.error('[Anthropic] API error:', response.status, errBody.substring(0, 300));
    }
  } catch (e) {
    console.error('[Anthropic] Fetch error:', e);
  }

  console.log('[Anthropic] Falling back to simple summary');
  return null;
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
          details: Array.isArray(t.details) ? t.details.slice(0, 2) : [],
          mentions: t.mentions || 1
        }))
      : [{ topic: 'General conversation', details: [], mentions: 1 }],
    memorableQuotes: Array.isArray(parsed.memorableQuotes) ? parsed.memorableQuotes : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(a => ({
          text: typeof a === 'string' ? a : (a.text || ''),
          assignee: a.assignee || '',
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
        })),
    suggestedCircles: Array.isArray(parsed.suggestedCircles)
      ? parsed.suggestedCircles.map(c => ({
          type: c.type || 'join',
          name: c.name || '',
          reason: c.reason || '',
          suggestedMembers: Array.isArray(c.suggestedMembers) ? c.suggestedMembers : []
        })).filter(c => c.name)
      : []
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
      topicsDiscussed.push({ topic, details: [], mentions: mentions * 2 });
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
