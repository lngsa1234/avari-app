/**
 * Tests for lib/rateLimit.js — in-memory fallback path.
 *
 * We don't test the Upstash path here because it requires real Redis
 * credentials. The primitive gracefully falls back to memory when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are absent, which
 * is always the case in the test environment.
 *
 * Each test uses a unique subject identifier to avoid bucket collisions
 * since the memoryBuckets Map is module-level.
 *
 * @jest-environment node
 */

// Ensure Upstash creds are not set so the module falls through to memory.
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN

const { rateLimit, limits } = require('@/lib/rateLimit')

// ─── Helpers ────────────────────────────────────────────────────────

function mockRequest({ forwardedFor, realIp } = {}) {
  const headers = new Map()
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor)
  if (realIp) headers.set('x-real-ip', realIp)
  return { headers: { get: (name) => headers.get(name) || null } }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('rateLimit — memory fallback', () => {
  test('first call under limit returns null (allowed)', async () => {
    const config = { name: 'test-basic', limit: 5, windowSeconds: 60 }
    const result = await rateLimit(mockRequest(), config, 'user-basic-1')
    expect(result).toBeNull()
  })

  test('calls up to the limit all return null', async () => {
    const config = { name: 'test-up-to', limit: 3, windowSeconds: 60 }
    const subject = 'user-up-to-1'

    expect(await rateLimit(mockRequest(), config, subject)).toBeNull()
    expect(await rateLimit(mockRequest(), config, subject)).toBeNull()
    expect(await rateLimit(mockRequest(), config, subject)).toBeNull()
  })

  test('call beyond the limit returns a 429 response', async () => {
    const config = { name: 'test-exceed', limit: 2, windowSeconds: 60 }
    const subject = 'user-exceed-1'

    await rateLimit(mockRequest(), config, subject)
    await rateLimit(mockRequest(), config, subject)
    const blocked = await rateLimit(mockRequest(), config, subject)

    expect(blocked).not.toBeNull()
    expect(blocked.status).toBe(429)
  })

  test('429 response includes Retry-After and X-RateLimit headers', async () => {
    const config = { name: 'test-headers', limit: 1, windowSeconds: 60 }
    const subject = 'user-headers-1'

    await rateLimit(mockRequest(), config, subject)
    const blocked = await rateLimit(mockRequest(), config, subject)

    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('1')
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(blocked.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  test('429 body includes retryAfter seconds', async () => {
    const config = { name: 'test-body', limit: 1, windowSeconds: 60 }
    const subject = 'user-body-1'

    await rateLimit(mockRequest(), config, subject)
    const blocked = await rateLimit(mockRequest(), config, subject)

    const body = await blocked.json()
    expect(body.error).toMatch(/too many requests/i)
    expect(typeof body.retryAfter).toBe('number')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  test('different subjects have independent buckets', async () => {
    const config = { name: 'test-independent', limit: 1, windowSeconds: 60 }

    // Alice consumes her full quota
    expect(await rateLimit(mockRequest(), config, 'alice')).toBeNull()
    const aliceBlocked = await rateLimit(mockRequest(), config, 'alice')
    expect(aliceBlocked.status).toBe(429)

    // Bob is unaffected
    expect(await rateLimit(mockRequest(), config, 'bob')).toBeNull()
  })

  test('bucket resets after the window expires', async () => {
    // 0.02 s = 20 ms window; small enough to await safely
    const config = { name: 'test-reset', limit: 1, windowSeconds: 0.02 }
    const subject = 'user-reset-1'

    expect(await rateLimit(mockRequest(), config, subject)).toBeNull()
    const blocked = await rateLimit(mockRequest(), config, subject)
    expect(blocked.status).toBe(429)

    // Wait for the window to elapse
    await new Promise((r) => setTimeout(r, 40))

    expect(await rateLimit(mockRequest(), config, subject)).toBeNull()
  })

  test('falls back to x-forwarded-for IP when no subject is given', async () => {
    const config = { name: 'test-ip-fwd', limit: 1, windowSeconds: 60 }
    const req = mockRequest({ forwardedFor: '203.0.113.42' })

    expect(await rateLimit(req, config)).toBeNull()
    const blocked = await rateLimit(req, config)
    expect(blocked.status).toBe(429)

    // A different IP gets its own bucket
    const otherReq = mockRequest({ forwardedFor: '203.0.113.99' })
    expect(await rateLimit(otherReq, config)).toBeNull()
  })

  test('uses first IP when x-forwarded-for is a comma-list', async () => {
    const config = { name: 'test-ip-list', limit: 1, windowSeconds: 60 }
    const client = mockRequest({ forwardedFor: '203.0.113.77, 10.0.0.1, 10.0.0.2' })

    expect(await rateLimit(client, config)).toBeNull()

    // A request with the same client IP but different proxy chain collides
    const sameClient = mockRequest({ forwardedFor: '203.0.113.77, 10.0.0.1' })
    const blocked = await rateLimit(sameClient, config)
    expect(blocked.status).toBe(429)
  })

  test('falls back to x-real-ip when no x-forwarded-for', async () => {
    const config = { name: 'test-real-ip', limit: 1, windowSeconds: 60 }
    const req = mockRequest({ realIp: '198.51.100.5' })

    expect(await rateLimit(req, config)).toBeNull()
    const blocked = await rateLimit(req, config)
    expect(blocked.status).toBe(429)
  })

  test('uses "unknown" identifier when no IP headers and no subject', async () => {
    const config = { name: 'test-unknown-' + Date.now(), limit: 1, windowSeconds: 60 }
    const req = mockRequest()

    expect(await rateLimit(req, config)).toBeNull()
    const blocked = await rateLimit(req, config)
    expect(blocked.status).toBe(429)
  })
})

describe('rateLimit — preset configs', () => {
  test('limits.ai is a valid config shape', () => {
    expect(limits.ai).toMatchObject({
      name: expect.any(String),
      limit: expect.any(Number),
      windowSeconds: expect.any(Number),
    })
    expect(limits.ai.limit).toBeGreaterThan(0)
    expect(limits.ai.windowSeconds).toBeGreaterThan(0)
  })

  test('all presets are usable as rateLimit configs', async () => {
    // Each preset with a unique subject should allow at least one call
    for (const [presetName, config] of Object.entries(limits)) {
      const subject = `preset-${presetName}-${Date.now()}-${Math.random()}`
      const result = await rateLimit(mockRequest(), config, subject)
      expect(result).toBeNull()
    }
  })
})
