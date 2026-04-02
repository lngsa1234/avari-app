/**
 * Tests for lib/callRecapHelpers.js — call recap CRUD operations.
 *
 * @jest-environment node
 */

const mockAuth = {
  getUser: jest.fn(),
  getSession: jest.fn(),
  refreshSession: jest.fn(),
}
const mockChain = {}
const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'gte', 'order', 'limit', 'contains', 'filter']
methods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })
mockChain.single = jest.fn()
mockChain.maybeSingle = jest.fn()
mockChain.then = (resolve) => resolve({ data: [], error: null })

const mockFrom = jest.fn().mockReturnValue(mockChain)

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
    from: (...args) => mockFrom(...args),
  },
}))

const {
  getMyCallRecaps,
  getCallRecapByChannel,
  getProviderPerformanceSummary,
  updateRecapSummary,
  updateRecapSummaryByChannel,
} = require('@/lib/callRecapHelpers')

describe('getMyCallRecaps', () => {
  test('returns recaps for authenticated user', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const recaps = [{ id: 'r1', channel_name: 'ch-1' }]
    mockChain.then = (resolve) => resolve({ data: recaps, error: null })

    const result = await getMyCallRecaps(10)
    expect(result).toEqual(recaps)
    expect(mockFrom).toHaveBeenCalledWith('call_recaps')
  })

  test('returns empty when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await getMyCallRecaps()).toEqual([])
  })

  test('returns empty on error', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockChain.then = (resolve) => resolve({ data: null, error: { message: 'fail' } })
    expect(await getMyCallRecaps()).toEqual([])
  })
})

describe('getCallRecapByChannel', () => {
  test('returns recap for channel', async () => {
    const recap = { id: 'r1', channel_name: 'ch-1', ai_summary: 'summary' }
    mockChain.maybeSingle.mockResolvedValue({ data: recap, error: null })

    const result = await getCallRecapByChannel('ch-1')
    expect(result).toEqual(recap)
    expect(mockFrom).toHaveBeenCalledWith('call_recaps')
  })

  test('returns null when not found', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getCallRecapByChannel('nonexistent')
    expect(result).toBeNull()
  })

  test('returns null on other errors', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'fail' } })

    const result = await getCallRecapByChannel('ch-1')
    expect(result).toBeNull()
  })
})

describe('getProviderPerformanceSummary', () => {
  test('returns summary data', async () => {
    const summary = [{ provider: 'agora', avg_quality: 4.5 }]
    mockChain.then = (resolve) => resolve({ data: summary, error: null })

    const result = await getProviderPerformanceSummary()
    expect(result).toEqual(summary)
    expect(mockFrom).toHaveBeenCalledWith('provider_performance_summary')
  })

  test('returns empty on error', async () => {
    mockChain.then = (resolve) => resolve({ data: null, error: { message: 'fail' } })
    expect(await getProviderPerformanceSummary()).toEqual([])
  })
})

describe('updateRecapSummary', () => {
  test('updates AI summary by recap ID', async () => {
    const updated = { id: 'r1', ai_summary: 'new summary' }
    mockChain.single.mockResolvedValue({ data: updated, error: null })

    const result = await updateRecapSummary('r1', 'new summary')
    expect(result).toEqual(updated)
    expect(mockChain.update).toHaveBeenCalledWith({ ai_summary: 'new summary' })
  })

  test('throws on error', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(updateRecapSummary('r1', 'x')).rejects.toBeTruthy()
  })
})

describe('updateRecapSummaryByChannel', () => {
  test('updates AI summary by channel name', async () => {
    const updated = { id: 'r1', ai_summary: 'new' }
    mockChain.maybeSingle.mockResolvedValue({ data: updated, error: null })

    const result = await updateRecapSummaryByChannel('ch-1', 'new')
    expect(result).toEqual(updated)
  })

  test('returns null on error', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
    const result = await updateRecapSummaryByChannel('ch-1', 'x')
    expect(result).toBeNull()
  })
})
