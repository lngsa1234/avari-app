/**
 * Component integration tests for circle invite/join request flows.
 *
 * These tests render real components with mocked Supabase data and verify
 * what the DOM actually shows. This catches bugs that live in the wiring
 * between queries and rendering — the exact layer where the invite/join
 * request bugs existed.
 *
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// ─── Mock modules (must be before component imports) ─────────────────────

jest.mock('@/lib/supabase', () => ({ supabase: {} }))

jest.mock('@/lib/connectionGroupHelpers', () => ({
  checkGroupEligibility: jest.fn(),
  getEligibleConnections: jest.fn().mockResolvedValue([]),
  createConnectionGroup: jest.fn(),
  acceptGroupInvite: jest.fn(),
  declineGroupInvite: jest.fn(),
  createConnectionGroupRoom: jest.fn(),
  deleteConnectionGroup: jest.fn(),
  sendGroupMessage: jest.fn(),
  getGroupMessages: jest.fn().mockResolvedValue([]),
  deleteGroupMessage: jest.fn(),
}))

jest.mock('@/lib/circleMeetupHelpers', () => ({
  getOrCreateCircleMeetups: jest.fn().mockResolvedValue([]),
  loadCircleMeetups: jest.fn().mockResolvedValue([]),
  createCircleMeetup: jest.fn(),
  updateCircleMeetup: jest.fn(),
  deleteCircleMeetup: jest.fn(),
  rsvpToCircleMeetup: jest.fn(),
  cancelCircleMeetupRsvp: jest.fn(),
}))

// Track what useSupabaseQuery returns per key
const swrDataMap = {}
jest.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (key) => ({
    data: key ? swrDataMap[key] : undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
    error: null,
  }),
  invalidateQuery: jest.fn(),
}))

// Mock supabase client passed as prop
function createMockSupabase(overrides = {}) {
  return {
    from: jest.fn((table) => {
      if (overrides[table]) return overrides[table]
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
          not: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }
    }),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
}

// ─── Component imports (after mocks) ─────────────────────────────────────

import ConnectionGroupsView from '@/components/ConnectionGroupsView'
import CircleDetailView from '@/components/CircleDetailView'

// ─── Test data ───────────────────────────────────────────────────────────

const adminUser = { id: 'admin-001', name: 'Admin' }
const memberUser = { id: 'member-001', name: 'Xueting' }
const joinerUser = { id: 'joiner-001', name: 'Echo' }

const uxCircle = {
  id: 'circle-001',
  name: 'UX Refinement',
  creator_id: 'admin-001',
  created_at: '2026-01-01',
  is_active: true,
  max_members: 10,
}

// ─── ConnectionGroupsView tests ──────────────────────────────────────────

describe('ConnectionGroupsView - Sent Requests section', () => {
  afterEach(() => {
    Object.keys(swrDataMap).forEach(k => delete swrDataMap[k])
  })

  test('pending join request does NOT show as "Invited to" in Sent Requests', () => {
    // Admin's circle has Echo with status='pending' (join request)
    // sentCircleInvites should be empty — pending should NOT be included
    swrDataMap[`circles-page-${adminUser.id}`] = {
      connectionGroups: [{
        ...uxCircle,
        members: [{ user_id: adminUser.id, status: 'accepted', profile: { name: 'Admin' } }],
        memberCount: 1,
        creator: { name: 'Admin' },
      }],
      groupInvites: [],
      pendingJoinRequests: [],
      unreadCounts: {},
      connections: [],
      sharedMatches: [],
    }
    swrDataMap[`circles-sent-invites-${adminUser.id}`] = []
    swrDataMap[`circles-sent-requests-${adminUser.id}`] = []

    render(
      <ConnectionGroupsView
        currentUser={adminUser}
        supabase={createMockSupabase()}
        connections={[]}
        onNavigate={jest.fn()}
        toast={jest.fn()}
      />
    )

    // "Sent Requests" section should NOT appear
    expect(screen.queryByText('Sent Requests')).not.toBeInTheDocument()
    // "Invited to" should NOT appear
    expect(screen.queryByText(/Invited to/)).not.toBeInTheDocument()
    // Echo's name should NOT appear
    expect(screen.queryByText('Echo')).not.toBeInTheDocument()
  })

  test('admin-sent invite DOES show as "Invited to" in Sent Requests', () => {
    swrDataMap[`circles-page-${adminUser.id}`] = {
      connectionGroups: [{
        ...uxCircle,
        members: [{ user_id: adminUser.id, status: 'accepted', profile: { name: 'Admin' } }],
        memberCount: 1,
        creator: { name: 'Admin' },
      }],
      groupInvites: [],
      pendingJoinRequests: [],
      unreadCounts: {},
      connections: [],
      sharedMatches: [],
    }
    // Admin actually invited Echo — this SHOULD show
    swrDataMap[`circles-sent-invites-${adminUser.id}`] = [{
      id: 'membership-001',
      user: { id: joinerUser.id, name: 'Echo', career: 'Designer', profile_picture: null },
      circleName: 'UX Refinement',
      groupId: uxCircle.id,
      invited_at: '2026-04-01T00:00:00Z',
    }]
    swrDataMap[`circles-sent-requests-${adminUser.id}`] = []

    render(
      <ConnectionGroupsView
        currentUser={adminUser}
        supabase={createMockSupabase()}
        connections={[]}
        onNavigate={jest.fn()}
        toast={jest.fn()}
      />
    )

    expect(screen.getByText('Sent Requests')).toBeInTheDocument()
    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(screen.getByText(/Invited to/)).toBeInTheDocument()
    // "UX Refinement" appears both in circle card and sent request — check within Invited text
    expect(screen.getByText(/Invited to/).textContent).toContain('UX Refinement')
    expect(screen.getAllByText('Withdraw').length).toBeGreaterThan(0)
  })

  test('user own pending join request shows as "Join request pending"', () => {
    swrDataMap[`circles-page-${joinerUser.id}`] = {
      connectionGroups: [],
      groupInvites: [],
      pendingJoinRequests: [{
        id: 'membership-002',
        group_id: uxCircle.id,
        invited_at: '2026-04-01T00:00:00Z',
        groupName: 'UX Refinement',
      }],
      unreadCounts: {},
      connections: [],
      sharedMatches: [],
    }
    swrDataMap[`circles-sent-invites-${joinerUser.id}`] = []
    swrDataMap[`circles-sent-requests-${joinerUser.id}`] = []

    render(
      <ConnectionGroupsView
        currentUser={joinerUser}
        supabase={createMockSupabase()}
        connections={[]}
        onNavigate={jest.fn()}
        toast={jest.fn()}
      />
    )

    expect(screen.getByText('Sent Requests')).toBeInTheDocument()
    expect(screen.getByText('UX Refinement')).toBeInTheDocument()
    expect(screen.getByText(/Join request pending/)).toBeInTheDocument()
    // Must NOT show "Invited to"
    expect(screen.queryByText(/Invited to/)).not.toBeInTheDocument()
  })

  test('both sent invites and pending join requests show correctly together', () => {
    swrDataMap[`circles-page-${adminUser.id}`] = {
      connectionGroups: [{
        ...uxCircle,
        members: [{ user_id: adminUser.id, status: 'accepted', profile: { name: 'Admin' } }],
        memberCount: 1,
        creator: { name: 'Admin' },
      }],
      groupInvites: [],
      // Admin also requested to join another circle
      pendingJoinRequests: [{
        id: 'membership-003',
        group_id: 'circle-002',
        invited_at: '2026-04-02T00:00:00Z',
        groupName: 'Book Club',
      }],
      unreadCounts: {},
      connections: [],
      sharedMatches: [],
    }
    // Admin invited Echo to UX Refinement
    swrDataMap[`circles-sent-invites-${adminUser.id}`] = [{
      id: 'membership-001',
      user: { id: joinerUser.id, name: 'Echo', career: 'Designer', profile_picture: null },
      circleName: 'UX Refinement',
      groupId: uxCircle.id,
      invited_at: '2026-04-01T00:00:00Z',
    }]
    swrDataMap[`circles-sent-requests-${adminUser.id}`] = []

    render(
      <ConnectionGroupsView
        currentUser={adminUser}
        supabase={createMockSupabase()}
        connections={[]}
        onNavigate={jest.fn()}
        toast={jest.fn()}
      />
    )

    expect(screen.getByText('Sent Requests')).toBeInTheDocument()
    // Sent invite shows correctly
    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(screen.getByText(/Invited to/)).toBeInTheDocument()
    // Own pending join request shows correctly
    expect(screen.getByText('Book Club')).toBeInTheDocument()
    expect(screen.getByText(/Join request pending/)).toBeInTheDocument()
    // Badge count should be 2
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

// ─── CircleDetailView tests ──────────────────────────────────────────────

describe('CircleDetailView - membership states', () => {
  function buildCircleSupabase(circleData, membersData, hostData) {
    return createMockSupabase({
      connection_groups: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: circleData, error: null }),
          }),
        }),
      },
      connection_group_members: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: membersData, error: null }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null, count: 1 }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      },
      profiles: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: hostData, error: null }),
          }),
          in: jest.fn().mockResolvedValue({
            data: membersData.map(m => m.profile).filter(Boolean),
            error: null,
          }),
        }),
      },
      circle_meetups: {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      },
    })
  }

  test('host sees "Join Requests" section with Accept/Decline for pending members', async () => {
    const membersData = [
      { id: 'm1', user_id: adminUser.id, status: 'accepted', profile: { id: adminUser.id, name: 'Admin', career: 'CEO' } },
      { id: 'm2', user_id: joinerUser.id, status: 'pending', profile: { id: joinerUser.id, name: 'Echo', career: 'Designer' } },
    ]

    render(
      <CircleDetailView
        currentUser={adminUser}
        supabase={buildCircleSupabase(uxCircle, membersData, { id: adminUser.id, name: 'Admin' })}
        onNavigate={jest.fn()}
        circleId={uxCircle.id}
        previousView="allCircles"
        toast={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Join Requests')).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.getByText('Echo')).toBeInTheDocument()
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  test('non-host member does NOT see "Join Requests" section', async () => {
    const membersData = [
      { id: 'm1', user_id: adminUser.id, status: 'accepted', profile: { id: adminUser.id, name: 'Admin' } },
      { id: 'm2', user_id: memberUser.id, status: 'accepted', profile: { id: memberUser.id, name: 'Xueting' } },
      { id: 'm3', user_id: joinerUser.id, status: 'pending', profile: { id: joinerUser.id, name: 'Echo' } },
    ]

    render(
      <CircleDetailView
        currentUser={memberUser}
        supabase={buildCircleSupabase(uxCircle, membersData, { id: adminUser.id, name: 'Admin' })}
        onNavigate={jest.fn()}
        circleId={uxCircle.id}
        previousView="allCircles"
        toast={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Members')).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.queryByText('Join Requests')).not.toBeInTheDocument()
    expect(screen.queryByText('Accept')).not.toBeInTheDocument()
  })

  test('host sees "Pending Invites" for invited (not yet accepted) members', async () => {
    const membersData = [
      { id: 'm1', user_id: adminUser.id, status: 'accepted', profile: { id: adminUser.id, name: 'Admin' } },
      { id: 'm2', user_id: joinerUser.id, status: 'invited', profile: { id: joinerUser.id, name: 'Echo' } },
    ]

    render(
      <CircleDetailView
        currentUser={adminUser}
        supabase={buildCircleSupabase(uxCircle, membersData, { id: adminUser.id, name: 'Admin' })}
        onNavigate={jest.fn()}
        circleId={uxCircle.id}
        previousView="allCircles"
        toast={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Pending Invites')).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.getByText('Echo')).toBeInTheDocument()
  })

  test('invited user sees "You\'re Invited" banner, not "Request Pending"', async () => {
    const membersData = [
      { id: 'm1', user_id: adminUser.id, status: 'accepted', profile: { id: adminUser.id, name: 'Admin' } },
      { id: 'm2', user_id: joinerUser.id, status: 'invited', profile: { id: joinerUser.id, name: 'Echo' } },
    ]

    render(
      <CircleDetailView
        currentUser={joinerUser}
        supabase={buildCircleSupabase(uxCircle, membersData, { id: adminUser.id, name: 'Admin' })}
        onNavigate={jest.fn()}
        circleId={uxCircle.id}
        previousView="allCircles"
        toast={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("You're Invited")).toBeInTheDocument()
    }, { timeout: 5000 })

    expect(screen.getByText(/invited you to this circle/)).toBeInTheDocument()
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  test('pending requester sees "Request Pending", not "You\'re Invited"', async () => {
    const membersData = [
      { id: 'm1', user_id: adminUser.id, status: 'accepted', profile: { id: adminUser.id, name: 'Admin', career: 'CEO' } },
      { id: 'm2', user_id: joinerUser.id, status: 'pending', profile: { id: joinerUser.id, name: 'Echo', career: 'Designer' } },
    ]

    render(
      <CircleDetailView
        currentUser={joinerUser}
        supabase={buildCircleSupabase(uxCircle, membersData, { id: adminUser.id, name: 'Admin' })}
        onNavigate={jest.fn()}
        circleId={uxCircle.id}
        previousView="allCircles"
        toast={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText('Request Pending').length).toBeGreaterThan(0)
    }, { timeout: 5000 })

    expect(screen.queryByText("You're Invited")).not.toBeInTheDocument()
  })
})
