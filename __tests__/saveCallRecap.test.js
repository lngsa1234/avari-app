/**
 * Tests for app/api/save-call-recap/route.js
 * Verifies transcript + AI summary are saved to Storage, not DB.
 *
 * @jest-environment node
 */

// ─── Mocks ──────────────────────────────────────────────────────────

const mockUser = { id: 'user-1' }

const mockChain = {}
const chainMethods = ['select', 'insert', 'update', 'eq', 'or', 'order', 'limit', 'single', 'maybeSingle']
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
const { POST } = require('@/app/api/save-call-recap/route')

// ─── Helpers ────────────────────────────────────────────────────────

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

// ─── Tests ──────────────────────────────────────────────────────────

describe('POST /api/save-call-recap', () => {
  test('returns 401 when not authenticated', async () => {
    authenticateRequest.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ channelName: 'ch-1' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when channelName is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  describe('new recap (no existing)', () => {
    beforeEach(() => {
      // No existing recap
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
      // Consent check
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }) // no consent row
        .mockResolvedValueOnce({ data: null, error: null }) // no existing recap
      // Insert returns created recap
      mockChain.single.mockResolvedValue({
        data: { id: 'new-r1', channel_name: 'ch-1', transcript_path: 'recaps/ch-1.json' },
        error: null,
      })
    })

    test('uploads transcript to storage bucket', async () => {
      const transcript = [{ speakerId: 'u1', text: 'Hello', timestamp: 1000 }]
      await POST(makeRequest({
        channelName: 'ch-1',
        callType: '1on1',
        provider: 'webrtc',
        transcript,
        aiSummary: 'A brief call',
      }))

      expect(mockStorageFrom).toHaveBeenCalledWith('call-transcripts')
      expect(mockUpload).toHaveBeenCalledWith(
        'recaps/ch-1.json',
        expect.any(String),
        expect.objectContaining({ contentType: 'application/json', upsert: true })
      )

      // Verify uploaded content
      const uploaded = JSON.parse(mockUpload.mock.calls[0][1])
      expect(uploaded.transcript).toEqual(transcript)
      expect(uploaded.aiSummary).toBe('A brief call')
    })

    test('stores empty transcript in DB (not the actual data)', async () => {
      await POST(makeRequest({
        channelName: 'ch-1',
        callType: '1on1',
        provider: 'webrtc',
        transcript: [{ text: 'hi' }],
      }))

      // The insert call should have transcript: [] (empty, data is in storage)
      const insertArg = mockChain.insert.mock.calls[0]?.[0]
      expect(insertArg.transcript).toEqual([])
      expect(insertArg.ai_summary).toBeNull()
      expect(insertArg.transcript_path).toBe('recaps/ch-1.json')
    })
  })

  describe('existing recap (merge)', () => {
    test('merges transcripts via storage and deduplicates', async () => {
      const existingTranscript = [
        { speakerId: 'u1', text: 'Hello', timestamp: 1000 },
        { speakerId: 'u2', text: 'Hi', timestamp: 2000 },
      ]

      // Consent check returns no row
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        // Existing recap found
        .mockResolvedValueOnce({
          data: { id: 'r1', transcript_path: 'recaps/ch-1.json', started_at: '2026-01-01T00:00:00Z', participant_ids: ['u1'] },
          error: null,
        })

      // Storage download returns existing transcript
      mockDownload.mockResolvedValue({
        data: { text: () => Promise.resolve(JSON.stringify({ transcript: existingTranscript, aiSummary: 'old summary' })) },
        error: null,
      })

      // Update returns merged recap
      mockChain.single.mockResolvedValue({
        data: { id: 'r1', transcript_path: 'recaps/ch-1.json' },
        error: null,
      })

      const newTranscript = [
        { speakerId: 'u2', text: 'Hi', timestamp: 2000 }, // duplicate
        { speakerId: 'u2', text: 'How are you?', timestamp: 3000 }, // new
      ]

      await POST(makeRequest({
        channelName: 'ch-1',
        callType: '1on1',
        provider: 'webrtc',
        transcript: newTranscript,
        participantIds: ['u2'],
      }))

      // Verify deduplication in uploaded content
      const uploaded = JSON.parse(mockUpload.mock.calls[0][1])
      expect(uploaded.transcript).toHaveLength(3) // 2 existing + 1 new (1 duplicate removed)
      expect(uploaded.transcript.map(t => t.text)).toEqual(['Hello', 'Hi', 'How are you?'])
    })

    test('preserves existing aiSummary when new one is null', async () => {
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'r1', transcript_path: 'recaps/ch-1.json', started_at: '2026-01-01T00:00:00Z', participant_ids: [] },
          error: null,
        })

      mockDownload.mockResolvedValue({
        data: { text: () => Promise.resolve(JSON.stringify({ transcript: [], aiSummary: 'keep this' })) },
        error: null,
      })
      mockChain.single.mockResolvedValue({ data: { id: 'r1' }, error: null })

      await POST(makeRequest({
        channelName: 'ch-1',
        callType: '1on1',
        provider: 'webrtc',
        transcript: [],
      }))

      const uploaded = JSON.parse(mockUpload.mock.calls[0][1])
      expect(uploaded.aiSummary).toBe('keep this')
    })
  })

  describe('consent enforcement', () => {
    test('strips transcript when consent is declined', async () => {
      // Consent row exists but declined
      mockChain.maybeSingle
        .mockResolvedValueOnce({ data: { status: 'declined' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }) // no existing recap

      mockChain.single.mockResolvedValue({
        data: { id: 'r1', transcript_path: 'recaps/ch-1.json' },
        error: null,
      })

      await POST(makeRequest({
        channelName: 'ch-1',
        callType: '1on1',
        provider: 'webrtc',
        transcript: [{ text: 'private stuff', timestamp: 1000 }],
      }))

      // Uploaded transcript should be empty (consent declined)
      const uploaded = JSON.parse(mockUpload.mock.calls[0][1])
      expect(uploaded.transcript).toEqual([])
    })
  })

  test('returns 500 when storage upload fails', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    mockUpload.mockResolvedValue({ error: { message: 'Storage quota exceeded' } })

    const res = await POST(makeRequest({
      channelName: 'ch-1',
      callType: '1on1',
      provider: 'webrtc',
      transcript: [{ text: 'hi' }],
    }))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('storage')
  })
})
