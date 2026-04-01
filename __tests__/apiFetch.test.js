/**
 * Tests for lib/apiFetch.js — authenticated fetch wrapper.
 */

const mockGetSession = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const { apiFetch } = require('@/lib/apiFetch')

describe('apiFetch', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  test('attaches Bearer token when session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'my-token' } },
    })

    await apiFetch('/api/test')

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my-token',
      },
    })
  })

  test('omits Authorization header when no session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    })

    await apiFetch('/api/test')

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('passes through options (method, body)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      body: '{"foo":"bar"}',
    }))
  })

  test('merges custom headers with defaults', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await apiFetch('/api/test', {
      headers: { 'X-Custom': 'value' },
    })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Custom']).toBe('value')
  })
})
