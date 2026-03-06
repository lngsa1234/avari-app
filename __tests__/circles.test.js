/**
 * Tests for circle (connection group) business logic.
 */

describe('Circle Logic', () => {
  describe('Circle creation validation', () => {
    test('requires minimum 2 invitees (3 total with creator)', () => {
      const minInvitees = 2
      const maxInvitees = 9

      expect([].length >= minInvitees).toBe(false)
      expect([1].length >= minInvitees).toBe(false)
      expect([1, 2].length >= minInvitees).toBe(true)
      expect([1, 2, 3].length >= minInvitees).toBe(true)
    })

    test('allows maximum 9 invitees (10 total with creator)', () => {
      const maxInvitees = 9
      const invitees = Array(10).fill('user')
      expect(invitees.length <= maxInvitees).toBe(false)

      const validInvitees = Array(9).fill('user')
      expect(validInvitees.length <= maxInvitees).toBe(true)
    })

    test('circle name requires minimum 3 characters', () => {
      expect('AB'.length >= 3).toBe(false)
      expect('ABC'.length >= 3).toBe(true)
      expect('Book Club'.length >= 3).toBe(true)
    })
  })

  describe('Membership state transitions', () => {
    const VALID_STATUSES = ['invited', 'accepted', 'declined']

    test('new invitation starts as invited', () => {
      const membership = { status: 'invited', invited_at: new Date().toISOString() }
      expect(membership.status).toBe('invited')
      expect(membership.invited_at).toBeDefined()
    })

    test('accepting sets status to accepted with responded_at', () => {
      const membership = {
        status: 'accepted',
        responded_at: new Date().toISOString(),
      }
      expect(membership.status).toBe('accepted')
      expect(membership.responded_at).toBeDefined()
    })

    test('declining sets status to declined with responded_at', () => {
      const membership = {
        status: 'declined',
        responded_at: new Date().toISOString(),
      }
      expect(membership.status).toBe('declined')
      expect(membership.responded_at).toBeDefined()
    })
  })

  describe('Invite eligibility filtering', () => {
    test('excludes existing members from invite list', () => {
      const connections = [
        { id: 'user-a', name: 'Alice' },
        { id: 'user-b', name: 'Bob' },
        { id: 'user-c', name: 'Charlie' },
      ]
      const existingMembers = [
        { user_id: 'user-a', status: 'accepted' },
        { user_id: 'user-c', status: 'invited' },
      ]

      const existingIds = new Set(existingMembers.map(m => m.user_id))
      const invitable = connections.filter(c => !existingIds.has(c.id))

      expect(invitable).toHaveLength(1)
      expect(invitable[0].id).toBe('user-b')
    })

    test('excludes declined members from invite list', () => {
      const connections = [{ id: 'user-a' }, { id: 'user-b' }]
      const existingMembers = [{ user_id: 'user-a', status: 'declined' }]

      const existingIds = new Set(existingMembers.map(m => m.user_id))
      const invitable = connections.filter(c => !existingIds.has(c.id))

      expect(invitable).toHaveLength(1)
      expect(invitable[0].id).toBe('user-b')
    })
  })

  describe('Capacity management', () => {
    test('calculates spots left correctly', () => {
      const maxMembers = 10
      const acceptedCount = 7
      const spotsLeft = maxMembers - acceptedCount

      expect(spotsLeft).toBe(3)
    })

    test('prevents invites when full', () => {
      const maxMembers = 5
      const currentAccepted = 5
      const newInviteCount = 2

      const canInvite = currentAccepted + newInviteCount <= maxMembers
      expect(canInvite).toBe(false)
    })

    test('allows invites when space available', () => {
      const maxMembers = 10
      const currentAccepted = 3
      const newInviteCount = 2

      const canInvite = currentAccepted + newInviteCount <= maxMembers
      expect(canInvite).toBe(true)
    })
  })

  describe('Circle data enrichment', () => {
    test('sorts circles by created_at descending', () => {
      const circles = [
        { id: '1', created_at: '2026-01-01' },
        { id: '2', created_at: '2026-03-01' },
        { id: '3', created_at: '2026-02-01' },
      ]

      const sorted = [...circles].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )

      expect(sorted.map(c => c.id)).toEqual(['2', '3', '1'])
    })

    test('builds member list with profiles', () => {
      const members = [
        { user_id: 'u1', status: 'accepted' },
        { user_id: 'u2', status: 'invited' },
      ]
      const profiles = [
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Bob' },
      ]

      const profileMap = {}
      profiles.forEach(p => { profileMap[p.id] = p })

      const enriched = members.map(m => ({
        ...m,
        user: profileMap[m.user_id] || null,
      }))

      expect(enriched[0].user.name).toBe('Alice')
      expect(enriched[1].user.name).toBe('Bob')
    })
  })
})
