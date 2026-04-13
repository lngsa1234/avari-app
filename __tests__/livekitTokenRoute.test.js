/**
 * Tests for app/api/livekit-token/route.js
 *
 * Verifies the security posture of the LiveKit token endpoint:
 *   1. Authentication is required
 *   2. Token identity comes from the session, NEVER from the request body
 *   3. Room membership is verified per call type before a token is issued
 *   4. Unknown or malformed room ids are rejected with 403, not 500
 *
 * @jest-environment node
 */

// ─── Mocks ──────────────────────────────────────────────────────────

const USER_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222'
const COFFEE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MEETUP_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const GROUP_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CIRCLE_MEETUP_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

const mockUser = { id: USER_ID, email: 'u@test.com' }

// Supabase chain mock — every builder method returns the chain so tests
// can configure per-query responses via mockResolvedValueOnce on
// maybeSingle / single.
const mockChain = {}
const chainMethods = ['select', 'eq', 'or', 'maybeSingle', 'single']
chainMethods.forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain) })

const mockFrom = jest.fn().mockReturnValue(mockChain)

jest.mock('@/lib/apiAuth', () => ({
  authenticateRequest: jest.fn(),
  createAdminClient: jest.fn().mockReturnValue({
    from: (...args) => mockFrom(...args),
  }),
}))

// Capture AccessToken construction so we can assert on identity / name / grants
const capturedTokens = []
const mockAddGrant = jest.fn()
const mockToJwt = jest.fn().mockResolvedValue('mock-jwt-token')

jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation((apiKey, apiSecret, opts) => {
    const instance = {
      _apiKey: apiKey,
      _apiSecret: apiSecret,
      _opts: opts,
      _grants: [],
      addGrant: (g) => {
        instance._grants.push(g)
        mockAddGrant(g)
      },
      toJwt: mockToJwt,
    }
    capturedTokens.push(instance)
    return instance
  }),
}))

const { authenticateRequest } = require('@/lib/apiAuth')
const { POST } = require('@/app/api/livekit-token/route')

// ─── Helpers ────────────────────────────────────────────────────────

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: () => null },
    cookies: new Map(),
  }
}

function resetChain() {
  chainMethods.forEach(m => {
    mockChain[m] = jest.fn().mockReturnValue(mockChain)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  resetChain()
  mockFrom.mockReturnValue(mockChain)
  capturedTokens.length = 0

  authenticateRequest.mockResolvedValue({ user: mockUser, response: null })
  mockToJwt.mockResolvedValue('mock-jwt-token')
  process.env.LIVEKIT_API_KEY = 'test-key'
  process.env.LIVEKIT_API_SECRET = 'test-secret'
})

// ─── Authentication and input validation ────────────────────────────

describe('POST /api/livekit-token — auth & input', () => {
  test('returns 401 when not authenticated', async () => {
    authenticateRequest.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when roomId is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  test('returns 400 when roomId is not a string', async () => {
    const res = await POST(makeRequest({ roomId: 12345 }))
    expect(res.status).toBe(400)
  })

  test('returns 500 when LIVEKIT credentials are missing', async () => {
    delete process.env.LIVEKIT_API_KEY
    // Coffee chat membership must pass so we reach the credential check
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: USER_ID, recipient_id: OTHER_USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(500)
  })

  test('unknown room prefix is rejected with 403', async () => {
    const res = await POST(makeRequest({ roomId: 'unknown-prefix-xyz' }))
    expect(res.status).toBe(403)
  })

  test('malformed UUID is rejected with 403 (not 500)', async () => {
    const res = await POST(makeRequest({ roomId: 'coffee-not-a-uuid' }))
    expect(res.status).toBe(403)
  })
})

// ─── Identity override invariant ────────────────────────────────────

describe('POST /api/livekit-token — identity invariant', () => {
  test('token identity is always user.id from session, never body participantId', async () => {
    // Happy path: user is requester on the coffee chat
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: USER_ID, recipient_id: OTHER_USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({
      roomId: `coffee-${COFFEE_ID}`,
      participantId: 'attacker-tries-to-impersonate',
      participantName: 'Attacker',
    }))

    expect(res.status).toBe(200)
    expect(capturedTokens).toHaveLength(1)
    expect(capturedTokens[0]._opts.identity).toBe(USER_ID)
    expect(capturedTokens[0]._opts.identity).not.toBe('attacker-tries-to-impersonate')
  })

  test('token name defaults to user.email when participantName missing', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: USER_ID, recipient_id: OTHER_USER_ID },
      error: null,
    })

    await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))

    expect(capturedTokens[0]._opts.name).toBe('u@test.com')
  })
})

// ─── Coffee chat authorization ──────────────────────────────────────

describe('POST /api/livekit-token — coffee chat', () => {
  test('requester gets 200', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: USER_ID, recipient_id: OTHER_USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBe('mock-jwt-token')
  })

  test('recipient gets 200', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: OTHER_USER_ID, recipient_id: USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(200)
  })

  test('non-participant gets 403', async () => {
    const THIRD_USER = '33333333-3333-3333-3333-333333333333'
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { requester_id: OTHER_USER_ID, recipient_id: THIRD_USER },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(403)
  })

  test('missing coffee_chats row gets 403', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ roomId: `coffee-${COFFEE_ID}` }))
    expect(res.status).toBe(403)
  })
})

// ─── Meetup authorization ───────────────────────────────────────────

describe('POST /api/livekit-token — meetup', () => {
  test('signed-up participant gets 200', async () => {
    // Promise.all: meetups (.created_by) + meetup_signups (.user_id)
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { created_by: OTHER_USER_ID }, error: null })
      .mockResolvedValueOnce({ data: { user_id: USER_ID }, error: null })

    const res = await POST(makeRequest({ roomId: `meetup-${MEETUP_ID}` }))
    expect(res.status).toBe(200)
  })

  test('creator without signup gets 200 (host bypass)', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { created_by: USER_ID }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ roomId: `meetup-${MEETUP_ID}` }))
    expect(res.status).toBe(200)
  })

  test('non-signup non-creator gets 403', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: { created_by: OTHER_USER_ID }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ roomId: `meetup-${MEETUP_ID}` }))
    expect(res.status).toBe(403)
  })

  test('missing meetup row gets 403', async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ roomId: `meetup-${MEETUP_ID}` }))
    expect(res.status).toBe(403)
  })
})

// ─── Circle (connection group) authorization ────────────────────────

describe('POST /api/livekit-token — circle', () => {
  test('accepted member with direct group id gets 200', async () => {
    // First query: meetups lookup (returns null — not a meetup id)
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // Second query: connection_group_members with status='accepted'
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { user_id: USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `connection-group-${GROUP_ID}` }))
    expect(res.status).toBe(200)
  })

  test('accepted member via circle-linked meetup id gets 200', async () => {
    // Meetup lookup finds a circle_id
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { circle_id: GROUP_ID },
      error: null,
    })
    // Membership query returns accepted
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { user_id: USER_ID },
      error: null,
    })

    const res = await POST(makeRequest({ roomId: `connection-group-${CIRCLE_MEETUP_ID}` }))
    expect(res.status).toBe(200)
  })

  test('non-accepted member gets 403', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ roomId: `connection-group-${GROUP_ID}` }))
    expect(res.status).toBe(403)
  })
})
