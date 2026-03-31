/**
 * Navigation adapter — bridges the old onNavigate(view, data) API
 * to Next.js App Router's router.push(url).
 *
 * View components call onNavigate('circleDetail', { circleId }) hundreds
 * of times. This adapter translates those calls to URL-based navigation
 * so view components need zero internal changes during the routing migration.
 *
 * The ROUTES map is declarative and testable:
 *   ROUTES.circleDetail({ circleId: 'x' }) === '/circles/x'
 */

// Declarative route map: view name → URL resolver
export const ROUTES = {
  // Main tabs
  home:             () => '/home',
  discover:         () => '/discover',
  meetups:          (d) => d?.initialView === 'past' ? '/coffee?view=past' : '/coffee',
  connectionGroups: () => '/circles',

  // Detail views
  circleDetail:     (d) => `/circles/${d.circleId}`,
  userProfile:      (d) => `/people/${d.userId}`,
  eventDetail:      (d) => `/events/${d.meetupId || d.coffeeChatId}`,

  // List views
  allEvents:        () => '/events',
  allPeople:        () => '/people',
  allCircles:       () => '/circles/browse',
  createCircle:     () => '/circles/new',

  // Messaging
  messages:         (d) => d?.chatId
    ? `/messages?id=${d.chatId}&type=${d.chatType || 'user'}`
    : '/messages',

  // Scheduling (complex query params)
  coffeeChats:      () => '/schedule?type=coffee',
  scheduleMeetup:   (d) => {
    const p = new URLSearchParams()
    if (d?.meetupType) p.set('type', d.meetupType)
    if (d?.scheduleCircleId) p.set('circleId', d.scheduleCircleId)
    if (d?.scheduleCircleName) p.set('circleName', d.scheduleCircleName)
    if (d?.scheduleConnectionId) p.set('connectionId', d.scheduleConnectionId)
    if (d?.scheduleConnectionName) p.set('connectionName', d.scheduleConnectionName)
    const qs = p.toString()
    return qs ? `/schedule?${qs}` : '/schedule'
  },

  // Profile & history
  profile:          () => '/profile',
  callHistory:      () => '/coffee?view=history',
  coffeeChatRecap:  (d) => `/recaps/${d.recapId}`,

  // Admin
  admin:            () => '/admin',
  adminFeedback:    () => '/admin/feedback',
  adminAnalytics:   () => '/admin/analytics',
  meetupProposals:  () => '/proposals',
}

/**
 * Create an onNavigate function that wraps router.push.
 * Drop-in replacement for MainApp's handleNavigate.
 *
 * Usage:
 *   const router = useRouter()
 *   const onNavigate = createOnNavigate(router)
 *   <HomeView onNavigate={onNavigate} />
 */
export function createOnNavigate(router) {
  return (view, data = {}) => {
    const resolver = ROUTES[view]
    const href = resolver ? resolver(data) : `/${view}`
    router.push(href)
  }
}

/**
 * Resolve a view name + data to a URL path without navigating.
 * Useful for building <Link href={...}> or testing.
 */
export function resolveRoute(view, data = {}) {
  const resolver = ROUTES[view]
  return resolver ? resolver(data) : `/${view}`
}
