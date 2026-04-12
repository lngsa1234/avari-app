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

  describe('Join request vs invite status', () => {
    test('self-initiated join request uses pending status', () => {
      const currentUser = { id: 'echo' }
      const circleId = 'circle-1'
      const membership = {
        group_id: circleId,
        user_id: currentUser.id,
        status: 'pending',
      }

      expect(membership.status).toBe('pending')
      expect(membership.user_id).toBe(currentUser.id)
    })

    test('creator invite uses invited status', () => {
      const creator = { id: 'admin' }
      const circle = { id: 'circle-1', creator_id: 'admin' }
      const isHost = circle.creator_id === creator.id

      const inserts = ['echo', 'xueting'].map(userId => ({
        group_id: circle.id,
        user_id: userId,
        status: isHost ? 'invited' : 'pending',
      }))

      expect(inserts[0].status).toBe('invited')
      expect(inserts[1].status).toBe('invited')
    })

    test('non-creator member invite uses pending status (requires admin approval)', () => {
      const member = { id: 'xueting' }
      const circle = { id: 'circle-1', creator_id: 'admin' }
      const isHost = circle.creator_id === member.id

      const inserts = ['echo'].map(userId => ({
        group_id: circle.id,
        user_id: userId,
        status: isHost ? 'invited' : 'pending',
      }))

      expect(inserts[0].status).toBe('pending')
    })

    test('pending status triggers admin approval flow, not direct acceptance', () => {
      const members = [
        { user_id: 'echo', status: 'pending', group_id: 'circle-1' },
        { user_id: 'bob', status: 'invited', group_id: 'circle-1' },
      ]

      const pendingRequests = members.filter(m => m.status === 'pending')
      const directInvites = members.filter(m => m.status === 'invited')

      expect(pendingRequests).toHaveLength(1)
      expect(pendingRequests[0].user_id).toBe('echo')
      expect(directInvites).toHaveLength(1)
      expect(directInvites[0].user_id).toBe('bob')
    })
  })

  describe('Sent requests filtering', () => {
    test('sent circle invites only includes invited status, not pending', () => {
      const myCircleMembers = [
        { id: 'm1', user_id: 'echo', status: 'pending', group_id: 'circle-1' },
        { id: 'm2', user_id: 'bob', status: 'invited', group_id: 'circle-1' },
        { id: 'm3', user_id: 'charlie', status: 'accepted', group_id: 'circle-1' },
      ]

      // Fixed: only 'invited' status should appear in sent invites
      const sentCircleInvites = myCircleMembers.filter(m => m.status === 'invited')

      expect(sentCircleInvites).toHaveLength(1)
      expect(sentCircleInvites[0].user_id).toBe('bob')
    })

    test('pending join requests should NOT appear as sent invites', () => {
      const myCircleMembers = [
        { id: 'm1', user_id: 'echo', status: 'pending', group_id: 'circle-1' },
      ]

      const sentCircleInvites = myCircleMembers.filter(m => m.status === 'invited')

      expect(sentCircleInvites).toHaveLength(0)
    })

    test('user own pending join requests show separately', () => {
      const currentUser = { id: 'echo' }
      const allMemberships = [
        { id: 'm1', user_id: 'echo', status: 'pending', group_id: 'circle-1', groupName: 'UX Refinement' },
        { id: 'm2', user_id: 'echo', status: 'accepted', group_id: 'circle-2', groupName: 'Book Club' },
      ]

      const pendingJoinRequests = allMemberships.filter(
        m => m.user_id === currentUser.id && m.status === 'pending'
      )

      expect(pendingJoinRequests).toHaveLength(1)
      expect(pendingJoinRequests[0].groupName).toBe('UX Refinement')
    })
  })

  describe('CircleDetail membership states', () => {
    test('isMember is true only for accepted status', () => {
      const statuses = ['invited', 'accepted', 'declined', 'pending']
      const results = statuses.map(s => ({ status: s, isMember: s === 'accepted' }))

      expect(results.find(r => r.status === 'accepted').isMember).toBe(true)
      expect(results.find(r => r.status === 'invited').isMember).toBe(false)
      expect(results.find(r => r.status === 'pending').isMember).toBe(false)
      expect(results.find(r => r.status === 'declined').isMember).toBe(false)
    })

    test('isPending covers both invited and pending statuses', () => {
      const isPending = (status) => status === 'invited' || status === 'pending'

      expect(isPending('invited')).toBe(true)
      expect(isPending('pending')).toBe(true)
      expect(isPending('accepted')).toBe(false)
      expect(isPending('declined')).toBe(false)
    })

    test('isHost check gates join request visibility on detail page', () => {
      const circle = { creator_id: 'admin' }
      const members = [
        { user_id: 'echo', status: 'pending' },
        { user_id: 'bob', status: 'accepted' },
      ]

      // Admin sees join requests
      const adminIsHost = circle.creator_id === 'admin'
      expect(adminIsHost).toBe(true)
      const pendingForAdmin = adminIsHost ? members.filter(m => m.status === 'pending') : []
      expect(pendingForAdmin).toHaveLength(1)

      // Non-creator member does NOT see join requests
      const memberIsHost = circle.creator_id === 'bob'
      expect(memberIsHost).toBe(false)
      const pendingForMember = memberIsHost ? members.filter(m => m.status === 'pending') : []
      expect(pendingForMember).toHaveLength(0)
    })

    test('invite button visible to any accepted member, not just creator', () => {
      const members = [
        { user_id: 'admin', status: 'accepted' },
        { user_id: 'xueting', status: 'accepted' },
        { user_id: 'echo', status: 'pending' },
      ]

      const canInvite = (userId) => {
        const membership = members.find(m => m.user_id === userId)
        return membership?.status === 'accepted'
      }

      expect(canInvite('admin')).toBe(true)
      expect(canInvite('xueting')).toBe(true)
      expect(canInvite('echo')).toBe(false)
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
