import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/home',
}))

// Mock hooks and modules used by HomeView
jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'test-user', name: 'Lynn Wang', username: 'lynn.wang' } }),
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

const baseProps = {
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
}

describe('WelcomeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  test('shows welcome card for new user with username', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.getByText('Welcome to CircleW, @lynn.wang')).toBeInTheDocument()
    expect(screen.getByText('circlew.app/@lynn.wang')).toBeInTheDocument()
  })

  test('shows Share Profile and Find People buttons', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.getByText('Share Profile')).toBeInTheDocument()
    expect(screen.getByText('Find People')).toBeInTheDocument()
  })

  test('does not show welcome card for returning user', () => {
    localStorage.setItem('circlew_welcomed_test-user', 'true')
    render(<HomeView {...baseProps} />)
    expect(screen.queryByText('Welcome to CircleW, @lynn.wang')).not.toBeInTheDocument()
  })

  test('does not show welcome card when user has no username', () => {
    render(<HomeView {...baseProps} currentUser={{ ...baseProps.currentUser, username: null }} />)
    expect(screen.queryByText(/Welcome to CircleW/)).not.toBeInTheDocument()
  })

  test('dismiss button hides welcome card', () => {
    render(<HomeView {...baseProps} />)
    expect(screen.getByText('Welcome to CircleW, @lynn.wang')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Dismiss welcome card'))
    expect(screen.queryByText('Welcome to CircleW, @lynn.wang')).not.toBeInTheDocument()
  })

  test('Share Profile button triggers navigation', () => {
    render(<HomeView {...baseProps} />)
    fireEvent.click(screen.getByText('Share Profile'))
    expect(baseProps.handleNavigate).toHaveBeenCalledWith('profile')
  })

  test('Find People button triggers navigation', () => {
    render(<HomeView {...baseProps} />)
    fireEvent.click(screen.getByText('Find People'))
    expect(baseProps.handleNavigate).toHaveBeenCalledWith('allPeople')
  })

  test('sets localStorage flag after showing', () => {
    render(<HomeView {...baseProps} />)
    expect(localStorage.getItem('circlew_welcomed_test-user')).toBe('true')
  })
})
