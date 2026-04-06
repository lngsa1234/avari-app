import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock window.history.back
const mockHistoryBack = jest.fn()
Object.defineProperty(window, 'history', {
  value: { back: mockHistoryBack },
  writable: true,
})

// Mock supabase
const mockRpc = jest.fn()
const mockRange = jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
const mockOrder = jest.fn().mockReturnValue({ range: mockRange })
const mockSelect = jest.fn().mockReturnValue({ order: mockOrder })
const mockSupabase = {
  from: () => ({ select: mockSelect }),
  rpc: mockRpc,
}

jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/lib/designTokens', () => ({
  colors: {},
  fonts: { sans: 'sans-serif' },
}))

import AdminFeedbackView from '@/components/AdminFeedbackView'
import AdminAnalyticsView from '@/components/AdminAnalyticsView'

// ─── AdminFeedbackView tests ────────────────────────────────

describe('AdminFeedbackView — back navigation', () => {
  beforeEach(() => {
    mockHistoryBack.mockClear()
  })

  test('renders a back button', () => {
    render(
      <AdminFeedbackView
        currentUser={{ id: 'admin-1', role: 'admin' }}
        supabase={mockSupabase}
        onNavigate={jest.fn()}
      />
    )
    const backBtn = screen.getByText('← Back')
    expect(backBtn).toBeTruthy()
    expect(backBtn.tagName).toBe('BUTTON')
  })

  test('calls window.history.back() when back button is clicked', () => {
    render(
      <AdminFeedbackView
        currentUser={{ id: 'admin-1', role: 'admin' }}
        supabase={mockSupabase}
        onNavigate={jest.fn()}
      />
    )
    fireEvent.click(screen.getByText('← Back'))
    expect(mockHistoryBack).toHaveBeenCalledTimes(1)
  })
})

// ─── AdminAnalyticsView tests ───────────────────────────────

const mockAnalyticsData = {
  total_users: 10, total_onboarded: 5, total_coffee_chats: 3,
  total_meetup_signups: 2, total_circles: 1,
  dau: 2, wau: 5, mau: 8,
  signups_by_day: [], signups_by_week: [],
  onboarding_funnel: { total_signups: 10, completed_onboarding: 5, profile_50_plus: 3, profile_complete: 1 },
  activity_buckets: { active_today: 2, active_1_7d: 3, active_7_14d: 1, active_14_30d: 1, inactive_30d_plus: 3 },
  cohort_retention: [],
  engagement: {
    coffee_chats_completed: 1, coffee_chats_pending: 2,
    meetup_signups: 2, messages_sent: 10,
    circles_created: 1, circles_joined: 3,
    calls_made: 2, total_call_minutes: 45,
  },
  engagement_by_week: [],
  top_users: [],
}

describe('AdminAnalyticsView — back navigation', () => {
  beforeEach(() => {
    mockHistoryBack.mockClear()
    mockRpc.mockResolvedValue({ data: mockAnalyticsData, error: null })
  })

  test('renders a back button after data loads', async () => {
    render(
      <AdminAnalyticsView
        currentUser={{ id: 'admin-1', role: 'admin' }}
        supabase={mockSupabase}
      />
    )
    const backBtn = await screen.findByText('← Back')
    expect(backBtn).toBeTruthy()
    expect(backBtn.tagName).toBe('BUTTON')
  })

  test('calls window.history.back() when back button is clicked', async () => {
    render(
      <AdminAnalyticsView
        currentUser={{ id: 'admin-1', role: 'admin' }}
        supabase={mockSupabase}
      />
    )
    const backBtn = await screen.findByText('← Back')
    fireEvent.click(backBtn)
    expect(mockHistoryBack).toHaveBeenCalledTimes(1)
  })
})
