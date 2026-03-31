/**
 * Tests for lib/navigationAdapter.js — declarative route map.
 *
 * @jest-environment node
 */

const { ROUTES, createOnNavigate } = require('@/lib/navigationAdapter')

describe('ROUTES', () => {
  test('main tabs resolve to correct paths', () => {
    expect(ROUTES.home()).toBe('/home')
    expect(ROUTES.discover()).toBe('/discover')
    expect(ROUTES.meetups()).toBe('/coffee')
    expect(ROUTES.connectionGroups()).toBe('/circles')
  })

  test('meetups with past view', () => {
    expect(ROUTES.meetups({ initialView: 'past' })).toBe('/coffee?view=past')
  })

  test('detail views use params', () => {
    expect(ROUTES.circleDetail({ circleId: 'abc-123' })).toBe('/circles/abc-123')
    expect(ROUTES.userProfile({ userId: 'user-456' })).toBe('/people/user-456')
    expect(ROUTES.eventDetail({ meetupId: 'evt-789' })).toBe('/events/evt-789')
  })

  test('eventDetail falls back to coffeeChatId', () => {
    expect(ROUTES.eventDetail({ coffeeChatId: 'cc-1' })).toBe('/events/cc-1')
  })

  test('list views resolve to correct paths', () => {
    expect(ROUTES.allEvents()).toBe('/events')
    expect(ROUTES.allPeople()).toBe('/people')
    expect(ROUTES.allCircles()).toBe('/circles/browse')
    expect(ROUTES.createCircle()).toBe('/circles/new')
  })

  test('messages with chat ID uses query params', () => {
    expect(ROUTES.messages({ chatId: 'c1', chatType: 'circle' })).toBe('/messages?id=c1&type=circle')
  })

  test('messages without chat ID goes to inbox', () => {
    expect(ROUTES.messages()).toBe('/messages')
    expect(ROUTES.messages({})).toBe('/messages')
  })

  test('schedule with pre-fill data', () => {
    const url = ROUTES.scheduleMeetup({
      meetupType: 'circle',
      scheduleCircleId: 'g1',
      scheduleCircleName: 'Book Club',
    })
    expect(url).toContain('/schedule?')
    expect(url).toContain('type=circle')
    expect(url).toContain('circleId=g1')
    expect(url).toContain('circleName=Book+Club')
  })

  test('schedule without data', () => {
    expect(ROUTES.scheduleMeetup()).toBe('/schedule')
  })

  test('coffeeChats shortcut', () => {
    expect(ROUTES.coffeeChats()).toBe('/schedule?type=coffee')
  })

  test('profile and history', () => {
    expect(ROUTES.profile()).toBe('/profile')
    expect(ROUTES.callHistory()).toBe('/coffee?view=history')
    expect(ROUTES.coffeeChatRecap({ recapId: 'r1' })).toBe('/recaps/r1')
  })

  test('admin routes', () => {
    expect(ROUTES.admin()).toBe('/admin')
    expect(ROUTES.adminFeedback()).toBe('/admin/feedback')
    expect(ROUTES.adminAnalytics()).toBe('/admin/analytics')
    expect(ROUTES.meetupProposals()).toBe('/proposals')
  })
})

describe('createOnNavigate', () => {
  test('calls router.push with resolved URL', () => {
    const mockRouter = { push: jest.fn() }
    const onNavigate = createOnNavigate(mockRouter)

    onNavigate('circleDetail', { circleId: 'abc' })
    expect(mockRouter.push).toHaveBeenCalledWith('/circles/abc')
  })

  test('falls back to /viewName for unknown views', () => {
    const mockRouter = { push: jest.fn() }
    const onNavigate = createOnNavigate(mockRouter)

    onNavigate('unknownView')
    expect(mockRouter.push).toHaveBeenCalledWith('/unknownView')
  })
})
