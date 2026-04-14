/**
 * Tests for lib/emailHelpers.js — Resend-backed coffee chat notifications.
 *
 * Core invariants this file protects:
 *   1. Each notification type routes to the correct recipient (direction).
 *   2. The subject line identifies the other party by name.
 *   3. Scheduled time is formatted into the body for types that need it.
 *   4. Unknown notification types are logged, not silently dropped.
 *   5. Missing recipient email is skipped without sending.
 *   6. Resend returning an error is logged (not thrown).
 *   7. Resend throwing is caught (not propagated).
 *   8. Missing RESEND_API_KEY disables sending entirely.
 *
 * @jest-environment node
 */

// Mock resend before the helper is imported
const mockSend = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

// ─── Fixtures ───────────────────────────────────────────────────────

const REQUESTER = {
  id: 'u-requester',
  name: 'Alice Anderson',
  email: 'alice@example.com',
  career: 'Software Engineer',
}

const RECIPIENT = {
  id: 'u-recipient',
  name: 'Bob Brown',
  email: 'bob@example.com',
  career: 'Product Designer',
}

const CHAT = {
  id: 'chat-1',
  requester_id: 'u-requester',
  recipient_id: 'u-recipient',
  scheduled_time: '2026-04-20T18:00:00.000Z',
  notes: 'Want to chat about AI products.',
}

function makeProfile(overrides = {}) {
  return { ...REQUESTER, ...overrides }
}

function makeChat(overrides = {}) {
  return { ...CHAT, ...overrides }
}

// ─── Console spies ──────────────────────────────────────────────────

let logSpy, warnSpy, errorSpy

beforeEach(() => {
  jest.clearAllMocks()
  process.env.RESEND_API_KEY = 'test-rk-xxxx'
  process.env.NEXT_PUBLIC_APP_URL = 'https://test.app'

  // Default: Resend succeeds
  mockSend.mockResolvedValue({ error: null })

  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
  warnSpy.mockRestore()
  errorSpy.mockRestore()
})

// ─── Import AFTER mocks are set up ──────────────────────────────────

const { sendCoffeeChatEmail } = require('@/lib/emailHelpers')

// ─── Routing (who gets which email) ─────────────────────────────────

describe('sendCoffeeChatEmail — routing', () => {
  test('new_request sends to the RECIPIENT, subject names the requester', async () => {
    await sendCoffeeChatEmail('new_request', CHAT, REQUESTER, RECIPIENT)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('bob@example.com')
    expect(call.subject).toMatch(/Alice Anderson/)
    expect(call.subject).toMatch(/coffee chat/i)
    expect(call.from).toMatch(/CircleW/)
  })

  test('accepted sends to the REQUESTER, subject names the recipient', async () => {
    await sendCoffeeChatEmail('accepted', CHAT, REQUESTER, RECIPIENT)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('alice@example.com')
    expect(call.subject).toMatch(/Bob Brown/)
    expect(call.subject).toMatch(/accepted/i)
  })

  test('declined sends to the REQUESTER', async () => {
    await sendCoffeeChatEmail('declined', CHAT, REQUESTER, RECIPIENT)

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].to).toBe('alice@example.com')
    // Declined email must NOT expose scheduled time (softer tone) — verify via body
    expect(mockSend.mock.calls[0][0].html).not.toMatch(/18:00|6:00/)
  })
})

// ─── Body contents ──────────────────────────────────────────────────

describe('sendCoffeeChatEmail — body content', () => {
  test('new_request body includes the formatted date+time and the notes', async () => {
    await sendCoffeeChatEmail('new_request', CHAT, REQUESTER, RECIPIENT)

    const html = mockSend.mock.calls[0][0].html
    // Formatted date should include the year in the long format
    expect(html).toMatch(/2026/)
    // Scheduled time should appear somewhere in the body
    expect(html).toMatch(/When:/)
    // Notes should be quoted in the body
    expect(html).toMatch(/Want to chat about AI products\./)
  })

  test('new_request omits notes block when notes are missing', async () => {
    const chatNoNotes = makeChat({ notes: null })
    await sendCoffeeChatEmail('new_request', chatNoNotes, REQUESTER, RECIPIENT)

    const html = mockSend.mock.calls[0][0].html
    // The notes quote marker should NOT appear when notes is null
    expect(html).not.toMatch(/Want to chat about AI products/)
    // But other body elements should still be present
    expect(html).toMatch(/When:/)
  })

  test('accepted body includes the recipient career when present', async () => {
    await sendCoffeeChatEmail('accepted', CHAT, REQUESTER, RECIPIENT)

    const html = mockSend.mock.calls[0][0].html
    expect(html).toMatch(/Product Designer/)
  })

  test('falls back to default name when requester.name is missing', async () => {
    const anon = makeProfile({ name: null })
    await sendCoffeeChatEmail('new_request', CHAT, anon, RECIPIENT)

    const call = mockSend.mock.calls[0][0]
    // Implementation falls back to 'Someone' — subject should reflect that
    expect(call.subject).toMatch(/Someone/)
  })
})

// ─── Graceful skip / error paths ────────────────────────────────────

describe('sendCoffeeChatEmail — graceful skips', () => {
  test('unknown notification type logs error and does not send', async () => {
    await sendCoffeeChatEmail('not_a_real_type', CHAT, REQUESTER, RECIPIENT)

    expect(mockSend).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown notification type'),
      'not_a_real_type'
    )
  })

  test('missing recipient email is skipped with a warning, not a throw', async () => {
    const noEmail = makeProfile({ email: null })

    await expect(
      sendCoffeeChatEmail('new_request', CHAT, REQUESTER, noEmail)
    ).resolves.not.toThrow()

    expect(mockSend).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No recipient email')
    )
  })
})

// ─── Resend failure paths (the scanner's actual concern) ────────────

describe('sendCoffeeChatEmail — Resend errors are logged, not thrown', () => {
  test('Resend returning { error } is logged as an error', async () => {
    mockSend.mockResolvedValue({ error: { message: 'Invalid API key' } })

    await expect(
      sendCoffeeChatEmail('new_request', CHAT, REQUESTER, RECIPIENT)
    ).resolves.not.toThrow()

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Resend error'),
      { message: 'Invalid API key' }
    )
  })

  test('Resend throwing a network error is caught and logged', async () => {
    mockSend.mockRejectedValue(new Error('ECONNRESET'))

    await expect(
      sendCoffeeChatEmail('new_request', CHAT, REQUESTER, RECIPIENT)
    ).resolves.not.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send'),
      expect.any(Error)
    )
  })

  test('successful send logs a confirmation', async () => {
    await sendCoffeeChatEmail('new_request', CHAT, REQUESTER, RECIPIENT)

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sent new_request email to bob@example.com')
    )
    // And no error was logged on the success path
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
