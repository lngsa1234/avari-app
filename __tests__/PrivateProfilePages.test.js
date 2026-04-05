import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { createMockSupabase } from './helpers/mockSupabase'

// Mock useSupabaseQuery to control profile data
let mockProfileReturn = { data: null, isLoading: false, mutate: jest.fn() }
jest.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => mockProfileReturn,
  invalidateQuery: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({ supabase: {} }))

import UserProfileView from '@/components/UserProfileView'

const mockNavigate = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() }
const mockSupabase = createMockSupabase({
  user_interests: { data: null, error: null },
})

const baseProps = {
  currentUser: { id: 'current-user-id', name: 'Current User', username: 'current.user' },
  supabase: mockSupabase,
  userId: 'other-user-id',
  onNavigate: mockNavigate,
  previousView: 'allPeople',
  toast: mockToast,
}

function setProfileData(profile, extras = {}) {
  mockProfileReturn = {
    data: {
      profile,
      isConnected: extras.isConnected || false,
      hasIncomingRequest: false,
      hasSentRequest: false,
      connectionCount: 0,
      mutualCircles: [],
      meetupCount: 0,
      activities: [],
    },
    isLoading: false,
    mutate: jest.fn(),
  }
}

describe('Private Profile Pages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfileReturn = { data: null, isLoading: false, mutate: jest.fn() }
  })

  describe('Hidden Profile', () => {
    beforeEach(() => {
      setProfileData({
        id: 'other-user-id',
        name: 'Secret Person',
        profile_visibility: 'hidden',
      })
    })

    test('shows warm private profile page', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('This profile is private')).toBeInTheDocument()
    })

    test('shows empathetic message about privacy choice', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText("They've chosen to keep their profile private.")).toBeInTheDocument()
    })

    test('shows Browse People CTA button', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('Browse People')).toBeInTheDocument()
    })

    test('Browse People button navigates to allPeople', () => {
      render(<UserProfileView {...baseProps} />)
      fireEvent.click(screen.getByText('Browse People'))
      expect(mockNavigate).toHaveBeenCalledWith('allPeople')
    })

    test('does not show hidden guard for own profile', () => {
      render(<UserProfileView {...baseProps} userId="current-user-id" />)
      expect(screen.queryByText('This profile is private')).not.toBeInTheDocument()
    })
  })

  describe('Connections-Only Profile', () => {
    beforeEach(() => {
      setProfileData({
        id: 'other-user-id',
        name: 'Selective Person',
        profile_visibility: 'connections',
        avatar_url: null,
      })
    })

    test('shows name on gated profile', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('Selective Person')).toBeInTheDocument()
    })

    test('shows connect prompt message', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('Connect to see their full profile.')).toBeInTheDocument()
    })

    test('shows Send Connection Request button', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('Send Connection Request')).toBeInTheDocument()
    })

    test('shows avatar initial fallback when no avatar_url', () => {
      render(<UserProfileView {...baseProps} />)
      expect(screen.getByText('S')).toBeInTheDocument()
    })

    test('shows avatar image when avatar_url exists', () => {
      setProfileData({
        id: 'other-user-id',
        name: 'Selective Person',
        profile_visibility: 'connections',
        avatar_url: 'https://example.com/photo.jpg',
      })
      render(<UserProfileView {...baseProps} />)
      const img = screen.getByRole('presentation')
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    })

    test('does not show connections-only guard for own profile', () => {
      render(<UserProfileView {...baseProps} userId="current-user-id" />)
      expect(screen.queryByText('Connect to see their full profile.')).not.toBeInTheDocument()
    })

    test('does not show guard when user is connected', () => {
      setProfileData(
        { id: 'other-user-id', name: 'Selective Person', profile_visibility: 'connections' },
        { isConnected: true }
      )
      render(<UserProfileView {...baseProps} />)
      expect(screen.queryByText('Connect to see their full profile.')).not.toBeInTheDocument()
    })
  })

  describe('Public Profile', () => {
    test('does not show any privacy guard', () => {
      setProfileData({
        id: 'other-user-id',
        name: 'Open Person',
        profile_visibility: 'public',
      })
      render(<UserProfileView {...baseProps} />)
      expect(screen.queryByText('This profile is private')).not.toBeInTheDocument()
      expect(screen.queryByText('Connect to see their full profile.')).not.toBeInTheDocument()
    })
  })
})
