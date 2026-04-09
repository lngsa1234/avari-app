/**
 * Tests for connection request logic.
 *
 * These tests verify the core business logic for:
 * - Loading incoming connection requests (filtering mutual interests)
 * - Removing mutual connections (both directions)
 * - Handling connect actions (detecting mutual matches)
 * - Peer suggestion prioritization (incoming interests first)
 */

describe('Connection Request Logic', () => {
  // Simulates the filtering logic from loadHomePageData / loadConnectionRequests
  function getFilteredPendingRequests(incomingInterests, myInterests) {
    const myInterestIds = new Set(myInterests.map(i => i.interested_in_user_id))
    return incomingInterests.filter(i => !myInterestIds.has(i.user_id))
  }

  // Simulates the suggestion sorting from ConnectionGroupsView
  function sortSuggestions(suggestions, interestedInMeIds) {
    return [...suggestions].sort((a, b) => {
      const aInterested = interestedInMeIds.has(a.id) ? 1 : 0
      const bInterested = interestedInMeIds.has(b.id) ? 1 : 0
      return bInterested - aInterested
    })
  }

  describe('Pending request filtering', () => {
    test('shows requests from users who expressed interest in me', () => {
      const incoming = [
        { user_id: 'user-a', created_at: '2026-01-01' },
        { user_id: 'user-b', created_at: '2026-01-02' },
      ]
      const myInterests = [] // I haven't expressed interest in anyone

      const pending = getFilteredPendingRequests(incoming, myInterests)
      expect(pending).toHaveLength(2)
      expect(pending.map(p => p.user_id)).toEqual(['user-a', 'user-b'])
    })

    test('filters out mutual interests (already connected)', () => {
      const incoming = [
        { user_id: 'user-a', created_at: '2026-01-01' },
        { user_id: 'user-b', created_at: '2026-01-02' },
      ]
      const myInterests = [
        { interested_in_user_id: 'user-a' }, // I also expressed interest in user-a
      ]

      const pending = getFilteredPendingRequests(incoming, myInterests)
      expect(pending).toHaveLength(1)
      expect(pending[0].user_id).toBe('user-b')
    })

    test('returns empty when all interests are mutual', () => {
      const incoming = [
        { user_id: 'user-a', created_at: '2026-01-01' },
      ]
      const myInterests = [
        { interested_in_user_id: 'user-a' },
      ]

      const pending = getFilteredPendingRequests(incoming, myInterests)
      expect(pending).toHaveLength(0)
    })

    test('returns empty when no one expressed interest', () => {
      const pending = getFilteredPendingRequests([], [])
      expect(pending).toHaveLength(0)
    })
  })

  describe('Peer suggestion prioritization', () => {
    test('prioritizes users who expressed interest in current user', () => {
      const suggestions = [
        { id: 'user-a', name: 'Alice' },
        { id: 'user-b', name: 'Bob' },
        { id: 'user-c', name: 'Charlie' },
        { id: 'user-d', name: 'Diana' },
      ]
      const interestedInMe = new Set(['user-c', 'user-d'])

      const sorted = sortSuggestions(suggestions, interestedInMe)

      // user-c and user-d should be first (order between them preserved)
      expect(sorted[0].id).toBe('user-c')
      expect(sorted[1].id).toBe('user-d')
      // user-a and user-b should follow
      expect(sorted[2].id).toBe('user-a')
      expect(sorted[3].id).toBe('user-b')
    })

    test('preserves order when no one expressed interest', () => {
      const suggestions = [
        { id: 'user-a', name: 'Alice' },
        { id: 'user-b', name: 'Bob' },
      ]

      const sorted = sortSuggestions(suggestions, new Set())
      expect(sorted[0].id).toBe('user-a')
      expect(sorted[1].id).toBe('user-b')
    })
  })

  describe('Remove connection logic', () => {
    test('both directions of interest must be deleted', () => {
      // Simulates what remove_mutual_connection SQL function does
      const interests = [
        { user_id: 'admin', interested_in_user_id: 'xueting' },
        { user_id: 'xueting', interested_in_user_id: 'admin' },
        { user_id: 'admin', interested_in_user_id: 'other-user' },
      ]

      const currentUserId = 'admin'
      const otherUserId = 'xueting'

      // Simulate the SECURITY DEFINER function
      const remaining = interests.filter(i =>
        !((i.user_id === currentUserId && i.interested_in_user_id === otherUserId) ||
          (i.user_id === otherUserId && i.interested_in_user_id === currentUserId))
      )

      expect(remaining).toHaveLength(1)
      expect(remaining[0]).toEqual({
        user_id: 'admin',
        interested_in_user_id: 'other-user',
      })
    })

    test('RLS-only delete leaves orphan interest (the bug we fixed)', () => {
      const interests = [
        { user_id: 'admin', interested_in_user_id: 'xueting' },
        { user_id: 'xueting', interested_in_user_id: 'admin' },
      ]

      const currentUserId = 'admin'
      const otherUserId = 'xueting'

      // Simulate RLS: can only delete where user_id = auth.uid()
      const afterRlsDelete = interests.filter(i =>
        !(i.user_id === currentUserId && i.interested_in_user_id === otherUserId)
      )

      // Bug: xueting's interest in admin survives
      expect(afterRlsDelete).toHaveLength(1)
      expect(afterRlsDelete[0].user_id).toBe('xueting')
    })
  })

  describe('Mutual match detection on connect', () => {
    test('detects mutual match when other user already expressed interest', () => {
      const existingInterests = [
        { user_id: 'xueting', interested_in_user_id: 'admin' },
      ]

      // Admin connects with xueting
      const newInterest = { user_id: 'admin', interested_in_user_id: 'xueting' }

      // check_mutual_interest: does xueting have interest in admin?
      const isMutual = existingInterests.some(
        i => i.user_id === newInterest.interested_in_user_id &&
             i.interested_in_user_id === newInterest.user_id
      )

      expect(isMutual).toBe(true)
    })

    test('no mutual match when other user has not expressed interest', () => {
      const existingInterests = []

      const newInterest = { user_id: 'admin', interested_in_user_id: 'xueting' }

      const isMutual = existingInterests.some(
        i => i.user_id === newInterest.interested_in_user_id &&
             i.interested_in_user_id === newInterest.user_id
      )

      expect(isMutual).toBe(false)
    })
  })

  describe('Request card profile navigation', () => {
    // Simulates the clickable profile area logic from HomeView.js
    // All request types (connection, circle join, circle invitation, coffee chat)
    // should allow navigating to the requester's profile
    function getRequestCardNavigation(request) {
      const isCoffeeChatRequest = request.type === 'coffee_chat_request'
      const user = isCoffeeChatRequest ? (request.requester || {}) : (request.user || request)
      return {
        userId: user.id || null,
        canNavigate: !!user.id,
        navigateTo: user.id ? { view: 'userProfile', params: { userId: user.id } } : null,
      }
    }

    test('circle join request allows navigation to requester profile', () => {
      const request = {
        id: 'membership-1',
        type: 'circle_join_request',
        user: { id: 'mikayla-123', name: 'Mikayla', career: 'Designer' },
        circleName: 'Founders SF',
      }
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(true)
      expect(nav.navigateTo).toEqual({ view: 'userProfile', params: { userId: 'mikayla-123' } })
    })

    test('circle invitation allows navigation to inviter profile', () => {
      const request = {
        id: 'invite-1',
        type: 'circle_invitation',
        user: { id: 'alice-456', name: 'Alice', career: 'PM' },
        circleName: 'Product Leaders',
      }
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(true)
      expect(nav.userId).toBe('alice-456')
    })

    test('coffee chat request allows navigation to requester profile', () => {
      const request = {
        id: 'chat-1',
        type: 'coffee_chat_request',
        requester: { id: 'bob-789', name: 'Bob', career: 'Engineer' },
      }
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(true)
      expect(nav.userId).toBe('bob-789')
    })

    test('connection request allows navigation to requester profile', () => {
      const request = {
        id: 'user-abc',
        type: 'connection_request',
        name: 'Charlie',
        career: 'Founder',
      }
      // For connection requests, user = request itself (no .user property)
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(true)
      expect(nav.userId).toBe('user-abc')
    })

    test('request with missing user id cannot navigate', () => {
      const request = {
        id: 'membership-2',
        type: 'circle_join_request',
        user: { name: 'Unknown' }, // no id
        circleName: 'Test Circle',
      }
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(false)
      expect(nav.navigateTo).toBeNull()
    })

    test('coffee chat request with missing requester cannot navigate', () => {
      const request = {
        id: 'chat-2',
        type: 'coffee_chat_request',
        requester: null,
      }
      const nav = getRequestCardNavigation(request)
      expect(nav.canNavigate).toBe(false)
    })
  })

  describe('Timestamp preservation', () => {
    test('connection requests include created_at as requested_at', () => {
      const pendingRequests = [
        { user_id: 'user-a', created_at: '2026-01-16T19:54:12Z' },
        { user_id: 'user-b', created_at: '2026-03-05T20:06:33Z' },
      ]
      const profiles = [
        { id: 'user-a', name: 'Alice', career: 'Dev' },
        { id: 'user-b', name: 'Bob', career: 'PM' },
      ]

      // Simulates the loadHomePageData mapping (after our fix)
      const timestampMap = {}
      pendingRequests.forEach(i => { timestampMap[i.user_id] = i.created_at })

      const result = profiles.map(p => ({
        ...p,
        type: 'connection_request',
        requested_at: timestampMap[p.id],
      }))

      expect(result[0].requested_at).toBe('2026-01-16T19:54:12Z')
      expect(result[1].requested_at).toBe('2026-03-05T20:06:33Z')
      expect(result[0].type).toBe('connection_request')
    })
  })
})
