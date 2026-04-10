/**
 * Tests for app/api/save-recap-summary/route.js
 * Verifies AI summary is saved to Storage, not DB.
 *
 * @jest-environment node
 */

const mockUser = { id: 'user-1' }

const mockChain = {}
const chainMethods = ['select', 'update', 'eq', 'single']
chainMethods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })

const mockFrom = jest.fn().mockReturnValue(mockChain)
const mockDownload = jest.fn()
const mockUpload = jest.fn()
const mockStorageFrom = jest.fn().mockReturnValue({
  download: mockDownload,
  upload: mockUpload,
})

jest.mock('@/lib/apiAuth', () => ({
  authenticateRequest: jest.fn(),
  createAdminClient: jest.fn().mockReturnValue({
    from: (...args) => mockFrom(...args),
    storage: { from: (...args) => mockStorageFrom(...args) },
  }),
}))

const { authenticateRequest } = require('@/lib/apiAuth')
const { POST } = require('@/app/api/save-recap-summary/route')

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
    headers: new Map(),
    cookies: new Map(),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  authenticateRequest.mockResolvedValue({ user: mockUser, response: null })
  chainMethods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })
  mockFrom.mockReturnValue(mockChain)
  mockUpload.mockResolvedValue({ error: null })
})

describe('POST /api/save-recap-summary', () => {
  test('returns 401 when not authenticated', async () => {
    authenticateRequest.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ recapId: 'r1', aiSummary: 'test' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when recapId is missing', async () => {
    const res = await POST(makeRequest({ aiSummary: 'test' }))
    expect(res.status).toBe(400)
  })

  test('returns 400 when aiSummary is missing', async () => {
    const res = await POST(makeRequest({ recapId: 'r1' }))
    expect(res.status).toBe(400)
  })

  test('saves summary to storage using existing transcript_path', async () => {
    mockChain.single.mockResolvedValue({
      data: { id: 'r1', channel_name: 'ch-1', transcript_path: 'recaps/ch-1.json' },
      error: null,
    })

    // Existing file has transcript data
    mockDownload.mockResolvedValue({
      data: { text: () => Promise.resolve(JSON.stringify({ transcript: [{ text: 'hi' }], aiSummary: null })) },
      error: null,
    })

    const res = await POST(makeRequest({ recapId: 'r1', aiSummary: '{"summary":"A good chat"}' }))
    expect(res.status).toBe(200)

    // Verify storage upload
    expect(mockStorageFrom).toHaveBeenCalledWith('call-transcripts')
    const uploaded = JSON.parse(mockUpload.mock.calls[0][1])
    expect(uploaded.aiSummary).toBe('{"summary":"A good chat"}')
    expect(uploaded.transcript).toEqual([{ text: 'hi' }]) // preserved
  })

  test('uses channel_name fallback when transcript_path is null', async () => {
    mockChain.single.mockResolvedValue({
      data: { id: 'r1', channel_name: 'my-channel', transcript_path: null },
      error: null,
    })

    mockDownload.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    await POST(makeRequest({ recapId: 'r1', aiSummary: 'summary' }))

    // Should upload to fallback path
    expect(mockUpload.mock.calls[0][0]).toBe('recaps/my-channel.json')

    // Should also update transcript_path + ai_summary in DB
    expect(mockChain.update).toHaveBeenCalledWith({ ai_summary: 'summary', transcript_path: 'recaps/my-channel.json' })
  })

  test('returns 500 when storage upload fails', async () => {
    mockChain.single.mockResolvedValue({
      data: { id: 'r1', channel_name: 'ch-1', transcript_path: 'recaps/ch-1.json' },
      error: null,
    })
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    mockUpload.mockResolvedValue({ error: { message: 'quota exceeded' } })

    const res = await POST(makeRequest({ recapId: 'r1', aiSummary: 'test' }))
    expect(res.status).toBe(500)
  })
})
