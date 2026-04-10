/**
 * Tests for lib/callRecapHelpers.js — call recap CRUD operations.
 * Updated for storage-based transcript + AI summary.
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

// Storage mocks
const mockDownload = jest.fn()
const mockUpload = jest.fn()
const mockStorageFrom = jest.fn().mockReturnValue({
  download: mockDownload,
  upload: mockUpload,
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
    from: (...args) => mockFrom(...args),
    storage: { from: (...args) => mockStorageFrom(...args) },
  },
}))

const {
  getMyCallRecaps,
  getCallRecapByChannel,
  getRecapTranscriptFromStorage,
  getProviderPerformanceSummary,
  updateRecapSummary,
  updateRecapSummaryByChannel,
} = require('@/lib/callRecapHelpers')

beforeEach(() => {
  jest.clearAllMocks()
  // Reset chain mock defaults
  methods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })
  mockChain.single = jest.fn()
  mockChain.maybeSingle = jest.fn()
  mockChain.then = (resolve) => resolve({ data: [], error: null })
  mockFrom.mockReturnValue(mockChain)
})

// ─── getMyCallRecaps ────────────────────────────────────────────────

describe('getMyCallRecaps', () => {
  test('returns recaps for authenticated user', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const recaps = [{ id: 'r1', channel_name: 'ch-1' }]
    mockChain.then = (resolve) => resolve({ data: recaps, error: null })

    const result = await getMyCallRecaps(10)
    expect(result).toEqual(recaps)
    expect(mockFrom).toHaveBeenCalledWith('call_recaps')
  })

  test('does not fetch transcript or ai_summary columns', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockChain.then = (resolve) => resolve({ data: [], error: null })

    await getMyCallRecaps()
    // select() should be called with specific columns, not '*'
    const selectArg = mockChain.select.mock.calls[0]?.[0] || ''
    expect(selectArg).not.toBe('*')
    expect(selectArg).not.toContain('transcript,')
    expect(selectArg).not.toContain('ai_summary')
    expect(selectArg).toContain('transcript_path')
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

// ─── getCallRecapByChannel ──────────────────────────────────────────

describe('getCallRecapByChannel', () => {
  test('returns recap for channel', async () => {
    const recap = { id: 'r1', channel_name: 'ch-1', transcript_path: 'recaps/ch-1.json' }
    mockChain.maybeSingle.mockResolvedValue({ data: recap, error: null })

    const result = await getCallRecapByChannel('ch-1')
    expect(result).toEqual(recap)
    expect(mockFrom).toHaveBeenCalledWith('call_recaps')
  })

  test('does not fetch transcript or ai_summary columns', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    await getCallRecapByChannel('ch-1')
    const selectArg = mockChain.select.mock.calls[0]?.[0] || ''
    expect(selectArg).not.toBe('*')
    expect(selectArg).not.toContain('ai_summary')
    expect(selectArg).toContain('transcript_path')
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

// ─── getRecapTranscriptFromStorage ──────────────────────────────────

// Mock apiFetch for transcript storage tests (now uses server API instead of direct storage)
const mockApiFetch = jest.fn()
jest.mock('@/lib/apiFetch', () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}))

describe('getRecapTranscriptFromStorage', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })

  test('returns empty defaults when no transcriptPath', async () => {
    const result = await getRecapTranscriptFromStorage(null)
    expect(result).toEqual({ transcript: [], aiSummary: null })
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  test('returns empty defaults for undefined path', async () => {
    const result = await getRecapTranscriptFromStorage(undefined)
    expect(result).toEqual({ transcript: [], aiSummary: null })
  })

  test('fetches transcript via server API', async () => {
    const stored = {
      transcript: [
        { speakerId: 'u1', speakerName: 'Alice', text: 'Hello', timestamp: 1000 },
        { speakerId: 'u2', speakerName: 'Bob', text: 'Hi', timestamp: 2000 },
      ],
      aiSummary: '{"summary": "A brief chat"}',
    }
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(stored),
    })

    const result = await getRecapTranscriptFromStorage('recaps/ch-1.json')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/get-recap-transcript?path=recaps%2Fch-1.json')
    expect(result.transcript).toHaveLength(2)
    expect(result.transcript[0].text).toBe('Hello')
    expect(result.aiSummary).toBe('{"summary": "A brief chat"}')
  })

  test('handles missing transcript field gracefully', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ aiSummary: 'summary' }),
    })

    const result = await getRecapTranscriptFromStorage('recaps/ch-1.json')
    expect(result.transcript).toEqual([])
    expect(result.aiSummary).toBe('summary')
  })

  test('handles missing aiSummary field gracefully', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transcript: [{ text: 'hi' }] }),
    })

    const result = await getRecapTranscriptFromStorage('recaps/ch-1.json')
    expect(result.transcript).toEqual([{ text: 'hi' }])
    expect(result.aiSummary).toBeNull()
  })

  test('returns empty defaults on API error', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    const result = await getRecapTranscriptFromStorage('recaps/missing.json')
    expect(result).toEqual({ transcript: [], aiSummary: null })
  })

  test('returns empty defaults on network error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    const result = await getRecapTranscriptFromStorage('recaps/bad.json')
    expect(result).toEqual({ transcript: [], aiSummary: null })
  })
})

// ─── updateRecapSummary ─────────────────────────────────────────────

describe('updateRecapSummary', () => {
  test('fetches recap metadata then updates summary in storage', async () => {
    const recap = { id: 'r1', transcript_path: 'recaps/ch-1.json', channel_name: 'ch-1' }
    mockChain.single.mockResolvedValue({ data: recap, error: null })

    // Existing storage file
    mockDownload.mockResolvedValue({
      data: { text: () => Promise.resolve(JSON.stringify({ transcript: [{ text: 'hi' }], aiSummary: null })) },
      error: null,
    })
    mockUpload.mockResolvedValue({ error: null })

    const result = await updateRecapSummary('r1', 'new summary')
    expect(result).toEqual(recap)
    expect(mockStorageFrom).toHaveBeenCalledWith('call-transcripts')
    expect(mockUpload).toHaveBeenCalled()

    // Verify the uploaded content includes the new summary
    const uploadArgs = mockUpload.mock.calls[0]
    const uploadedContent = JSON.parse(uploadArgs[1])
    expect(uploadedContent.aiSummary).toBe('new summary')
    expect(uploadedContent.transcript).toEqual([{ text: 'hi' }])
  })

  test('uses channel_name fallback when transcript_path is null', async () => {
    const recap = { id: 'r1', transcript_path: null, channel_name: 'my-channel' }
    mockChain.single.mockResolvedValue({ data: recap, error: null })
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    mockUpload.mockResolvedValue({ error: null })

    await updateRecapSummary('r1', 'summary')
    const uploadPath = mockUpload.mock.calls[0][0]
    expect(uploadPath).toBe('recaps/my-channel.json')
  })

  test('throws on fetch error', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: { message: 'fail' } })
    await expect(updateRecapSummary('r1', 'x')).rejects.toBeTruthy()
  })
})

// ─── updateRecapSummaryByChannel ────────────────────────────────────

describe('updateRecapSummaryByChannel', () => {
  test('updates summary in storage by channel name', async () => {
    mockDownload.mockResolvedValue({
      data: { text: () => Promise.resolve(JSON.stringify({ transcript: [], aiSummary: 'old' })) },
      error: null,
    })
    mockUpload.mockResolvedValue({ error: null })

    const result = await updateRecapSummaryByChannel('ch-1', 'new summary')
    expect(result).toEqual({ channel_name: 'ch-1' })

    const uploadArgs = mockUpload.mock.calls[0]
    expect(uploadArgs[0]).toBe('recaps/ch-1.json')
    const uploadedContent = JSON.parse(uploadArgs[1])
    expect(uploadedContent.aiSummary).toBe('new summary')
  })

  test('creates new storage file when none exists', async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    mockUpload.mockResolvedValue({ error: null })

    await updateRecapSummaryByChannel('new-channel', 'summary')
    const uploadedContent = JSON.parse(mockUpload.mock.calls[0][1])
    expect(uploadedContent.aiSummary).toBe('summary')
    expect(uploadedContent.transcript).toEqual([])
  })

  test('returns null on upload error', async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    mockUpload.mockResolvedValue({ error: { message: 'upload failed' } })

    const result = await updateRecapSummaryByChannel('ch-1', 'x')
    expect(result).toBeNull()
  })
})

// ─── getProviderPerformanceSummary ──────────────────────────────────

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
