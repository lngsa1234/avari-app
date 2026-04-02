/**
 * LiveFeed data contract and state matrix tests.
 *
 * These tests verify:
 * 1. Event shape contracts — every event type has the fields FeedItem depends on
 * 2. Actor ID resolution — actorId resolves correctly for both DB and synthetic events
 * 3. CTA state matrix — every (event_type × user_relationship) produces correct CTA
 *
 * @jest-environment node
 */

// ─── Event shape fixtures ────────────────────────────────────────────────────
// These mirror the shapes produced by useLiveFeed.js (enrichEvents + fetchAvailableProfiles)

const FIXTURES = {
  // DB events (from feed_events table, enriched by enrichEvents)
  coffee_live: {
    id: 'evt-1',
    event_type: 'coffee_live',
    actor_id: 'user-alice',
    target_id: 'user-bob',
    circle_id: null,
    is_live: true,
    metadata: {},
    expires_at: '2026-04-02T14:00:00Z',
    created_at: '2026-04-02T12:00:00Z',
    actor: { id: 'user-alice', name: 'Alice', profile_picture: null },
    target: { id: 'user-bob', name: 'Bob', profile_picture: null },
    circle: null,
  },
  coffee_scheduled: {
    id: 'evt-2',
    event_type: 'coffee_scheduled',
    actor_id: 'user-alice',
    target_id: 'user-bob',
    circle_id: null,
    is_live: false,
    metadata: { status: 'accepted' },
    expires_at: null,
    created_at: '2026-04-02T10:00:00Z',
    actor: { id: 'user-alice', name: 'Alice', profile_picture: null },
    target: { id: 'user-bob', name: 'Bob', profile_picture: null },
    circle: null,
  },
  member_joined: {
    id: 'evt-3',
    event_type: 'member_joined',
    actor_id: 'user-charlie',
    target_id: null,
    circle_id: null,
    is_live: false,
    metadata: { career: 'Engineer', location: 'SF', industry: 'Tech', hook: 'AI' },
    expires_at: null,
    created_at: '2026-04-02T09:00:00Z',
    actor: { id: 'user-charlie', name: 'Charlie', profile_picture: null },
    target: null,
    circle: null,
  },
  connection: {
    id: 'evt-4',
    event_type: 'connection',
    actor_id: 'user-alice',
    target_id: 'user-bob',
    circle_id: null,
    is_live: false,
    metadata: {},
    expires_at: null,
    created_at: '2026-04-02T08:00:00Z',
    actor: { id: 'user-alice', name: 'Alice', profile_picture: null },
    target: { id: 'user-bob', name: 'Bob', profile_picture: null },
    circle: null,
  },
  circle_join: {
    id: 'evt-5',
    event_type: 'circle_join',
    actor_id: 'user-charlie',
    target_id: null,
    circle_id: 'circle-spb',
    is_live: false,
    metadata: {},
    expires_at: null,
    created_at: '2026-04-02T07:00:00Z',
    actor: { id: 'user-charlie', name: 'Charlie', profile_picture: null },
    target: null,
    circle: { id: 'circle-spb', name: 'Side Project Builders', max_members: 10, member_count: 5 },
  },
  circle_schedule: {
    id: 'evt-6',
    event_type: 'circle_schedule',
    actor_id: null,
    target_id: null,
    circle_id: 'circle-spb',
    is_live: false,
    metadata: { date: '2026-04-05', time: '14:00' },
    expires_at: null,
    created_at: '2026-04-02T06:00:00Z',
    actor: null,
    target: null,
    circle: { id: 'circle-spb', name: 'Side Project Builders', max_members: 10, member_count: 5 },
  },
  community_event: {
    id: 'evt-7',
    event_type: 'community_event',
    actor_id: 'user-alice',
    target_id: null,
    circle_id: null,
    is_live: false,
    metadata: { title: 'Demo Day', date: '2026-04-10', time: '18:00', location: 'SF' },
    expires_at: null,
    created_at: '2026-04-02T05:00:00Z',
    actor: { id: 'user-alice', name: 'Alice', profile_picture: null },
    target: null,
    circle: null,
  },

  // Synthetic event (from fetchAvailableProfiles — NO actor_id at top level)
  coffee_available_synthetic: {
    id: 'available-user-diane',
    event_type: 'coffee_available',
    is_live: false,
    metadata: { career: 'Designer' },
    expires_at: null,
    created_at: '2026-04-02T12:00:00Z',
    actor: { id: 'user-diane', name: 'Diane', profile_picture: null },
    target: null,
    circle: null,
    _synthetic: true,
    // NOTE: no actor_id field — this is the bug we fixed
  },
}

// ─── CTA resolution logic (mirrors LiveFeed.jsx FeedItem) ────────────────────

const EVENT_CONFIG = {
  coffee_live:      { cta: null, isPrivate: true },
  coffee_scheduled: { cta: null, isPrivate: true },
  member_joined:    { cta: 'Say hi' },
  coffee_available: { cta: 'Connect' },
  connection:       { cta: null },
  circle_join:      { cta: 'Join' },
  circle_schedule:  { cta: 'RSVP' },
  community_event:  { cta: 'RSVP' },
}

function resolveActorId(event) {
  return event.actor_id || event.actor?.id
}

function resolveCTA(event, { currentUserId, connectedIds, sentRequestIds, incomingRequestIds, memberCircleIds }) {
  const config = EVENT_CONFIG[event.event_type]
  if (!config || config.isPrivate) return { text: null, visible: false }

  const actorId = resolveActorId(event)
  if (actorId === currentUserId) return { text: null, visible: false }
  if (!config.cta) return { text: null, visible: false }

  const isConnectType = config.cta === 'Connect' || config.cta === 'Say hi'
  const isCircleJoin = event.event_type === 'circle_join' || event.event_type === 'circle_schedule'

  let ctaText = config.cta
  let isDisabled = false

  if (isConnectType && connectedIds.has(actorId)) {
    ctaText = 'Connected'
    isDisabled = true
  } else if (isConnectType && sentRequestIds.has(actorId)) {
    ctaText = 'Request Sent'
    isDisabled = true
  } else if (isConnectType && incomingRequestIds.has(actorId)) {
    ctaText = 'Accept'
  } else if (isCircleJoin && event.circle_id && memberCircleIds.has(event.circle_id)) {
    ctaText = 'Member'
    isDisabled = true
  }

  return { text: ctaText, disabled: isDisabled, visible: true }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Event shape contracts', () => {
  const allFixtures = Object.entries(FIXTURES)

  test.each(allFixtures)('%s has required base fields', (name, event) => {
    expect(event).toHaveProperty('id')
    expect(event).toHaveProperty('event_type')
    expect(typeof event.event_type).toBe('string')
    expect(event).toHaveProperty('is_live')
    expect(event).toHaveProperty('created_at')
  })

  test.each(allFixtures)('%s has actor_id or actor.id (actorId resolvable)', (name, event) => {
    // Private events (coffee_live, coffee_scheduled, connection) always have actor_id
    // circle_schedule may have null actor (it's a system event)
    if (event.event_type === 'circle_schedule') return // no actor expected
    const resolved = resolveActorId(event)
    expect(resolved).toBeTruthy()
    expect(typeof resolved).toBe('string')
  })

  test('DB events have actor_id at top level', () => {
    const dbEvents = Object.entries(FIXTURES)
      .filter(([name]) => !name.includes('synthetic') && name !== 'circle_schedule')
    for (const [name, event] of dbEvents) {
      expect(event.actor_id).toBeTruthy()
    }
  })

  test('synthetic coffee_available events lack actor_id but have actor.id', () => {
    const synth = FIXTURES.coffee_available_synthetic
    expect(synth.actor_id).toBeUndefined()
    expect(synth.actor?.id).toBeTruthy()
    expect(resolveActorId(synth)).toBe('user-diane')
  })

  test('circle events have circle_id', () => {
    expect(FIXTURES.circle_join.circle_id).toBeTruthy()
    expect(FIXTURES.circle_schedule.circle_id).toBeTruthy()
  })

  test('circle events have circle.name', () => {
    expect(FIXTURES.circle_join.circle?.name).toBeTruthy()
    expect(FIXTURES.circle_schedule.circle?.name).toBeTruthy()
  })

  test('dual-avatar events have both actor and target', () => {
    expect(FIXTURES.coffee_live.actor).toBeTruthy()
    expect(FIXTURES.coffee_live.target).toBeTruthy()
    expect(FIXTURES.coffee_scheduled.actor).toBeTruthy()
    expect(FIXTURES.coffee_scheduled.target).toBeTruthy()
    expect(FIXTURES.connection.actor).toBeTruthy()
    expect(FIXTURES.connection.target).toBeTruthy()
  })
})

describe('CTA state matrix', () => {
  const currentUserId = 'user-me'
  const defaultState = {
    currentUserId,
    connectedIds: new Set(),
    sentRequestIds: new Set(),
    incomingRequestIds: new Set(),
    memberCircleIds: new Set(),
  }

  // ─── Private events: no CTA ever ─────────────────────────────────────────

  test('coffee_live: no CTA (private)', () => {
    const result = resolveCTA(FIXTURES.coffee_live, defaultState)
    expect(result.visible).toBe(false)
  })

  test('coffee_scheduled: no CTA (private)', () => {
    const result = resolveCTA(FIXTURES.coffee_scheduled, defaultState)
    expect(result.visible).toBe(false)
  })

  test('connection: no CTA', () => {
    const result = resolveCTA(FIXTURES.connection, defaultState)
    expect(result.visible).toBe(false)
  })

  // ─── member_joined: Say hi / Connected / Request Sent / Accept ────────────

  test('member_joined × no relationship → "Say hi"', () => {
    const result = resolveCTA(FIXTURES.member_joined, defaultState)
    expect(result.text).toBe('Say hi')
    expect(result.disabled).toBeFalsy()
  })

  test('member_joined × connected → "Connected" (disabled)', () => {
    const result = resolveCTA(FIXTURES.member_joined, {
      ...defaultState,
      connectedIds: new Set(['user-charlie']),
    })
    expect(result.text).toBe('Connected')
    expect(result.disabled).toBe(true)
  })

  test('member_joined × sent request → "Request Sent" (disabled)', () => {
    const result = resolveCTA(FIXTURES.member_joined, {
      ...defaultState,
      sentRequestIds: new Set(['user-charlie']),
    })
    expect(result.text).toBe('Request Sent')
    expect(result.disabled).toBe(true)
  })

  test('member_joined × incoming request → "Accept"', () => {
    const result = resolveCTA(FIXTURES.member_joined, {
      ...defaultState,
      incomingRequestIds: new Set(['user-charlie']),
    })
    expect(result.text).toBe('Accept')
    expect(result.disabled).toBeFalsy()
  })

  test('member_joined × own event → no CTA', () => {
    const ownEvent = { ...FIXTURES.member_joined, actor_id: currentUserId }
    const result = resolveCTA(ownEvent, defaultState)
    expect(result.visible).toBe(false)
  })

  // ─── coffee_available (synthetic): Connect / Connected / Request Sent ─────

  test('coffee_available × no relationship → "Connect"', () => {
    const result = resolveCTA(FIXTURES.coffee_available_synthetic, defaultState)
    expect(result.text).toBe('Connect')
    expect(result.disabled).toBeFalsy()
  })

  test('coffee_available × connected → "Connected" (disabled)', () => {
    const result = resolveCTA(FIXTURES.coffee_available_synthetic, {
      ...defaultState,
      connectedIds: new Set(['user-diane']),
    })
    expect(result.text).toBe('Connected')
    expect(result.disabled).toBe(true)
  })

  test('coffee_available × sent request → "Request Sent" (disabled)', () => {
    const result = resolveCTA(FIXTURES.coffee_available_synthetic, {
      ...defaultState,
      sentRequestIds: new Set(['user-diane']),
    })
    expect(result.text).toBe('Request Sent')
    expect(result.disabled).toBe(true)
  })

  test('coffee_available × incoming request → "Accept"', () => {
    const result = resolveCTA(FIXTURES.coffee_available_synthetic, {
      ...defaultState,
      incomingRequestIds: new Set(['user-diane']),
    })
    expect(result.text).toBe('Accept')
    expect(result.disabled).toBeFalsy()
  })

  // ─── circle_join: Join / Member ───────────────────────────────────────────

  test('circle_join × not member → "Join"', () => {
    const result = resolveCTA(FIXTURES.circle_join, defaultState)
    expect(result.text).toBe('Join')
    expect(result.disabled).toBeFalsy()
  })

  test('circle_join × already member → "Member" (disabled)', () => {
    const result = resolveCTA(FIXTURES.circle_join, {
      ...defaultState,
      memberCircleIds: new Set(['circle-spb']),
    })
    expect(result.text).toBe('Member')
    expect(result.disabled).toBe(true)
  })

  test('circle_join × own event → no CTA', () => {
    const ownEvent = { ...FIXTURES.circle_join, actor_id: currentUserId }
    const result = resolveCTA(ownEvent, defaultState)
    expect(result.visible).toBe(false)
  })

  // ─── circle_schedule: RSVP / Member ───────────────────────────────────────

  test('circle_schedule × not member → "RSVP"', () => {
    const result = resolveCTA(FIXTURES.circle_schedule, defaultState)
    expect(result.text).toBe('RSVP')
    expect(result.disabled).toBeFalsy()
  })

  test('circle_schedule × already member → "Member" (disabled)', () => {
    const result = resolveCTA(FIXTURES.circle_schedule, {
      ...defaultState,
      memberCircleIds: new Set(['circle-spb']),
    })
    expect(result.text).toBe('Member')
    expect(result.disabled).toBe(true)
  })

  // ─── community_event: RSVP (not affected by connection/circle state) ──────

  test('community_event × any state → "RSVP"', () => {
    const result = resolveCTA(FIXTURES.community_event, {
      ...defaultState,
      connectedIds: new Set(['user-alice']),
      memberCircleIds: new Set(['circle-spb']),
    })
    expect(result.text).toBe('RSVP')
    expect(result.disabled).toBeFalsy()
  })

  test('community_event × own event → no CTA', () => {
    const ownEvent = { ...FIXTURES.community_event, actor_id: currentUserId }
    const result = resolveCTA(ownEvent, defaultState)
    expect(result.visible).toBe(false)
  })
})

describe('Priority and edge cases', () => {
  const currentUserId = 'user-me'
  const defaultState = {
    currentUserId,
    connectedIds: new Set(),
    sentRequestIds: new Set(),
    incomingRequestIds: new Set(),
    memberCircleIds: new Set(),
  }

  test('Connected takes priority over Request Sent', () => {
    const result = resolveCTA(FIXTURES.member_joined, {
      ...defaultState,
      connectedIds: new Set(['user-charlie']),
      sentRequestIds: new Set(['user-charlie']),
    })
    expect(result.text).toBe('Connected')
  })

  test('Connected takes priority over incoming request', () => {
    const result = resolveCTA(FIXTURES.member_joined, {
      ...defaultState,
      connectedIds: new Set(['user-charlie']),
      incomingRequestIds: new Set(['user-charlie']),
    })
    expect(result.text).toBe('Connected')
  })

  test('actorId resolves from actor.id when actor_id is missing', () => {
    const synth = FIXTURES.coffee_available_synthetic
    expect(synth.actor_id).toBeUndefined()
    expect(resolveActorId(synth)).toBe('user-diane')
  })

  test('actorId prefers actor_id over actor.id', () => {
    const event = { actor_id: 'from-field', actor: { id: 'from-object' } }
    expect(resolveActorId(event)).toBe('from-field')
  })

  test('circle membership check uses circle_id not actor_id', () => {
    // Even if the actor is connected, circle_join should check circle membership
    const result = resolveCTA(FIXTURES.circle_join, {
      ...defaultState,
      connectedIds: new Set(['user-charlie']), // actor is connected
      memberCircleIds: new Set(['circle-spb']), // AND user is member
    })
    // circle_join cta is 'Join', not a connect-type, so connection state is irrelevant
    expect(result.text).toBe('Member')
  })

  test('null actor event (circle_schedule) still works', () => {
    const result = resolveCTA(FIXTURES.circle_schedule, defaultState)
    expect(result.text).toBe('RSVP')
  })
})
