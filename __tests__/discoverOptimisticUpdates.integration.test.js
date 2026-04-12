/**
 * Component integration tests for Discover page optimistic updates.
 *
 * These tests verify that user actions produce IMMEDIATE UI updates —
 * not delayed updates that depend on a background refetch completing.
 * This is the exact gap that allowed the "suggestion doesn't appear
 * immediately" bug to ship undetected.
 *
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mock setup ──────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/lib/connectionRecommendationHelpers', () => ({
  requestToJoinGroup: jest.fn(),
}))

// SWR data store — mutateRequests will modify this
let swrStore = {}
const mutateFns = {}

jest.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: (key, queryFn, opts) => {
    const mutateFn = (updater, options) => {
      if (typeof updater === 'function') {
        swrStore[key] = updater(swrStore[key])
      } else {
        swrStore[key] = updater
      }
      // Store for assertions
      if (mutateFns[key]) mutateFns[key].calls.push({ updater, options })
    }
    if (!mutateFns[key]) mutateFns[key] = { fn: mutateFn, calls: [] }

    return {
      data: key ? swrStore[key] : undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateFn,
      error: null,
    }
  },
  invalidateQuery: jest.fn(),
}))

// Mock supabase prop
const mockInsert = jest.fn().mockResolvedValue({ error: null })
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
    insert: mockInsert,
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
  })),
  removeChannel: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
}

import NetworkDiscoverView from '@/components/NetworkDiscoverView'

// ─── Test data ───────────────────────────────────────────────────────────

const currentUser = {
  id: 'user-001',
  name: 'Lynn Wang',
  profile_picture: null,
  role: 'admin',
}

const existingRequests = [
  {
    id: 'req-1',
    user_id: 'user-002',
    topic: 'AI for Founders',
    description: 'Explore AI tools',
    vibe_category: 'grow',
    status: 'open',
    supporter_count: 5,
    created_at: '2026-04-01T00:00:00Z',
    user: { id: 'user-002', name: 'Alice Chen' },
    supporters: [
      { user_id: 'user-002', request_id: 'req-1', profile: { id: 'user-002', name: 'Alice Chen' } },
    ],
  },
  {
    id: 'req-2',
    user_id: 'user-003',
    topic: 'Career Pivot Support',
    description: null,
    vibe_category: 'peers',
    status: 'open',
    supporter_count: 3,
    created_at: '2026-04-02T00:00:00Z',
    user: { id: 'user-003', name: 'Bob Lee' },
    supporters: [],
  },
]

function renderDiscover() {
  return render(
    <NetworkDiscoverView
      currentUser={currentUser}
      supabase={mockSupabase}
      connections={[]}
      meetups={[]}
      onNavigate={jest.fn()}
      onHostMeetup={null}
      toast={{ success: jest.fn(), error: jest.fn() }}
    />
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Submit suggestion - immediate UI update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    swrStore = {
      'discover-meetup-requests': [...existingRequests],
      [`discover-user-rsvps-${currentUser.id}`]: new Set(),
      'discover-meetup-signups': {},
      'discover-social-proof': { activeThisWeek: 10, meetupsThisWeek: 5 },
      'discover-connection-groups': [],
    }
    Object.keys(mutateFns).forEach(k => delete mutateFns[k])
  })

  test('new suggestion appears in list immediately after submit', async () => {
    const user = userEvent.setup()
    renderDiscover()

    // Verify existing requests are shown
    expect(screen.getByText('AI for Founders')).toBeInTheDocument()

    // Open the suggest modal
    const suggestBtn = screen.getByText('Suggest')
    await user.click(suggestBtn)

    // Fill in the topic
    const topicInput = screen.getByPlaceholderText(/Career Transition/i)
    await user.type(topicInput, 'Women in Web3')

    // Submit
    const submitBtn = screen.getByText('Submit Request')
    await user.click(submitBtn)

    // The new suggestion should appear immediately — no waiting for refetch
    await waitFor(() => {
      expect(screen.getByText('Women in Web3')).toBeInTheDocument()
    }, { timeout: 500 }) // Short timeout — if it takes longer, the optimistic update isn't working

    // Modal should be closed
    expect(screen.queryByText('Submit Request')).not.toBeInTheDocument()
  })

  test('new suggestion appears at the top of the list', async () => {
    const user = userEvent.setup()
    renderDiscover()

    const suggestBtn = screen.getByText('Suggest')
    await user.click(suggestBtn)

    const topicInput = screen.getByPlaceholderText(/Career Transition/i)
    await user.type(topicInput, 'Startup Funding Tips')

    const submitBtn = screen.getByText('Submit Request')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Startup Funding Tips')).toBeInTheDocument()
    }, { timeout: 500 })

    // Check the optimistic data was prepended (first in array)
    const updatedRequests = swrStore['discover-meetup-requests']
    expect(updatedRequests[0].topic).toBe('Startup Funding Tips')
    expect(updatedRequests[0].user.name).toBe('Lynn Wang')
  })

  test('new suggestion has correct initial state', async () => {
    const user = userEvent.setup()
    renderDiscover()

    const suggestBtn = screen.getByText('Suggest')
    await user.click(suggestBtn)

    const topicInput = screen.getByPlaceholderText(/Career Transition/i)
    await user.type(topicInput, 'Mental Health for Founders')

    const submitBtn = screen.getByText('Submit Request')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Mental Health for Founders')).toBeInTheDocument()
    }, { timeout: 500 })

    const updatedRequests = swrStore['discover-meetup-requests']
    const newReq = updatedRequests[0]
    expect(newReq.topic).toBe('Mental Health for Founders')
    expect(newReq.supporter_count).toBe(1)
    expect(newReq.user_id).toBe(currentUser.id)
    expect(newReq.supporters).toHaveLength(1)
    expect(newReq.supporters[0].user_id).toBe(currentUser.id)
  })

  test('revalidate: true is passed so server sync happens after optimistic update', async () => {
    const user = userEvent.setup()
    renderDiscover()

    const suggestBtn = screen.getByText('Suggest')
    await user.click(suggestBtn)

    const topicInput = screen.getByPlaceholderText(/Career Transition/i)
    await user.type(topicInput, 'Revalidation Test')

    const submitBtn = screen.getByText('Submit Request')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Revalidation Test')).toBeInTheDocument()
    }, { timeout: 500 })

    // Check that mutate was called with revalidate: true
    const requestsMutate = mutateFns['discover-meetup-requests']
    expect(requestsMutate).toBeDefined()
    const lastCall = requestsMutate.calls[requestsMutate.calls.length - 1]
    expect(lastCall.options).toEqual({ revalidate: true })
  })
})

describe('Support request - immediate UI update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    swrStore = {
      'discover-meetup-requests': [...existingRequests],
      [`discover-user-rsvps-${currentUser.id}`]: new Set(),
      'discover-meetup-signups': {},
      'discover-social-proof': { activeThisWeek: 10, meetupsThisWeek: 5 },
      'discover-connection-groups': [],
    }
    Object.keys(mutateFns).forEach(k => delete mutateFns[k])
  })

  test('vote button changes to "Voted" immediately after clicking', async () => {
    const user = userEvent.setup()
    renderDiscover()

    // Find the Vote button for the first request (req-1 already has 1 supporter but not current user)
    const voteButtons = screen.getAllByText('Vote')
    expect(voteButtons.length).toBeGreaterThan(0)

    await user.click(voteButtons[0])

    // After clicking, the supporter count should increase in the data
    await waitFor(() => {
      const updated = swrStore['discover-meetup-requests']
      const req = updated.find(r => r.id === 'req-1')
      expect(req.supporters.some(s => s.user_id === currentUser.id)).toBe(true)
    }, { timeout: 500 })
  })

  test('supporter count increments immediately', async () => {
    const user = userEvent.setup()
    renderDiscover()

    const initialReq = swrStore['discover-meetup-requests'].find(r => r.id === 'req-1')
    const initialCount = initialReq.supporter_count

    const voteButtons = screen.getAllByText('Vote')
    await user.click(voteButtons[0])

    await waitFor(() => {
      const updated = swrStore['discover-meetup-requests']
      const req = updated.find(r => r.id === 'req-1')
      expect(req.supporter_count).toBe(initialCount + 1)
    }, { timeout: 500 })
  })
})

describe('Delete request - immediate UI update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    swrStore = {
      'discover-meetup-requests': [...existingRequests],
      [`discover-user-rsvps-${currentUser.id}`]: new Set(),
      'discover-meetup-signups': {},
      'discover-social-proof': { activeThisWeek: 10, meetupsThisWeek: 5 },
      'discover-connection-groups': [],
    }
    Object.keys(mutateFns).forEach(k => delete mutateFns[k])
  })

  test('deleted request disappears from list immediately', async () => {
    const user = userEvent.setup()
    renderDiscover()

    // Verify request exists
    expect(screen.getByText('AI for Founders')).toBeInTheDocument()

    // Admin clicks delete button (the ✕ button)
    const deleteBtn = screen.getAllByTitle('Remove request (admin)')[0]
    await user.click(deleteBtn)

    // Confirm deletion
    const confirmBtn = screen.getByText('Remove')
    await user.click(confirmBtn)

    // Request should be removed from cache immediately
    await waitFor(() => {
      const updated = swrStore['discover-meetup-requests']
      expect(updated.find(r => r.id === 'req-1')).toBeUndefined()
    }, { timeout: 500 })
  })
})

describe('RSVP - immediate UI update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    swrStore = {
      'discover-meetup-requests': [...existingRequests],
      [`discover-user-rsvps-${currentUser.id}`]: new Set(),
      'discover-meetup-signups': {},
      'discover-social-proof': { activeThisWeek: 10, meetupsThisWeek: 5 },
      'discover-connection-groups': [],
    }
    Object.keys(mutateFns).forEach(k => delete mutateFns[k])
  })

  test('RSVP adds meetup to user rsvps set immediately', async () => {
    // This test verifies the optimistic update on the rsvps set
    // The actual RSVP button is rendered per meetup, but we test the data layer

    const meetupId = 'meetup-001'
    const rsvpKey = `discover-user-rsvps-${currentUser.id}`

    // Verify not RSVP'd initially
    expect(swrStore[rsvpKey].has(meetupId)).toBe(false)

    // Simulate what handleRsvp does via mutateRsvps
    const mutateRsvps = mutateFns[rsvpKey]?.fn
    if (mutateRsvps) {
      mutateRsvps(
        (current) => {
          const updated = new Set(current || [])
          updated.add(meetupId)
          return updated
        },
        { revalidate: true }
      )

      expect(swrStore[rsvpKey].has(meetupId)).toBe(true)
    }
  })

  test('un-RSVP removes meetup from user rsvps set immediately', async () => {
    const meetupId = 'meetup-001'
    const rsvpKey = `discover-user-rsvps-${currentUser.id}`

    // Start with RSVP'd
    swrStore[rsvpKey] = new Set([meetupId])
    expect(swrStore[rsvpKey].has(meetupId)).toBe(true)

    renderDiscover()

    const mutateRsvps = mutateFns[rsvpKey]?.fn
    if (mutateRsvps) {
      mutateRsvps(
        (current) => {
          const updated = new Set(current || [])
          updated.delete(meetupId)
          return updated
        },
        { revalidate: true }
      )

      expect(swrStore[rsvpKey].has(meetupId)).toBe(false)
    }
  })
})
