/**
 * Tests for lib/activityHelpers.js — user activity tracking.
 *
 * Tests the pure functions (isUserActive, countActiveUsers).
 * updateLastActive and updateLastActiveThrottled require Supabase and
 * are tested separately with mocks.
 */

// Mock supabase module to prevent import errors
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: mockUpdate }),
  },
}))

const { isUserActive, countActiveUsers, updateLastActiveThrottled } = require('@/lib/activityHelpers')

describe('isUserActive', () => {
  test('returns true for user active 5 minutes ago (within 10 min threshold)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(isUserActive(fiveMinAgo, 10)).toBe(true)
  })

  test('returns false for user active 15 minutes ago (outside 10 min threshold)', () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    expect(isUserActive(fifteenMinAgo, 10)).toBe(false)
  })

  test('returns true for user active just now', () => {
    expect(isUserActive(new Date().toISOString())).toBe(true)
  })

  test('returns false for null timestamp', () => {
    expect(isUserActive(null)).toBe(false)
  })

  test('returns false for undefined timestamp', () => {
    expect(isUserActive(undefined)).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isUserActive('')).toBe(false)
  })

  test('respects custom threshold', () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    expect(isUserActive(threeMinAgo, 5)).toBe(true)
    expect(isUserActive(threeMinAgo, 2)).toBe(false)
  })

  test('uses 10 minute default threshold', () => {
    const nineMinAgo = new Date(Date.now() - 9 * 60 * 1000).toISOString()
    const elevenMinAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    expect(isUserActive(nineMinAgo)).toBe(true)
    expect(isUserActive(elevenMinAgo)).toBe(false)
  })

  test('accepts Date objects as well as strings', () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 1000)
    expect(isUserActive(recentDate, 10)).toBe(true)
  })
})

describe('countActiveUsers', () => {
  test('counts only active users', () => {
    const now = Date.now()
    const users = [
      { last_active: new Date(now - 5 * 60 * 1000).toISOString() },  // active
      { last_active: new Date(now - 15 * 60 * 1000).toISOString() }, // inactive
      { last_active: new Date(now - 2 * 60 * 1000).toISOString() },  // active
      { last_active: null },                                           // inactive
    ]
    expect(countActiveUsers(users, 10)).toBe(2)
  })

  test('returns 0 for empty array', () => {
    expect(countActiveUsers([], 10)).toBe(0)
  })

  test('returns 0 for null', () => {
    expect(countActiveUsers(null)).toBe(0)
  })

  test('returns 0 for undefined', () => {
    expect(countActiveUsers(undefined)).toBe(0)
  })

  test('handles nested user.last_active format', () => {
    const now = Date.now()
    const users = [
      { user: { last_active: new Date(now - 3 * 60 * 1000).toISOString() } }, // active (nested)
      { last_active: new Date(now - 3 * 60 * 1000).toISOString() },           // active (flat)
      { user: { last_active: new Date(now - 20 * 60 * 1000).toISOString() } }, // inactive
    ]
    expect(countActiveUsers(users, 10)).toBe(2)
  })

  test('returns 0 when all users are inactive', () => {
    const users = [
      { last_active: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { last_active: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
    ]
    expect(countActiveUsers(users, 10)).toBe(0)
  })
})
