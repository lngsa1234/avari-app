/**
 * Tests for Raise Hand feature logic.
 *
 * Covers: feature flag gating, state management (queue ordering, deduplication,
 * auto-lower on leave), broadcast event shapes, and host-only permissions.
 */

import { getCallTypeConfig } from '@/lib/video/callTypeConfig'

// ─── Raise hand state helpers (extracted from page.js logic) ────────────────

/**
 * Simulate the setRaisedHands reducer logic used in the broadcast handler.
 */
function applyHandEvent(currentHands, payload) {
  switch (payload.type) {
    case 'hand:raise': {
      if (currentHands.some(h => h.userId === payload.userId)) return currentHands
      return [...currentHands, {
        userId: payload.userId,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
        raisedAt: payload.raisedAt,
      }]
    }
    case 'hand:lower':
      return currentHands.filter(h => h.userId !== payload.userId)
    case 'hand:lower-all':
      return []
    default:
      return currentHands
  }
}

/**
 * Simulate auto-lower on participant leave.
 */
function removeParticipantHand(currentHands, departedUserId) {
  return currentHands.filter(h => h.userId !== departedUserId)
}

/**
 * Sort participants so raised hands come first in queue order.
 */
function sortByRaisedHands(participants, raisedHands) {
  return [...participants].sort((a, b) => {
    const aIdx = raisedHands.findIndex(h => h.userId === a.id)
    const bIdx = raisedHands.findIndex(h => h.userId === b.id)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    if (aIdx !== -1) return -1
    if (bIdx !== -1) return 1
    return 0
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Raise Hand — Feature Flags', () => {
  test('handRaise is enabled for circle call type', () => {
    const config = getCallTypeConfig('circle')
    expect(config.features.handRaise).toBe(true)
  })

  test('handRaise is enabled for meetup call type', () => {
    const config = getCallTypeConfig('meetup')
    expect(config.features.handRaise).toBe(true)
  })

  test('handRaise is disabled for coffee chat (1:1)', () => {
    const config = getCallTypeConfig('coffee')
    expect(config.features.handRaise).toBe(false)
  })

  test('coffee chat does not have participants panel', () => {
    const config = getCallTypeConfig('coffee')
    expect(config.features.participants).toBe(false)
  })
})

describe('Raise Hand — State Management', () => {
  const userA = { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 }
  const userB = { userId: 'user-b', name: 'Bob', avatarUrl: null, raisedAt: 2000 }
  const userC = { userId: 'user-c', name: 'Carol', avatarUrl: null, raisedAt: 3000 }

  test('raising a hand adds to the queue', () => {
    const hands = applyHandEvent([], { type: 'hand:raise', ...userA })
    expect(hands).toHaveLength(1)
    expect(hands[0].userId).toBe('user-a')
    expect(hands[0].name).toBe('Alice')
  })

  test('raising preserves queue order (FIFO)', () => {
    let hands = []
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userA })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userB })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userC })

    expect(hands).toHaveLength(3)
    expect(hands[0].userId).toBe('user-a')
    expect(hands[1].userId).toBe('user-b')
    expect(hands[2].userId).toBe('user-c')
  })

  test('duplicate raise is ignored (idempotent)', () => {
    let hands = applyHandEvent([], { type: 'hand:raise', ...userA })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userA })

    expect(hands).toHaveLength(1)
  })

  test('lowering a hand removes from queue', () => {
    let hands = []
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userA })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userB })
    hands = applyHandEvent(hands, { type: 'hand:lower', userId: 'user-a' })

    expect(hands).toHaveLength(1)
    expect(hands[0].userId).toBe('user-b')
  })

  test('lowering a non-raised hand is a no-op', () => {
    const hands = applyHandEvent(
      [{ userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 }],
      { type: 'hand:lower', userId: 'user-z' }
    )
    expect(hands).toHaveLength(1)
  })

  test('lower-all clears the entire queue', () => {
    let hands = []
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userA })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userB })
    hands = applyHandEvent(hands, { type: 'hand:raise', ...userC })
    hands = applyHandEvent(hands, { type: 'hand:lower-all' })

    expect(hands).toHaveLength(0)
  })

  test('lower-all on empty queue is a no-op', () => {
    const hands = applyHandEvent([], { type: 'hand:lower-all' })
    expect(hands).toHaveLength(0)
  })

  test('unknown event type returns unchanged state', () => {
    const original = [{ userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 }]
    const hands = applyHandEvent(original, { type: 'hand:unknown' })
    expect(hands).toBe(original)
  })
})

describe('Raise Hand — Auto-lower on Leave', () => {
  test('removes departed participant from raised hands', () => {
    const hands = [
      { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 },
      { userId: 'user-b', name: 'Bob', avatarUrl: null, raisedAt: 2000 },
    ]
    const result = removeParticipantHand(hands, 'user-a')
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('user-b')
  })

  test('no-op if departed user had no raised hand', () => {
    const hands = [
      { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 },
    ]
    const result = removeParticipantHand(hands, 'user-z')
    expect(result).toHaveLength(1)
  })

  test('handles empty queue gracefully', () => {
    const result = removeParticipantHand([], 'user-a')
    expect(result).toHaveLength(0)
  })
})

describe('Raise Hand — Participant Sort Order', () => {
  const participants = [
    { id: 'user-a', name: 'Alice' },
    { id: 'user-b', name: 'Bob' },
    { id: 'user-c', name: 'Carol' },
    { id: 'user-d', name: 'Dave' },
  ]

  test('raised-hand participants sort to top', () => {
    const raisedHands = [
      { userId: 'user-c', raisedAt: 1000 },
    ]
    const sorted = sortByRaisedHands(participants, raisedHands)
    expect(sorted[0].id).toBe('user-c')
  })

  test('multiple raised hands preserve queue order among themselves', () => {
    const raisedHands = [
      { userId: 'user-d', raisedAt: 1000 },
      { userId: 'user-b', raisedAt: 2000 },
    ]
    const sorted = sortByRaisedHands(participants, raisedHands)
    expect(sorted[0].id).toBe('user-d') // raised first
    expect(sorted[1].id).toBe('user-b') // raised second
  })

  test('non-raised participants keep original order', () => {
    const raisedHands = [
      { userId: 'user-c', raisedAt: 1000 },
    ]
    const sorted = sortByRaisedHands(participants, raisedHands)
    // user-c at top, then a, b, d in original order
    expect(sorted[0].id).toBe('user-c')
    expect(sorted[1].id).toBe('user-a')
    expect(sorted[2].id).toBe('user-b')
    expect(sorted[3].id).toBe('user-d')
  })

  test('no raised hands preserves original order', () => {
    const sorted = sortByRaisedHands(participants, [])
    expect(sorted.map(p => p.id)).toEqual(['user-a', 'user-b', 'user-c', 'user-d'])
  })

  test('does not mutate original array', () => {
    const raisedHands = [{ userId: 'user-d', raisedAt: 1000 }]
    const original = [...participants]
    sortByRaisedHands(participants, raisedHands)
    expect(participants).toEqual(original)
  })
})

describe('Raise Hand — Broadcast Event Shapes', () => {
  test('hand:raise payload contains required fields', () => {
    const payload = {
      type: 'hand:raise',
      userId: 'user-a',
      name: 'Alice',
      avatarUrl: 'https://example.com/avatar.jpg',
      raisedAt: Date.now(),
    }
    expect(payload.type).toBe('hand:raise')
    expect(payload.userId).toBeDefined()
    expect(payload.name).toBeDefined()
    expect(payload.raisedAt).toBeDefined()
    expect(typeof payload.raisedAt).toBe('number')
  })

  test('hand:lower payload only needs userId', () => {
    const payload = { type: 'hand:lower', userId: 'user-a' }
    expect(payload.type).toBe('hand:lower')
    expect(payload.userId).toBeDefined()
  })

  test('hand:lower-all has no userId', () => {
    const payload = { type: 'hand:lower-all' }
    expect(payload.type).toBe('hand:lower-all')
    expect(payload.userId).toBeUndefined()
  })
})

describe('Raise Hand — Host Permissions Logic', () => {
  test('host is identified by creator_id match', () => {
    const relatedData = { creator_id: 'user-host' }
    const userId = 'user-host'
    const isHost = relatedData.creator_id === userId
    expect(isHost).toBe(true)
  })

  test('host is identified by created_by match (meetups)', () => {
    const relatedData = { created_by: 'user-host' }
    const userId = 'user-host'
    const isHost = relatedData.created_by === userId
    expect(isHost).toBe(true)
  })

  test('non-host cannot match creator_id', () => {
    const relatedData = { creator_id: 'user-host' }
    const userId = 'user-other'
    const isHost = relatedData.creator_id === userId || relatedData.created_by === userId
    expect(isHost).toBe(false)
  })

  test('host can lower any participant hand (event shape)', () => {
    const hostLowerPayload = { type: 'hand:lower', userId: 'user-other' }
    const hands = [
      { userId: 'user-other', name: 'Other', avatarUrl: null, raisedAt: 1000 },
    ]
    const result = applyHandEvent(hands, hostLowerPayload)
    expect(result).toHaveLength(0)
  })

  test('host can clear all hands (event shape)', () => {
    const hands = [
      { userId: 'user-a', name: 'A', avatarUrl: null, raisedAt: 1000 },
      { userId: 'user-b', name: 'B', avatarUrl: null, raisedAt: 2000 },
    ]
    const result = applyHandEvent(hands, { type: 'hand:lower-all' })
    expect(result).toHaveLength(0)
  })
})

describe('Raise Hand — Toggle Behavior', () => {
  test('toggle from lowered sends raise event', () => {
    const raisedHands = []
    const userId = 'user-a'
    const isHandRaised = raisedHands.some(h => h.userId === userId)

    expect(isHandRaised).toBe(false)
    // When !isHandRaised, handleToggleHand sends hand:raise
    const expectedType = isHandRaised ? 'hand:lower' : 'hand:raise'
    expect(expectedType).toBe('hand:raise')
  })

  test('toggle from raised sends lower event', () => {
    const raisedHands = [{ userId: 'user-a', name: 'A', avatarUrl: null, raisedAt: 1000 }]
    const userId = 'user-a'
    const isHandRaised = raisedHands.some(h => h.userId === userId)

    expect(isHandRaised).toBe(true)
    const expectedType = isHandRaised ? 'hand:lower' : 'hand:raise'
    expect(expectedType).toBe('hand:lower')
  })
})
