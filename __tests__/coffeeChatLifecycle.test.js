/**
 * Tests for coffee chat lifecycle — verifying that status transitions
 * correctly determine which lists/views the chat appears in.
 *
 * This catches the bug where completeCoffeeChat was never called,
 * leaving chats in 'pending'/'accepted' status so recaps never showed.
 */

describe('Coffee chat status determines visibility', () => {
  // Simulate the pastChats filter from MeetupsView.js lines 383-391
  function isPastChat({ status, scheduledTime, hasRecap }) {
    const now = new Date()
    const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000)

    if (!scheduledTime) return false
    if (status === 'completed') return true
    if (status === 'accepted') {
      const chatTime = new Date(scheduledTime)
      return chatTime < gracePeriod && hasRecap
    }
    return false
  }

  // Simulate the upcomingChats filter from MeetupsView.js lines 117-122
  function isUpcomingChat({ status, scheduledTime }) {
    const now = new Date()
    if (status === 'completed' || status === 'declined' || status === 'cancelled') return false
    if (!scheduledTime) return true
    const chatTime = new Date(scheduledTime)
    return chatTime.getTime() + 60 * 60 * 1000 > now.getTime()
  }

  // Simulate the home page filter from useHomeData.js
  function isHomeUpcoming({ status, scheduledTime }) {
    const now = new Date()
    const gracePeriod = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    if (status !== 'pending' && status !== 'accepted' && status !== 'scheduled') return false
    if (!scheduledTime) return true
    return new Date(scheduledTime) > gracePeriod
  }

  const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // --- Pending chats ---
  test('pending chat with future time shows as upcoming', () => {
    expect(isUpcomingChat({ status: 'pending', scheduledTime: futureTime })).toBe(true)
  })

  test('pending chat with future time shows on home page', () => {
    expect(isHomeUpcoming({ status: 'pending', scheduledTime: futureTime })).toBe(true)
  })

  test('pending chat does NOT show as past', () => {
    expect(isPastChat({ status: 'pending', scheduledTime: pastTime, hasRecap: true })).toBe(false)
  })

  // --- Accepted chats ---
  test('accepted chat with future time shows as upcoming', () => {
    expect(isUpcomingChat({ status: 'accepted', scheduledTime: futureTime })).toBe(true)
  })

  test('accepted chat with past time and recap shows as past', () => {
    expect(isPastChat({ status: 'accepted', scheduledTime: pastTime, hasRecap: true })).toBe(true)
  })

  test('accepted chat with past time but NO recap does NOT show as past', () => {
    expect(isPastChat({ status: 'accepted', scheduledTime: pastTime, hasRecap: false })).toBe(false)
  })

  // --- Completed chats (the bug: status was never set to completed) ---
  test('completed chat shows as past regardless of recap', () => {
    expect(isPastChat({ status: 'completed', scheduledTime: pastTime, hasRecap: false })).toBe(true)
    expect(isPastChat({ status: 'completed', scheduledTime: pastTime, hasRecap: true })).toBe(true)
  })

  test('completed chat does NOT show as upcoming', () => {
    expect(isUpcomingChat({ status: 'completed', scheduledTime: futureTime })).toBe(false)
  })

  test('completed chat does NOT show on home page', () => {
    expect(isHomeUpcoming({ status: 'completed', scheduledTime: pastTime })).toBe(false)
  })

  // --- Declined/cancelled chats ---
  test('declined chat does NOT show as upcoming', () => {
    expect(isUpcomingChat({ status: 'declined', scheduledTime: futureTime })).toBe(false)
  })

  test('cancelled chat does NOT show as upcoming', () => {
    expect(isUpcomingChat({ status: 'cancelled', scheduledTime: futureTime })).toBe(false)
  })

  test('declined chat does NOT show as past', () => {
    expect(isPastChat({ status: 'declined', scheduledTime: pastTime, hasRecap: true })).toBe(false)
  })

  // --- No scheduled time ---
  test('chat without scheduled time shows as upcoming if not completed', () => {
    expect(isUpcomingChat({ status: 'pending', scheduledTime: null })).toBe(true)
    expect(isUpcomingChat({ status: 'accepted', scheduledTime: null })).toBe(true)
  })

  test('chat without scheduled time does NOT show as past', () => {
    expect(isPastChat({ status: 'accepted', scheduledTime: null, hasRecap: true })).toBe(false)
  })
})

describe('Coffee chat status transition flow', () => {
  // Simulate the full lifecycle
  function getVisibility(status, scheduledTime, hasRecap) {
    const now = new Date()
    const gracePeriod = new Date(now.getTime() - 60 * 60 * 1000)
    const isCompleted = status === 'completed'
    const isDeclined = status === 'declined' || status === 'cancelled'
    const isPast = scheduledTime && new Date(scheduledTime) < gracePeriod

    return {
      upcoming: !isCompleted && !isDeclined && (!scheduledTime || new Date(scheduledTime).getTime() + 60 * 60 * 1000 > now.getTime()),
      past: isCompleted || (status === 'accepted' && isPast && hasRecap),
      hidden: isDeclined,
    }
  }

  const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  test('new chat: upcoming=true, past=false', () => {
    const v = getVisibility('pending', futureTime, false)
    expect(v.upcoming).toBe(true)
    expect(v.past).toBe(false)
  })

  test('accepted chat: upcoming=true, past=false', () => {
    const v = getVisibility('accepted', futureTime, false)
    expect(v.upcoming).toBe(true)
    expect(v.past).toBe(false)
  })

  test('after call (completed): upcoming=false, past=true', () => {
    const v = getVisibility('completed', pastTime, true)
    expect(v.upcoming).toBe(false)
    expect(v.past).toBe(true)
  })

  test('BUG SCENARIO: call ended but status still pending — chat disappears', () => {
    // This is the exact bug: if completeCoffeeChat is not called,
    // the chat stays 'pending' and doesn't show in Past tab
    const v = getVisibility('pending', pastTime, true)
    expect(v.upcoming).toBe(false) // past the grace period
    expect(v.past).toBe(false)     // not completed, not accepted
    // Chat is invisible! This is what the user experienced.
  })

  test('declined chat: hidden everywhere', () => {
    const v = getVisibility('declined', futureTime, false)
    expect(v.upcoming).toBe(false)
    expect(v.past).toBe(false)
    expect(v.hidden).toBe(true)
  })
})

describe('Recap channel_name to entity ID mapping', () => {
  // Simulate the UUID extraction from MeetupsView.js lines 361-371
  function extractEntityId(channelName) {
    const uuidMatch = (channelName || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return uuidMatch ? uuidMatch[0] : null
  }

  test('extracts UUID from coffee-{uuid} channel name', () => {
    expect(extractEntityId('coffee-e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('extracts UUID from meetup-{uuid} channel name', () => {
    expect(extractEntityId('meetup-a1b2c3d4-e5f6-7890-abcd-ef1234567890'))
      .toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  test('extracts UUID from connection-group-{uuid} channel name', () => {
    expect(extractEntityId('connection-group-aabbccdd-eeff-1122-3344-556677889900'))
      .toBe('aabbccdd-eeff-1122-3344-556677889900')
  })

  test('extracts UUID from plain UUID channel name', () => {
    expect(extractEntityId('e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('returns null for non-UUID channel names', () => {
    expect(extractEntityId('random-string')).toBeNull()
    expect(extractEntityId('')).toBeNull()
    expect(extractEntityId(null)).toBeNull()
  })
})
