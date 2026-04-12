/**
 * Optimistic update enforcement test.
 *
 * Scans every mutation handler in the app and flags any that use
 * invalidateQuery() without a nearby optimistic update (mutate with
 * a function updater). This catches the exact bug pattern where
 * the user clicks a button and the UI doesn't update until a
 * background refetch completes.
 *
 * This test is intentionally strict — if you add a new mutation,
 * either add an optimistic update or add it to the ALLOWED_EXCEPTIONS list
 * with a comment explaining why the delay is acceptable.
 *
 * @jest-environment node
 */

const fs = require('fs')
const path = require('path')

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

/**
 * Extract mutation handler blocks from source code.
 * Finds functions that contain .insert(), .update(), .delete(), or .rpc()
 * and returns the function name + surrounding code.
 */
function findMutationHandlers(source) {
  const handlers = []

  // Match named functions/handlers that contain supabase mutations
  const functionPatterns = [
    // const handleX = async () => { ... }
    /const\s+(handle\w+)\s*=\s*async/g,
    // async function handleX() { ... }
    /async\s+function\s+(handle\w+)/g,
    // const scheduleX = async () => { ... }
    /const\s+(schedule\w+)\s*=\s*async/g,
  ]

  for (const pattern of functionPatterns) {
    let match
    while ((match = pattern.exec(source)) !== null) {
      const name = match[1]
      const startIdx = match.index

      // Extract ~3000 chars after the function declaration to capture the body
      const endIdx = Math.min(source.length, startIdx + 3000)
      const body = source.slice(startIdx, endIdx)

      // Only include if it contains a supabase mutation
      if (body.match(/\.(insert|update|delete|upsert)\(/) || body.match(/\.rpc\(/)) {
        handlers.push({ name, body, startIdx })
      }
    }
  }

  return handlers
}

/**
 * Check if a handler uses only invalidateQuery (no optimistic update).
 * Returns true if the handler has a potential stale-UI issue.
 */
function hasStaleUiRisk(handlerBody) {
  const hasInvalidateQuery = handlerBody.includes('invalidateQuery')
  const hasOptimisticMutate = /\b(mutate\w*|refresh\w*)\(\s*\(/.test(handlerBody) // mutate((current) => ...)
  const hasSetState = /\bset\w+\(\s*(prev|current)\s*=>/.test(handlerBody) // setState(prev => ...)
  const hasNavigateAway = /onNavigate|window\.location|router\.push/.test(handlerBody)
  const hasLocalStateUpdate = /\bset\w+\(/.test(handlerBody) && hasSetState

  // If it navigates away after the mutation, delay is not visible
  if (hasNavigateAway) return false

  // If it uses optimistic mutate or local state update, it's fine
  if (hasOptimisticMutate || hasLocalStateUpdate) return false

  // If it only uses invalidateQuery, the user sees stale data
  if (hasInvalidateQuery) return true

  // If it calls loadX() to refetch (e.g., loadCircleDetails), also stale
  if (/\bload\w+\(\)/.test(handlerBody) && !hasOptimisticMutate && !hasLocalStateUpdate) return true

  return false
}

// Handlers where delayed update is acceptable (with reasons)
const ALLOWED_EXCEPTIONS = [
  // Cross-page invalidations — user hasn't navigated there yet
  'handleAcceptConnection',       // invalidates circles-page from profile page
  'handleIgnoreConnection',       // invalidates home-primary from profile page
  'handleSendConnectionRequest',  // uses local state setLocalSentRequest for instant UI
  'handleShowInterest',           // useConnections: used from multiple pages, local state handles UI
  'handleRemoveInterest',         // useConnections: local state handles interest toggle UI
  'handleSubmit',                 // ScheduleMeetupView: routes to schedule functions that navigate away
  'handleLeaveCircle',            // navigates away after leaving
  'handleSaveEdit',               // CircleDetailView: updates local state + refetch
  'handleCirclePhotoUpload',      // updates local state + refetch
  'handleUpdateCircleMeetup',     // refetches circle meetups (detail view only)
  'scheduleCoffeeChat',           // navigates to new view after scheduling
  'scheduleCircleMeetup',         // same
  'scheduleCommunityEvent',       // same
]

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Optimistic update audit', () => {
  const components = [
    'components/ConnectionGroupsView.js',
    'components/CircleDetailView.js',
    'components/MeetupsView.js',
    'components/CoffeeChatDetailView.js',
    'components/UserProfileView.js',
    'components/NetworkDiscoverView.js',
    'components/ScheduleMeetupView.js',
  ]

  const hooks = [
    'hooks/useHomeData.js',
    'hooks/useMeetups.js',
    'hooks/useConnections.js',
  ]

  const allFiles = [...components, ...hooks]

  test('all mutation handlers use optimistic updates or are in allowed exceptions', () => {
    const violations = []

    for (const filePath of allFiles) {
      let source
      try {
        source = readFile(filePath)
      } catch {
        continue // file may not exist
      }

      const handlers = findMutationHandlers(source)

      for (const handler of handlers) {
        if (ALLOWED_EXCEPTIONS.includes(handler.name)) continue

        if (hasStaleUiRisk(handler.body)) {
          violations.push(`${filePath}: ${handler.name}() uses invalidateQuery without optimistic update`)
        }
      }
    }

    if (violations.length > 0) {
      const message = [
        `Found ${violations.length} mutation handler(s) without optimistic updates:`,
        '',
        ...violations.map(v => `  - ${v}`),
        '',
        'Fix: Replace invalidateQuery(key) with mutateFn((current) => updated, { revalidate: true })',
        'Or add the handler name to ALLOWED_EXCEPTIONS with a comment explaining why.',
      ].join('\n')

      expect(violations).toEqual([]) // This will show the message on failure
    }
  })
})
