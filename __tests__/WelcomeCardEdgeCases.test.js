import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/home',
}))
jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', name: 'Test', username: 'test' } }),
}))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/hooks/useHomeData', () => () => ({
  meetups: [], loadingMeetups: false, signups: {}, userSignups: [],
  upcomingCoffeeChats: [], groupsCount: 0, coffeeChatsCount: 0,
  unreadMessageCount: 0, connectionRequests: [], circleJoinRequests: [],
  circleInvitations: [], homeEventRecs: [], homeCircleRecs: [],
  homePeopleRecs: [], homeRecsLoaded: false,
  handleAcceptCircleJoin: jest.fn(), handleDeclineCircleJoin: jest.fn(),
  handleAcceptCircleInvitation: jest.fn(), handleDeclineCircleInvitation: jest.fn(),
  loadHomePageData: jest.fn(), loadConnectionRequests: jest.fn(),
  loadMeetupsFromDatabase: jest.fn(), loadUserSignups: jest.fn(),
  loadSignupsForMeetups: jest.fn(), refreshCoffeeChats: jest.fn(),
}))
jest.mock('@/hooks/useMeetups', () => () => ({
  handleSignUp: jest.fn(), handleCancelSignup: jest.fn(), handleJoinVideoCall: jest.fn(),
}))
jest.mock('@/hooks/useCoffeeChats', () => () => ({
  coffeeChatRequests: [], loadCoffeeChatRequests: jest.fn(),
  handleAcceptCoffeeChat: jest.fn(), handleDeclineCoffeeChat: jest.fn(),
}))
jest.mock('@/hooks/useConnections', () => () => ({
  connections: [], lazyLoadAll: jest.fn(),
}))
jest.mock('@/hooks/useJourney', () => () => ({
  pendingRecaps: [], setPendingRecaps: jest.fn(), loadPendingRecaps: jest.fn(),
}))
jest.mock('@/components/Toast', () => ({
  useToast: () => ({ toasts: [], dismiss: jest.fn(), show: jest.fn(), success: jest.fn(), error: jest.fn(), info: jest.fn() }),
  ToastContainer: () => null,
}))
jest.mock('@/components/NudgeBanner', () => () => null)
jest.mock('@/components/LiveFeed', () => () => null)
jest.mock('@/lib/navigationAdapter', () => ({
  createOnNavigate: () => jest.fn(),
}))

import HomeView from '@/components/HomeView'

const makeProps = (overrides = {}) => ({
  currentUser: { id: 'test-user', name: 'Lynn Wang', username: 'lynn.wang', email: 'lynn@test.com' },
  meetups: [], userSignups: [], signups: {}, upcomingCoffeeChats: [],
  loadingMeetups: false, groupsCount: 0, coffeeChatsCount: 0,
  unreadMessageCount: 0, connectionRequests: [], circleJoinRequests: [],
  circleInvitations: [], coffeeChatRequests: [],
  homeEventRecs: [], homeCircleRecs: [], homePeopleRecs: [], homeRecsLoaded: false,
  pendingRecaps: [], setPendingRecaps: jest.fn(),
  upcomingMeetups: [], homeSearchQuery: '', setHomeSearchQuery: jest.fn(),
  homeSearchResults: null, connections: [],
  handleNavigate: jest.fn(), handleSignUp: jest.fn(), handleCancelSignup: jest.fn(),
  handleJoinVideoCall: jest.fn(), handleAcceptCircleJoin: jest.fn(),
  handleDeclineCircleJoin: jest.fn(), handleAcceptCircleInvitation: jest.fn(),
  handleDeclineCircleInvitation: jest.fn(), handleAcceptCoffeeChat: jest.fn(),
  handleDeclineCoffeeChat: jest.fn(), handleShowInterest: jest.fn(),
  handleRemoveInterest: jest.fn(),
  supabase: {}, toast: { success: jest.fn(), error: jest.fn() },
  ...overrides,
})

describe('WelcomeCard — Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  test('handles username with dots correctly', () => {
    render(<HomeView {...makeProps({ currentUser: { id: 'u1', name: 'Sarah Chen', username: 'sarah.chen' } })} />)
    expect(screen.getByText('Welcome to CircleW, @sarah.chen')).toBeInTheDocument()
    expect(screen.getByText('circlew.app/@sarah.chen')).toBeInTheDocument()
  })

  test('handles username with number suffix (collision)', () => {
    render(<HomeView {...makeProps({ currentUser: { id: 'u2', name: 'Lynn Wang', username: 'lynn.wang2' } })} />)
    expect(screen.getByText('Welcome to CircleW, @lynn.wang2')).toBeInTheDocument()
  })

  test('handles long username without breaking layout', () => {
    const longUsername = 'alexandra.von.hofmannsthal'
    render(<HomeView {...makeProps({ currentUser: { id: 'u3', name: 'Alexandra', username: longUsername } })} />)
    expect(screen.getByText(`Welcome to CircleW, @${longUsername}`)).toBeInTheDocument()
  })

  test('welcome card uses different localStorage key per user', () => {
    render(<HomeView {...makeProps({ currentUser: { id: 'user-A', name: 'A', username: 'a' } })} />)
    expect(localStorage.getItem('circlew_welcomed_user-A')).toBe('true')
    expect(localStorage.getItem('circlew_welcomed_user-B')).toBeNull()
  })

  test('second user still sees welcome card', () => {
    localStorage.setItem('circlew_welcomed_user-A', 'true')
    render(<HomeView {...makeProps({ currentUser: { id: 'user-B', name: 'B', username: 'b' } })} />)
    expect(screen.getByText('Welcome to CircleW, @b')).toBeInTheDocument()
  })

  test('greeting still shows alongside welcome card', () => {
    render(<HomeView {...makeProps()} />)
    // Should see both the greeting and the welcome card
    expect(screen.getByText('Welcome to CircleW, @lynn.wang')).toBeInTheDocument()
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument()
  })

  test('welcome card renders profile link with correct domain format', () => {
    render(<HomeView {...makeProps()} />)
    expect(screen.getByText('circlew.app/@lynn.wang')).toBeInTheDocument()
  })
})
