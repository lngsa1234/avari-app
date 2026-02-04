/**
 * Circle AI Agent Helper Functions
 *
 * Utilities for agent execution logging, cost tracking, and common operations
 */

/**
 * Log agent execution for cost tracking and analytics
 */
export async function logAgentExecution(supabase, skill, tier, tokens = {}) {
  const costs = {
    rule: 0,
    light_ai: 0.0003,  // ~$0.25/1M tokens for Haiku
    full_ai: 0.003     // ~$3/1M tokens for Sonnet
  };

  const inputTokens = tokens.input || 500;
  const outputTokens = tokens.output || 200;
  const estimatedCost = costs[tier] * (inputTokens + outputTokens) / 1000;

  try {
    await supabase.from('agent_executions').insert({
      skill,
      tier,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimatedCost,
      duration_ms: tokens.duration || null
    });
  } catch (e) {
    console.error('[AgentHelpers] Failed to log execution:', e);
  }
}

/**
 * Get agent cost summary for a period
 */
export async function getAgentCostSummary(supabase, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('agent_executions')
    .select('skill, tier, cost_usd')
    .gte('executed_at', since);

  if (error) {
    console.error('[AgentHelpers] Failed to get cost summary:', error);
    return { total_cost: 0, by_skill: {}, by_tier: {}, executions: 0 };
  }

  const summary = {
    total_cost: 0,
    by_skill: {},
    by_tier: {},
    executions: data?.length || 0
  };

  for (const exec of (data || [])) {
    const cost = parseFloat(exec.cost_usd) || 0;
    summary.total_cost += cost;
    summary.by_skill[exec.skill] = (summary.by_skill[exec.skill] || 0) + cost;
    summary.by_tier[exec.tier] = (summary.by_tier[exec.tier] || 0) + cost;
  }

  // Round to 4 decimal places
  summary.total_cost = Math.round(summary.total_cost * 10000) / 10000;
  for (const key in summary.by_skill) {
    summary.by_skill[key] = Math.round(summary.by_skill[key] * 10000) / 10000;
  }
  for (const key in summary.by_tier) {
    summary.by_tier[key] = Math.round(summary.by_tier[key] * 10000) / 10000;
  }

  return summary;
}

/**
 * Call Anthropic Claude API (Haiku for cost efficiency)
 */
export async function callClaudeHaiku(prompt, maxTokens = 500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

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
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        text: data.content[0]?.text || '',
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      };
    }
  } catch (e) {
    console.error('[AgentHelpers] Claude API error:', e);
  }

  return null;
}

/**
 * Call OpenAI API (GPT-4o-mini for cost efficiency)
 */
export async function callOpenAIMini(prompt, maxTokens = 500) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        text: data.choices[0]?.message?.content || '',
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      };
    }
  } catch (e) {
    console.error('[AgentHelpers] OpenAI API error:', e);
  }

  return null;
}

/**
 * Call AI with fallback (tries Anthropic first, then OpenAI)
 */
export async function callAI(prompt, maxTokens = 500) {
  // Try Anthropic first (often cheaper)
  let result = await callClaudeHaiku(prompt, maxTokens);
  if (result) return { ...result, provider: 'anthropic' };

  // Fallback to OpenAI
  result = await callOpenAIMini(prompt, maxTokens);
  if (result) return { ...result, provider: 'openai' };

  return null;
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseJSONFromAI(text) {
  if (!text) return null;

  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to next attempt
      }
    }

    // Try finding JSON array or object
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Continue
      }
    }

    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Calculate interest overlap between two arrays
 */
export function calculateInterestOverlap(interests1, interests2) {
  if (!interests1?.length || !interests2?.length) return { overlap: [], score: 0 };

  const set1 = new Set((interests1 || []).map(i => i.toLowerCase()));
  const set2 = new Set((interests2 || []).map(i => i.toLowerCase()));

  const overlap = [...set1].filter(i => set2.has(i));
  const maxPossible = Math.min(set1.size, set2.size);
  const score = maxPossible > 0 ? overlap.length / maxPossible : 0;

  return { overlap, score };
}

/**
 * Check if user should receive a nudge (rate limiting)
 */
export async function canSendNudge(supabase, userId, minDaysBetween = 3) {
  const { data } = await supabase
    .from('user_nudges')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return true;

  const daysSinceLastNudge = (Date.now() - new Date(data.created_at)) / (1000 * 60 * 60 * 24);
  return daysSinceLastNudge >= minDaysBetween;
}
