/**
 * Tests for lib/apiAuth.js — API route authentication helpers.
 *
 * @jest-environment node
 */

// Mock next/server before any imports
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, opts) => ({ body, status: opts?.status || 200 }),
  },
}))

// Mock Supabase
const mockGetUser = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

const { authenticateRequest, verifyCronAuth, cronUnauthorized, createAdminClient } = require('@/lib/apiAuth')

// Helper to create a mock request
function mockRequest({ authHeader, cookies = new Map(), cronSecret } = {}) {
  const headers = new Map()
  if (authHeader) headers.set('authorization', authHeader)
  if (cronSecret) headers.set('x-cron-secret', cronSecret)

  return {
    headers: { get: (name) => headers.get(name) || null },
    cookies,
  }
}

describe('authenticateRequest', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  test('returns 401 when no token is present', async () => {
    const request = mockRequest({})
    const result = await authenticateRequest(request)

    expect(result.user).toBeNull()
    expect(result.response.status).toBe(401)
  })

  test('extracts token from Bearer header and verifies with Supabase', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })

    const request = mockRequest({ authHeader: 'Bearer valid-token-123' })
    const result = await authenticateRequest(request)

    expect(result.user).toEqual({ id: 'user-123', email: 'test@example.com' })
    expect(result.response).toBeNull()
    expect(mockGetUser).toHaveBeenCalledWith('valid-token-123')
  })

  test('returns 401 when Supabase rejects the token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    })

    const request = mockRequest({ authHeader: 'Bearer bad-token' })
    const result = await authenticateRequest(request)

    expect(result.user).toBeNull()
    expect(result.response.status).toBe(401)
  })

  test('ignores non-Bearer auth headers', async () => {
    const request = mockRequest({ authHeader: 'Basic dXNlcjpwYXNz' })
    const result = await authenticateRequest(request)

    expect(result.user).toBeNull()
    expect(result.response.status).toBe(401)
  })

  test('extracts token from auth-token cookie (JSON array format)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-cookie', email: 'cookie@test.com' } },
      error: null,
    })

    const cookies = new Map([['sb-auth-token', { value: '["token-from-cookie"]' }]])
    const request = mockRequest({ cookies })
    const result = await authenticateRequest(request)

    expect(result.user).toEqual({ id: 'user-cookie', email: 'cookie@test.com' })
    expect(mockGetUser).toHaveBeenCalledWith('token-from-cookie')
  })

  test('extracts token from auth-token cookie (plain string JSON)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-str', email: 'str@test.com' } },
      error: null,
    })

    const cookies = new Map([['sb-auth-token', { value: '"plain-token"' }]])
    const request = mockRequest({ cookies })
    const result = await authenticateRequest(request)

    expect(result.user).toEqual({ id: 'user-str', email: 'str@test.com' })
    expect(mockGetUser).toHaveBeenCalledWith('plain-token')
  })

  test('extracts token from auth-token cookie (unparseable, raw value)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-raw', email: 'raw@test.com' } },
      error: null,
    })

    const cookies = new Map([['sb-auth-token', { value: 'raw-token-value' }]])
    const request = mockRequest({ cookies })
    const result = await authenticateRequest(request)

    expect(result.user).toEqual({ id: 'user-raw', email: 'raw@test.com' })
    expect(mockGetUser).toHaveBeenCalledWith('raw-token-value')
  })
})

describe('verifyCronAuth', () => {
  test('returns true when X-Cron-Secret matches CRON_SECRET', () => {
    process.env.CRON_SECRET = 'my-secret-123'
    const request = mockRequest({ cronSecret: 'my-secret-123' })

    expect(verifyCronAuth(request)).toBe(true)
  })

  test('returns false when X-Cron-Secret does not match', () => {
    process.env.CRON_SECRET = 'my-secret-123'
    const request = mockRequest({ cronSecret: 'wrong-secret' })

    expect(verifyCronAuth(request)).toBe(false)
  })

  test('returns false when no CRON_SECRET is configured', () => {
    delete process.env.CRON_SECRET
    const request = mockRequest({ cronSecret: 'anything' })

    expect(verifyCronAuth(request)).toBe(false)
  })

  test('returns false when no header is sent', () => {
    process.env.CRON_SECRET = 'my-secret-123'
    const request = mockRequest({})

    expect(verifyCronAuth(request)).toBe(false)
  })
})

describe('cronUnauthorized', () => {
  test('returns a 401 response', () => {
    const result = cronUnauthorized()
    expect(result.status).toBe(401)
  })
})

describe('createAdminClient', () => {
  test('returns a Supabase client', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    const client = createAdminClient()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})
