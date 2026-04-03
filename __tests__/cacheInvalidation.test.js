/**
 * Cache invalidation contract tests.
 *
 * Every user action that mutates data must invalidate the SWR caches
 * that display that data. These tests verify the invalidation calls
 * exist in the source code by reading the actual component files.
 *
 * If a test fails, it means someone removed or forgot a cache
 * invalidation call — the affected page will show stale data.
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

function readComponent(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'components', name), 'utf8')
}

function readHook(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'hooks', name), 'utf8')
}

// ─── SWR cache keys referenced across the app ───────────────────────────────

const CACHE_KEYS = {
  circlesPage: 'circles-page-',
  circlesPeers: 'circles-peers-',
  circlesSentRequests: 'circles-sent-requests-',
  circlesSentInvites: 'circles-sent-invites-',
  circlesRecentChats: 'circles-recent-chats-',
  meetupsCoffee: 'meetups-coffee-',
  meetupsPending: 'meetups-pending-',
  meetupsGroup: 'meetups-group-',
  meetupsPast: 'meetups-past-',
  homePrimary: 'home-primary-',
  discoverGroups: 'discover-connection-groups',
  discoverRequests: 'discover-meetup-requests',
  discoverSignups: 'discover-meetup-signups',
  discoverRsvps: 'discover-user-rsvps-',
}

// ─── Helper: check that a code region contains a cache invalidation ──────────

function containsInvalidation(source, cacheKeyPrefix) {
  // Match invalidateQuery('key...') or invalidateQuery(`key...`)
  return source.includes(cacheKeyPrefix)
}

function getRegionAround(source, marker) {
  const idx = source.indexOf(marker)
  if (idx === -1) return ''
  // Grab a generous region: 500 chars before and 3000 chars after the marker
  // to capture the full function body including async operations and invalidation calls
  const start = Math.max(0, idx - 500)
  const end = Math.min(source.length, idx + 3000)
  return source.slice(start, end)
}

// ─── Circle actions ─────────────────────────────────────────────────────────

describe('Circle action cache invalidation', () => {
  const circleDetail = readComponent('CircleDetailView.js')
  const circlesView = readComponent('ConnectionGroupsView.js')

  test('leave circle invalidates circles-page', () => {
    const region = getRegionAround(circleDetail, 'handleLeaveCircle')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('leave circle invalidates home-primary', () => {
    const region = getRegionAround(circleDetail, 'handleLeaveCircle')
    expect(containsInvalidation(region, CACHE_KEYS.homePrimary)).toBe(true)
  })

  test('leave circle does not block with alert()', () => {
    const region = getRegionAround(circleDetail, 'handleLeaveCircle')
    // alert() before navigation blocks SWR revalidation
    expect(region).not.toMatch(/alert\(.*left.*circle/i)
  })

  test('request to join circle invalidates circles-page', () => {
    const region = getRegionAround(circleDetail, 'handleRequestToJoin')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('accept join request (admin) invalidates circles-page', () => {
    // Inline handler: update status to 'accepted'
    const region = getRegionAround(circleDetail, "status: 'accepted', responded_at")
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('decline join request (admin) invalidates circles-page', () => {
    // Inline handler: update status to 'declined'
    const region = getRegionAround(circleDetail, "status: 'declined', responded_at")
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('accept circle invitation invalidates circles-page', () => {
    const region = getRegionAround(circlesView, 'handleAcceptInvite')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('decline circle invitation invalidates circles-page', () => {
    const region = getRegionAround(circlesView, 'handleDeclineInvite')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('delete circle invalidates circles-page', () => {
    const region = getRegionAround(circlesView, 'handleDeleteGroup')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })
})

// ─── Coffee chat actions ────────────────────────────────────────────────────

describe('Coffee chat cache invalidation', () => {
  const meetupsView = readComponent('MeetupsView.js')
  const detailView = readComponent('CoffeeChatDetailView.js')

  test('accept coffee chat invalidates meetups-coffee', () => {
    const region = getRegionAround(meetupsView, 'handleAcceptChat')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsCoffee)).toBe(true)
  })

  test('accept coffee chat invalidates meetups-pending', () => {
    const region = getRegionAround(meetupsView, 'handleAcceptChat')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsPending)).toBe(true)
  })

  test('decline coffee chat invalidates meetups-coffee', () => {
    const region = getRegionAround(meetupsView, 'handleDeclineChat')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsCoffee)).toBe(true)
  })

  test('cancel coffee chat (MeetupsView) invalidates meetups-coffee', () => {
    const region = getRegionAround(meetupsView, 'handleCancelCoffeeChat')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsCoffee)).toBe(true)
  })

  test('cancel coffee chat (DetailView) invalidates meetups-coffee', () => {
    const region = getRegionAround(detailView, "action.type === 'cancelEvent'")
    expect(containsInvalidation(region, CACHE_KEYS.meetupsCoffee)).toBe(true)
  })

  test('cancel coffee chat (DetailView) invalidates meetups-past', () => {
    const region = getRegionAround(detailView, "action.type === 'cancelEvent'")
    expect(containsInvalidation(region, CACHE_KEYS.meetupsPast)).toBe(true)
  })
})

// ─── Meetup actions ─────────────────────────────────────────────────────────

describe('Meetup cache invalidation', () => {
  const meetupsView = readComponent('MeetupsView.js')
  const detailView = readComponent('CoffeeChatDetailView.js')

  test('RSVP meetup invalidates meetups-group', () => {
    const region = getRegionAround(meetupsView, 'handleRsvpMeetup')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsGroup)).toBe(true)
  })

  test('edit meetup invalidates meetups-group', () => {
    const region = getRegionAround(meetupsView, 'handleUpdateMeetup')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsGroup)).toBe(true)
  })

  test('delete meetup invalidates meetups-group', () => {
    const region = getRegionAround(meetupsView, 'handleDeleteMeetup')
    expect(containsInvalidation(region, CACHE_KEYS.meetupsGroup)).toBe(true)
  })

  test('cancel RSVP (DetailView) invalidates meetups-group', () => {
    const region = getRegionAround(detailView, "action.type === 'cancelRsvp'")
    expect(containsInvalidation(region, CACHE_KEYS.meetupsGroup)).toBe(true)
  })

  test('cancel RSVP (DetailView) invalidates home-primary', () => {
    const region = getRegionAround(detailView, "action.type === 'cancelRsvp'")
    expect(containsInvalidation(region, CACHE_KEYS.homePrimary)).toBe(true)
  })
})

// ─── Connection actions ─────────────────────────────────────────────────────

describe('Connection cache invalidation', () => {
  const profileView = readComponent('UserProfileView.js')

  test('remove connection invalidates circles-page', () => {
    const region = getRegionAround(profileView, 'handleRemoveConnection')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('remove connection invalidates circles-peers', () => {
    const region = getRegionAround(profileView, 'handleRemoveConnection')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPeers)).toBe(true)
  })

  test('remove connection invalidates home-primary', () => {
    const region = getRegionAround(profileView, 'handleRemoveConnection')
    expect(containsInvalidation(region, CACHE_KEYS.homePrimary)).toBe(true)
  })

  test('accept connection invalidates circles-page', () => {
    const region = getRegionAround(profileView, 'handleAcceptConnection')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPage)).toBe(true)
  })

  test('accept connection invalidates circles-peers', () => {
    const region = getRegionAround(profileView, 'handleAcceptConnection')
    expect(containsInvalidation(region, CACHE_KEYS.circlesPeers)).toBe(true)
  })

  test('send connection request invalidates circles-sent-requests', () => {
    const region = getRegionAround(profileView, 'handleSendConnectionRequest')
    expect(containsInvalidation(region, CACHE_KEYS.circlesSentRequests)).toBe(true)
  })

  test('ignore connection invalidates home-primary', () => {
    const region = getRegionAround(profileView, 'handleIgnoreConnection')
    expect(containsInvalidation(region, CACHE_KEYS.homePrimary)).toBe(true)
  })
})

// ─── Home page actions ──────────────────────────────────────────────────────

describe('Home page action cache invalidation', () => {
  const homeData = readHook('useHomeData.js')

  test('accept circle invitation invalidates home-primary', () => {
    const region = getRegionAround(homeData, 'handleAcceptCircleInvitation')
    expect(containsInvalidation(region, 'mutatePrimary')).toBe(true)
  })

  test('coffee chat join uses raw UUID (no coffee- prefix)', () => {
    const useMeetups = readHook('useMeetups.js')
    const region = getRegionAround(useMeetups, 'isCoffeeChat')
    // Should strip prefix or use _coffeeChatId
    expect(region).toMatch(/_coffeeChatId|startsWith\('coffee-'\)/)
  })
})

// ─── Discover page actions ──────────────────────────────────────────────────

describe('Discover page cache invalidation', () => {
  const discoverView = readComponent('NetworkDiscoverView.js')

  test('RSVP from discover invalidates discover-meetup-signups', () => {
    const region = getRegionAround(discoverView, 'handleRsvp')
    expect(containsInvalidation(region, CACHE_KEYS.discoverSignups)).toBe(true)
  })

  test('support request invalidates discover-meetup-requests', () => {
    const region = getRegionAround(discoverView, 'handleSupportRequest')
    expect(containsInvalidation(region, CACHE_KEYS.discoverRequests)).toBe(true)
  })

  test('delete request invalidates discover-meetup-requests', () => {
    const region = getRegionAround(discoverView, 'handleDeleteRequest')
    expect(containsInvalidation(region, CACHE_KEYS.discoverRequests)).toBe(true)
  })

  test('submit request invalidates discover-meetup-requests', () => {
    const region = getRegionAround(discoverView, 'handleSubmitRequest')
    expect(containsInvalidation(region, CACHE_KEYS.discoverRequests)).toBe(true)
  })
})
