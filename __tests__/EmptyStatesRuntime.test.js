import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock useSupabaseQuery to return empty data
jest.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({ data: [], isLoading: false, mutate: jest.fn() }),
  invalidateQuery: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))

import AllPeopleView from '@/components/AllPeopleView'
import AllCirclesView from '@/components/AllCirclesView'

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null }),
    then: (r) => r({ data: [], error: null }),
  })),
  rpc: jest.fn().mockResolvedValue({ data: [] }),
}

const currentUser = { id: 'me', name: 'Test User', username: 'test.user' }
const mockNavigate = jest.fn()

describe('Empty States — Runtime Render', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('AllPeopleView — empty', () => {
    test('shows warm heading "No people found"', () => {
      render(<AllPeopleView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      expect(screen.getByText('No people found')).toBeInTheDocument()
    })

    test('shows guidance text', () => {
      render(<AllPeopleView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      expect(screen.getByText(/Try a different search or filter/)).toBeInTheDocument()
    })

    test('shows "Join a Circle" CTA button', () => {
      render(<AllPeopleView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      expect(screen.getByText('Join a Circle')).toBeInTheDocument()
    })

    test('has a search icon in the empty state', () => {
      render(<AllPeopleView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      // The search icon is inside a circular container
      const heading = screen.getByText('No people found')
      expect(heading.closest('div')).toBeInTheDocument()
    })
  })

  describe('AllCirclesView — empty', () => {
    test('shows warm heading "No circles found"', () => {
      render(<AllCirclesView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      expect(screen.getByText('No circles found')).toBeInTheDocument()
    })

    test('shows guidance text', () => {
      render(<AllCirclesView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      expect(screen.getByText(/Try a different search/)).toBeInTheDocument()
    })

    test('shows "Create a Circle" CTA button in empty state', () => {
      render(<AllCirclesView currentUser={currentUser} supabase={mockSupabase} onNavigate={mockNavigate} />)
      const buttons = screen.getAllByText('Create a Circle')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })
  })
})
