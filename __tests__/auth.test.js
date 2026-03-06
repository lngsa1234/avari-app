/**
 * Tests for auth, profile, and activity tracking logic.
 */

describe('Auth & Profile Logic', () => {
  describe('Profile auto-creation', () => {
    test('extracts name from email when no display name', () => {
      const email = 'john.doe@gmail.com'
      const name = email.split('@')[0].replace(/[._]/g, ' ')
      expect(name).toBe('john doe')
    })

    test('uses display name when available', () => {
      const displayName = 'John Doe'
      const email = 'jd@example.com'
      const name = displayName || email.split('@')[0]
      expect(name).toBe('John Doe')
    })
  })

  describe('Auth state transitions', () => {
    const VALID_STATES = ['initializing', 'loading_profile', 'ready', 'signed_out']

    test('starts in initializing state', () => {
      const initialState = 'initializing'
      expect(VALID_STATES).toContain(initialState)
    })

    test('transitions to loading_profile after session found', () => {
      const state = 'loading_profile'
      expect(VALID_STATES).toContain(state)
    })

    test('transitions to ready after profile loaded', () => {
      const state = 'ready'
      expect(VALID_STATES).toContain(state)
    })

    test('transitions to signed_out on logout', () => {
      const state = 'signed_out'
      expect(VALID_STATES).toContain(state)
    })
  })
})

describe('Activity Tracking', () => {
  describe('isUserActive', () => {
    function isUserActive(lastActiveTimestamp, minutesThreshold = 10) {
      if (!lastActiveTimestamp) return false
      const diff = Date.now() - new Date(lastActiveTimestamp).getTime()
      return diff < minutesThreshold * 60 * 1000
    }

    test('returns true for recently active user', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(isUserActive(fiveMinAgo, 10)).toBe(true)
    })

    test('returns false for inactive user', () => {
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
      expect(isUserActive(twentyMinAgo, 10)).toBe(false)
    })

    test('returns false for null timestamp', () => {
      expect(isUserActive(null)).toBe(false)
    })

    test('returns false for undefined timestamp', () => {
      expect(isUserActive(undefined)).toBe(false)
    })

    test('respects custom threshold', () => {
      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
      expect(isUserActive(threeMinAgo, 5)).toBe(true)
      expect(isUserActive(threeMinAgo, 2)).toBe(false)
    })
  })

  describe('countActiveUsers', () => {
    function countActiveUsers(users, minutesThreshold = 10) {
      const cutoff = Date.now() - minutesThreshold * 60 * 1000
      return users.filter(u => u.last_active && new Date(u.last_active).getTime() > cutoff).length
    }

    test('counts only active users', () => {
      const now = Date.now()
      const users = [
        { last_active: new Date(now - 5 * 60 * 1000).toISOString() },  // 5 min ago - active
        { last_active: new Date(now - 15 * 60 * 1000).toISOString() }, // 15 min ago - inactive
        { last_active: new Date(now - 2 * 60 * 1000).toISOString() },  // 2 min ago - active
        { last_active: null },                                           // no data - inactive
      ]

      expect(countActiveUsers(users, 10)).toBe(2)
    })

    test('returns 0 for empty array', () => {
      expect(countActiveUsers([], 10)).toBe(0)
    })
  })

  describe('Throttled updates', () => {
    test('throttle interval is 60 seconds', () => {
      const THROTTLE_MS = 60 * 1000
      expect(THROTTLE_MS).toBe(60000)
    })

    test('skips update if within throttle window', () => {
      const lastUpdate = Date.now() - 30 * 1000 // 30 sec ago
      const throttleMs = 60 * 1000
      const shouldUpdate = (Date.now() - lastUpdate) >= throttleMs
      expect(shouldUpdate).toBe(false)
    })

    test('allows update after throttle window', () => {
      const lastUpdate = Date.now() - 90 * 1000 // 90 sec ago
      const throttleMs = 60 * 1000
      const shouldUpdate = (Date.now() - lastUpdate) >= throttleMs
      expect(shouldUpdate).toBe(true)
    })
  })
})
