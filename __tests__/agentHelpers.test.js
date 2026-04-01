/**
 * Tests for lib/agentHelpers.js — AI agent utilities.
 */

const mockInsert = jest.fn().mockResolvedValue({ error: null })
const mockSelect = jest.fn()
const mockSupabase = {
  from: jest.fn(() => ({
    insert: mockInsert,
    select: jest.fn().mockReturnValue({
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  })),
}

// Mock fetch for AI API calls
const mockFetch = jest.fn()
global.fetch = mockFetch

const {
  logAgentExecution,
  getAgentCostSummary,
  callClaudeHaiku,
  callOpenAIMini,
  callAI,
  parseJSONFromAI,
  calculateInterestOverlap,
  canSendNudge,
} = require('@/lib/agentHelpers')

describe('parseJSONFromAI (pure function)', () => {
  test('returns null for empty input', () => {
    expect(parseJSONFromAI(null)).toBeNull()
    expect(parseJSONFromAI('')).toBeNull()
    expect(parseJSONFromAI(undefined)).toBeNull()
  })

  test('parses direct JSON', () => {
    expect(parseJSONFromAI('{"key": "value"}')).toEqual({ key: 'value' })
    expect(parseJSONFromAI('[1, 2, 3]')).toEqual([1, 2, 3])
  })

  test('extracts JSON from markdown code block', () => {
    const input = 'Here is the result:\n```json\n{"name": "test"}\n```'
    expect(parseJSONFromAI(input)).toEqual({ name: 'test' })
  })

  test('extracts JSON from code block without language tag', () => {
    const input = '```\n{"x": 1}\n```'
    expect(parseJSONFromAI(input)).toEqual({ x: 1 })
  })

  test('extracts JSON array from mixed text', () => {
    const input = 'The results are: [1, 2, 3] and more text'
    expect(parseJSONFromAI(input)).toEqual([1, 2, 3])
  })

  test('extracts JSON object from mixed text', () => {
    const input = 'Result: {"a": 1} end'
    expect(parseJSONFromAI(input)).toEqual({ a: 1 })
  })

  test('returns null for completely invalid text', () => {
    expect(parseJSONFromAI('no json here at all')).toBeNull()
  })

  test('handles invalid JSON in code block gracefully', () => {
    const input = '```json\n{broken json}\n```'
    // Falls through code block extraction to object match, also fails
    expect(parseJSONFromAI(input)).toBeNull()
  })
})

describe('calculateInterestOverlap (pure function)', () => {
  test('returns empty for null/empty inputs', () => {
    expect(calculateInterestOverlap(null, ['a'])).toEqual({ overlap: [], score: 0 })
    expect(calculateInterestOverlap(['a'], null)).toEqual({ overlap: [], score: 0 })
    expect(calculateInterestOverlap([], ['a'])).toEqual({ overlap: [], score: 0 })
  })

  test('finds overlapping interests (case-insensitive)', () => {
    const result = calculateInterestOverlap(['Tech', 'Design'], ['tech', 'Marketing'])
    expect(result.overlap).toEqual(['tech'])
    expect(result.score).toBe(0.5) // 1 overlap out of min(2, 2)
  })

  test('returns score 1 for identical sets', () => {
    const result = calculateInterestOverlap(['a', 'b'], ['a', 'b'])
    expect(result.score).toBe(1)
    expect(result.overlap).toHaveLength(2)
  })

  test('returns score 0 for no overlap', () => {
    const result = calculateInterestOverlap(['a'], ['b'])
    expect(result.score).toBe(0)
    expect(result.overlap).toHaveLength(0)
  })
})

describe('logAgentExecution', () => {
  beforeEach(() => mockInsert.mockClear())

  test('inserts execution record with cost calculation', async () => {
    const sb = { from: jest.fn(() => ({ insert: mockInsert })) }
    await logAgentExecution(sb, 'nudges', 'light_ai', { input: 100, output: 50 })

    expect(sb.from).toHaveBeenCalledWith('agent_executions')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      skill: 'nudges',
      tier: 'light_ai',
      input_tokens: 100,
      output_tokens: 50,
    }))
  })

  test('uses default tokens when not provided', async () => {
    const sb = { from: jest.fn(() => ({ insert: mockInsert })) }
    await logAgentExecution(sb, 'test', 'rule')

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      input_tokens: 500,
      output_tokens: 200,
    }))
  })

  test('does not throw on insert error', async () => {
    const sb = { from: jest.fn(() => ({ insert: jest.fn().mockRejectedValue(new Error('fail')) })) }
    await expect(logAgentExecution(sb, 'test', 'rule')).resolves.not.toThrow()
  })
})

describe('getAgentCostSummary', () => {
  test('returns empty summary when no data', async () => {
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })),
    }

    const result = await getAgentCostSummary(sb, 30)
    expect(result.total_cost).toBe(0)
    expect(result.executions).toBe(0)
  })

  test('aggregates costs by skill and tier', async () => {
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [
              { skill: 'nudges', tier: 'light_ai', cost_usd: '0.001' },
              { skill: 'nudges', tier: 'light_ai', cost_usd: '0.002' },
              { skill: 'recs', tier: 'full_ai', cost_usd: '0.01' },
            ],
            error: null,
          }),
        }),
      })),
    }

    const result = await getAgentCostSummary(sb)
    expect(result.executions).toBe(3)
    expect(result.total_cost).toBe(0.013)
    expect(result.by_skill.nudges).toBe(0.003)
    expect(result.by_skill.recs).toBe(0.01)
    expect(result.by_tier.light_ai).toBe(0.003)
    expect(result.by_tier.full_ai).toBe(0.01)
  })

  test('returns empty summary on error', async () => {
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
        }),
      })),
    }

    const result = await getAgentCostSummary(sb)
    expect(result.total_cost).toBe(0)
    expect(result.executions).toBe(0)
  })
})

describe('callClaudeHaiku', () => {
  beforeEach(() => mockFetch.mockReset())

  test('returns null when no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await callClaudeHaiku('test prompt')
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('calls Anthropic API and returns parsed response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    })

    const result = await callClaudeHaiku('test prompt')
    expect(result.text).toBe('Hello!')
    expect(result.inputTokens).toBe(10)
    expect(result.outputTokens).toBe(5)
  })

  test('returns null on API error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockFetch.mockResolvedValue({ ok: false })

    const result = await callClaudeHaiku('test')
    expect(result).toBeNull()
  })

  test('returns null on fetch exception', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockFetch.mockRejectedValue(new Error('network'))

    const result = await callClaudeHaiku('test')
    expect(result).toBeNull()
  })
})

describe('callOpenAIMini', () => {
  beforeEach(() => mockFetch.mockReset())

  test('returns null when no API key', async () => {
    delete process.env.OPENAI_API_KEY
    const result = await callOpenAIMini('test')
    expect(result).toBeNull()
  })

  test('calls OpenAI API and returns parsed response', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hi!' } }],
        usage: { prompt_tokens: 8, completion_tokens: 3 },
      }),
    })

    const result = await callOpenAIMini('test')
    expect(result.text).toBe('Hi!')
    expect(result.inputTokens).toBe(8)
  })

  test('returns null on fetch exception', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockFetch.mockRejectedValue(new Error('network'))
    expect(await callOpenAIMini('test')).toBeNull()
  })
})

describe('callAI', () => {
  beforeEach(() => mockFetch.mockReset())

  test('uses Anthropic when available, adds provider field', async () => {
    process.env.ANTHROPIC_API_KEY = 'key'
    delete process.env.OPENAI_API_KEY
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'response' }], usage: {} }),
    })

    const result = await callAI('test')
    expect(result.provider).toBe('anthropic')
  })

  test('falls back to OpenAI when Anthropic fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'key'
    process.env.OPENAI_API_KEY = 'key'
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // Anthropic fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'fallback' } }], usage: {} }),
      })

    const result = await callAI('test')
    expect(result.provider).toBe('openai')
  })

  test('returns null when both fail', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    expect(await callAI('test')).toBeNull()
  })
})

describe('canSendNudge', () => {
  test('returns true when no previous nudge', async () => {
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      })),
    }

    expect(await canSendNudge(sb, 'user-1')).toBe(true)
  })

  test('returns false when nudge was sent recently', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { created_at: recentDate } }),
              }),
            }),
          }),
        }),
      })),
    }

    expect(await canSendNudge(sb, 'user-1', 3)).toBe(false)
  })

  test('returns true when enough days have passed', async () => {
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    const sb = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { created_at: oldDate } }),
              }),
            }),
          }),
        }),
      })),
    }

    expect(await canSendNudge(sb, 'user-1', 3)).toBe(true)
  })
})
