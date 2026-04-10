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
  eventDetail:      (d) => {
    const id = d.meetupId || d.coffeeChatId;
    return d.meetupCategory ? `/events/${id}?category=${d.meetupCategory}` : `/events/${id}`;
  },

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
  pastMeetings:     () => '/coffee?view=past',
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
 * Automatically appends ?from={currentPath} so destination pages
 * can use it for back navigation instead of hardcoded previousView.
 *
 * Usage:
 *   const router = useRouter()
 *   const pathname = usePathname()
 *   const onNavigate = createOnNavigate(router, pathname)
 *   <HomeView onNavigate={onNavigate} />
 */
export function createOnNavigate(router, currentPath) {
  return (view, data = {}) => {
    // Direct path navigation (from getPreviousView for dynamic routes)
    if (view.startsWith('_path:')) {
      router.push(view.slice(6))
      return
    }
    const resolver = ROUTES[view]
    let href = resolver ? resolver(data) : `/${view}`
    // Append from= param for back navigation (skip for main tabs and list pages)
    const skipFrom = ['home', 'discover', 'meetups', 'connectionGroups', 'allPeople', 'allEvents']
    if (currentPath && !skipFrom.includes(view)) {
      const separator = href.includes('?') ? '&' : '?'
      href = `${href}${separator}from=${encodeURIComponent(currentPath)}`
    }
    router.push(href)
  }
}

/**
 * Map a "from" searchParam back to a view name for previousView.
 * Falls back to the provided default if from is missing or unmapped.
 */
export function getPreviousView(searchParams, fallback = 'home') {
  const from = searchParams?.get?.('from')
  if (!from) return fallback
  // Map pathname back to view name for onNavigate compatibility
  const PATH_TO_VIEW = {
    '/home': 'home',
    '/discover': 'discover',
    '/coffee': 'meetups',
    '/circles': 'connectionGroups',
    '/circles/browse': 'allCircles',
    '/people': 'allPeople',
    '/events': 'allEvents',
    '/profile': 'profile',
    '/proposals': 'meetupProposals',
    '/admin': 'admin',
  }
  // Exact match first (handles paths without query params)
  if (PATH_TO_VIEW[from]) return PATH_TO_VIEW[from]
  // Paths with query params — navigate directly to preserve tab state
  // e.g. /coffee?view=past should go back to the past tab, not upcoming
  const fromPath = from.split('?')[0]
  if (fromPath !== from && PATH_TO_VIEW[fromPath]) {
    return '_path:' + from
  }
  // Dynamic routes — return the raw path prefixed with _path:
  // so back navigation can use router.push() directly
  if (from.startsWith('/circles/') || from.startsWith('/people/') ||
      from.startsWith('/events/') || from.startsWith('/recaps/')) {
    return '_path:' + from
  }
  return fallback
}

/**
 * Resolve a view name + data to a URL path without navigating.
 * Useful for building <Link href={...}> or testing.
 */
export function resolveRoute(view, data = {}) {
  const resolver = ROUTES[view]
  return resolver ? resolver(data) : `/${view}`
}
