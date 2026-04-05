import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createMockSupabase } from './helpers/mockSupabase'

let mockProfileReturn = { data: null, isLoading: false, mutate: jest.fn() }
jest.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => mockProfileReturn,
  invalidateQuery: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))

import UserProfileView from '@/components/UserProfileView'

const mockNavigate = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() }

function setProfileData(profile, extras = {}) {
  mockProfileReturn = {
    data: {
      profile,
      isConnected: extras.isConnected || false,
      hasIncomingRequest: extras.hasIncomingRequest || false,
      hasSentRequest: extras.hasSentRequest || false,
      connectionCount: 0,
      mutualCircles: [],
      meetupCount: 0,
      activities: [],
    },
    isLoading: false,
    mutate: jest.fn(),
  }
}

describe('Private Profile — Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfileReturn = { data: null, isLoading: false, mutate: jest.fn() }
  })

  describe('Hidden Profile', () => {
    const mockSupabase = createMockSupabase({
      user_interests: { data: null, error: null },
    })

    beforeEach(() => {
      setProfileData({
        id: 'other-user-id', name: 'Secret Person',
        profile_visibility: 'hidden',
      })
    })

    test('back button navigates to previousView', () => {
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        previousView="allPeople"
        toast={mockToast}
      />)
      fireEvent.click(screen.getByLabelText('Go back'))
      expect(mockNavigate).toHaveBeenCalledWith('allPeople')
    })

    test('back button defaults to connectionGroups when no previousView', () => {
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      fireEvent.click(screen.getByLabelText('Go back'))
      expect(mockNavigate).toHaveBeenCalledWith('connectionGroups')
    })

    test('private card has role="status" for screen readers', () => {
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Connections-Only Profile', () => {
    const mockSupabase = createMockSupabase({
      user_interests: { data: null, error: null },
    })

    beforeEach(() => {
      setProfileData({
        id: 'other-user-id', name: 'Selective Person',
        profile_visibility: 'connections', avatar_url: null,
      })
    })

    test('Send Connection Request button calls supabase insert', async () => {
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      await act(async () => {
        fireEvent.click(screen.getByText('Send Connection Request'))
      })
      expect(mockSupabase.from).toHaveBeenCalledWith('user_interests')
    })

    test('shows fallback initial for names starting with lowercase', () => {
      setProfileData({
        id: 'other-user-id', name: 'emma jones',
        profile_visibility: 'connections', avatar_url: null,
      })
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      expect(screen.getByText('E')).toBeInTheDocument()
    })

    test('shows fallback "?" when name is empty', () => {
      setProfileData({
        id: 'other-user-id', name: '',
        profile_visibility: 'connections', avatar_url: null,
      })
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    test('shows "This member" when name is empty', () => {
      setProfileData({
        id: 'other-user-id', name: '',
        profile_visibility: 'connections', avatar_url: null,
      })
      render(<UserProfileView
        currentUser={{ id: 'me', name: 'Me' }}
        supabase={mockSupabase}
        userId="other-user-id"
        onNavigate={mockNavigate}
        toast={mockToast}
      />)
      expect(screen.getByText('This member')).toBeInTheDocument()
    })
  })
})
