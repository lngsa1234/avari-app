/**
 * @jest-environment node
 */

/**
 * Tests for lib/generateUsername.js — username generation and deduplication.
 */

const { generateUsername } = require('@/lib/generateUsername')

// Helper to build a mock supabase client whose .from('profiles') chain
// resolves to the given list of existing usernames.
function mockSupabase(existingUsernames = []) {
  const data = existingUsernames.map(u => ({ username: u }))
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        like: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  }
}

describe('generateUsername', () => {
  test('converts "Lynn Wang" to "lynn.wang"', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('Lynn Wang', sb)
    expect(result).toBe('lynn.wang')
  })

  test('converts single name to lowercase', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('Alice', sb)
    expect(result).toBe('alice')
  })

  test('strips special characters from name', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('Hi!! @#$% World', sb)
    expect(result).toBe('hi.world')
  })

  test('collapses multiple spaces into single dot', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('John    Doe', sb)
    expect(result).toBe('john.doe')
  })

  test('falls back to "user" for null name', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername(null, sb)
    expect(result).toBe('user')
  })

  test('falls back to "user" for empty string', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('', sb)
    expect(result).toBe('user')
  })

  test('falls back to "user" for whitespace-only string', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('   ', sb)
    expect(result).toBe('user')
  })

  test('appends 2 when base username is taken', async () => {
    const sb = mockSupabase(['lynn.wang'])
    const result = await generateUsername('Lynn Wang', sb)
    expect(result).toBe('lynn.wang2')
  })

  test('skips to next available number when earlier ones are taken', async () => {
    const sb = mockSupabase(['lynn.wang', 'lynn.wang2'])
    const result = await generateUsername('Lynn Wang', sb)
    expect(result).toBe('lynn.wang3')
  })

  test('handles many consecutive taken usernames', async () => {
    const sb = mockSupabase(['lynn.wang', 'lynn.wang2', 'lynn.wang3', 'lynn.wang4'])
    const result = await generateUsername('Lynn Wang', sb)
    expect(result).toBe('lynn.wang5')
  })

  test('trims leading and trailing spaces', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('   Lynn Wang   ', sb)
    expect(result).toBe('lynn.wang')
  })

  test('falls back to "user" when name is all special characters', async () => {
    const sb = mockSupabase([])
    const result = await generateUsername('!!!@@@', sb)
    expect(result).toBe('user')
  })

  test('queries supabase with correct table and pattern', async () => {
    const sb = mockSupabase([])
    await generateUsername('Lynn Wang', sb)

    expect(sb.from).toHaveBeenCalledWith('profiles')
    const selectMock = sb.from.mock.results[0].value.select
    expect(selectMock).toHaveBeenCalledWith('username')
    const likeMock = selectMock.mock.results[0].value.like
    expect(likeMock).toHaveBeenCalledWith('username', 'lynn.wang%')
  })
})
