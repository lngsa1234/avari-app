/**
 * Tests for app/api/get-recap-transcript/route.js
 *
 * Verifies the security posture of the transcript download endpoint:
 *   1. Authentication is required
 *   2. Path format is validated (no traversal, must live under recaps/)
 *   3. Caller must be in call_recaps.participant_ids for the requested path
 *
 * @jest-environment node
 */

const USER_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222'
const mockUser = { id: USER_ID, email: 'u@test.com' }

// Supabase chain mock — configured per-test via mockResolvedValueOnce
const mockChain = {}
const chainMethods = ['select', 'eq', 'maybeSingle']
chainMethods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })

const mockFrom = jest.fn().mockReturnValue(mockChain)
const mockDownload = jest.fn()
const mockStorageFrom = jest.fn().mockReturnValue({ download: mockDownload })

jest.mock('@/lib/apiAuth', () => ({
  authenticateRequest: jest.fn(),
  createAdminClient: jest.fn().mockReturnValue({
    from: (...args) => mockFrom(...args),
    storage: { from: (...args) => mockStorageFrom(...args) },
  }),
}))

const { authenticateRequest } = require('@/lib/apiAuth')
const { GET } = require('@/app/api/get-recap-transcript/route')

// ─── Helpers ────────────────────────────────────────────────────────

function makeRequest(path) {
  const url = path != null
    ? `https://test.local/api/get-recap-transcript?path=${encodeURIComponent(path)}`
    : 'https://test.local/api/get-recap-transcript'
  return { url, headers: { get: () => null }, cookies: new Map() }
}

function resetChain() {
  chainMethods.forEach(m => {
    mockChain[m] = jest.fn().mockReturnValue(mockChain)
  })
}

function makeBlob(payload) {
  return { text: async () => JSON.stringify(payload) }
}

beforeEach(() => {
  jest.clearAllMocks()
  resetChain()
  mockFrom.mockReturnValue(mockChain)
  mockStorageFrom.mockReturnValue({ download: mockDownload })

  authenticateRequest.mockResolvedValue({ user: mockUser, response: null })
})

// ─── Tests ──────────────────────────────────────────────────────────

describe('GET /api/get-recap-transcript — auth & input', () => {
  test('returns 401 when not authenticated', async () => {
    authenticateRequest.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await GET(makeRequest('recaps/ch-1.json'))
    expect(res.status).toBe(401)
  })

  test('returns 400 when path is missing', async () => {
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(400)
  })

  test('returns 400 when path does not start with recaps/', async () => {
    const res = await GET(makeRequest('other-bucket/leak.json'))
    expect(res.status).toBe(400)
  })

  test('returns 400 when path contains traversal sequence', async () => {
    const res = await GET(makeRequest('recaps/../secrets.json'))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/get-recap-transcript — ownership', () => {
  test('returns 403 when no call_recaps row matches the path', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const res = await GET(makeRequest('recaps/unknown.json'))
    expect(res.status).toBe(403)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  test('returns 403 when caller is not in participant_ids', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { participant_ids: [OTHER_USER_ID, '33333333-3333-3333-3333-333333333333'] },
      error: null,
    })

    const res = await GET(makeRequest('recaps/ch-1.json'))
    expect(res.status).toBe(403)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  test('returns 403 when participant_ids is not an array', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { participant_ids: null },
      error: null,
    })

    const res = await GET(makeRequest('recaps/ch-1.json'))
    expect(res.status).toBe(403)
  })

  test('returns transcript + summary when caller is a participant', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { participant_ids: [OTHER_USER_ID, USER_ID] },
      error: null,
    })
    mockDownload.mockResolvedValueOnce({
      data: makeBlob({
        transcript: [{ text: 'Hello', timestamp: 1 }],
        aiSummary: 'Short summary',
      }),
      error: null,
    })

    const res = await GET(makeRequest('recaps/ch-1.json'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.transcript).toEqual([{ text: 'Hello', timestamp: 1 }])
    expect(body.aiSummary).toBe('Short summary')
  })

  test('ownership check runs before storage download (storage is not called on 403)', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { participant_ids: [OTHER_USER_ID] },
      error: null,
    })

    await GET(makeRequest('recaps/ch-1.json'))
    expect(mockDownload).not.toHaveBeenCalled()
  })
})
