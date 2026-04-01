/**
 * Tests for lib/coffeeChatHelpers.js — coffee chat lifecycle.
 *
 * Uses a mock Supabase client to verify the correct queries and
 * status transitions are made without hitting a real database.
 */

import {
  requestCoffeeChat,
  acceptCoffeeChat,
  declineCoffeeChat,
  cancelCoffeeChat,
  completeCoffeeChat,
  getMyCoffeeChats,
  getPendingRequests,
  getSentRequests,
} from '@/lib/coffeeChatHelpers'

// Build a chainable mock Supabase client
function createMockSupabase({ user = { id: 'user-123' }, queryResult = {} } = {}) {
  const chainable = {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: queryResult.data || null, error: queryResult.error || null }),
  }

  // For non-single operations (decline, cancel, complete), eq returns the final result
  chainable.eq.mockImplementation(() => {
    // Return chainable so .select().single() can follow for accept
    return {
      ...chainable,
      // If no more chaining, resolve directly
      then: (resolve) => resolve({ data: queryResult.data || null, error: queryResult.error || null }),
    }
  })

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockReturnValue(chainable),
    _chain: chainable,
  }
}

describe('requestCoffeeChat', () => {
  test('creates a pending coffee chat with correct fields', async () => {
    const mockData = { id: 'chat-1', status: 'pending', requester_id: 'user-123' }
    const supabase = createMockSupabase({ queryResult: { data: mockData } })

    const result = await requestCoffeeChat(supabase, {
      recipientId: 'user-456',
      scheduledTime: new Date('2026-04-01T14:00:00Z'),
      topic: 'Career advice',
      notes: 'Would love to chat about your experience',
    })

    expect(supabase.from).toHaveBeenCalledWith('coffee_chats')
    expect(supabase._chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        requester_id: 'user-123',
        recipient_id: 'user-456',
        topic: 'Career advice',
        notes: 'Would love to chat about your experience',
        status: 'pending',
      }),
    ])
    expect(result).toEqual(mockData)
  })

  test('throws when user is not authenticated', async () => {
    const supabase = createMockSupabase({ user: null })

    await expect(
      requestCoffeeChat(supabase, {
        recipientId: 'user-456',
        scheduledTime: new Date(),
      })
    ).rejects.toThrow('Not authenticated')
  })

  test('sets null for optional topic and notes', async () => {
    const supabase = createMockSupabase({ queryResult: { data: { id: 'chat-1' } } })

    await requestCoffeeChat(supabase, {
      recipientId: 'user-456',
      scheduledTime: new Date(),
    })

    expect(supabase._chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        topic: null,
        notes: null,
      }),
    ])
  })

  test('throws on database error', async () => {
    const supabase = createMockSupabase({
      queryResult: { error: { message: 'DB error' }, data: null },
    })

    await expect(
      requestCoffeeChat(supabase, {
        recipientId: 'user-456',
        scheduledTime: new Date(),
      })
    ).rejects.toBeTruthy()
  })
})

describe('acceptCoffeeChat', () => {
  test('updates status to accepted and generates room URL', async () => {
    const mockData = { id: 'chat-1', status: 'accepted', room_url: 'https://...' }
    const supabase = createMockSupabase({ queryResult: { data: mockData } })

    const result = await acceptCoffeeChat(supabase, 'chat-1')

    expect(supabase.from).toHaveBeenCalledWith('coffee_chats')
    expect(supabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        room_url: expect.stringContaining('chat-1'),
        video_link: expect.stringContaining('chat-1'),
      })
    )
  })

  test('room URL contains the chat ID', async () => {
    const supabase = createMockSupabase({ queryResult: { data: {} } })

    await acceptCoffeeChat(supabase, 'abc-123')

    const updateCall = supabase._chain.update.mock.calls[0][0]
    expect(updateCall.room_url).toContain('abc-123')
    expect(updateCall.room_url).toMatch(/^https:\/\/circlew\.daily\.co\//)
  })
})

describe('declineCoffeeChat', () => {
  test('updates status to declined', async () => {
    const supabase = createMockSupabase()

    await declineCoffeeChat(supabase, 'chat-1')

    expect(supabase.from).toHaveBeenCalledWith('coffee_chats')
    expect(supabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'declined' })
    )
  })
})

describe('cancelCoffeeChat', () => {
  test('updates status to cancelled', async () => {
    const supabase = createMockSupabase()

    await cancelCoffeeChat(supabase, 'chat-1')

    expect(supabase.from).toHaveBeenCalledWith('coffee_chats')
    expect(supabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    )
  })
})

describe('completeCoffeeChat', () => {
  test('updates status to completed with timestamp', async () => {
    const supabase = createMockSupabase()

    await completeCoffeeChat(supabase, 'chat-1')

    expect(supabase.from).toHaveBeenCalledWith('coffee_chats')
    expect(supabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
      })
    )
  })

  test('completed_at is a valid ISO timestamp', async () => {
    const supabase = createMockSupabase()

    await completeCoffeeChat(supabase, 'chat-1')

    const updateCall = supabase._chain.update.mock.calls[0][0]
    const parsedDate = new Date(updateCall.completed_at)
    expect(parsedDate.getTime()).not.toBeNaN()
  })
})

// Build a more flexible mock for query functions (getMyCoffeeChats, getPendingRequests, getSentRequests)
function createQueryMockSupabase({ user = { id: 'user-123' }, tables = {} } = {}) {
  function makeChain(resolvedValue) {
    const chain = {}
    const methods = ['select', 'eq', 'or', 'in', 'order', 'contains', 'limit', 'insert', 'update']
    methods.forEach(m => {
      chain[m] = jest.fn().mockReturnValue(chain)
    })
    chain.single = jest.fn().mockResolvedValue(resolvedValue)
    // Make chain thenable so await works on the chain itself
    chain.then = (resolve) => resolve(resolvedValue)
    return chain
  }

  const sb = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn((table) => {
      const result = tables[table] || { data: [], error: null }
      return makeChain(result)
    }),
  }
  return sb
}

describe('getMyCoffeeChats', () => {
  test('returns empty array when no chats exist', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: [], error: null },
      },
    })
    const result = await getMyCoffeeChats(supabase)
    expect(result).toEqual([])
  })

  test('throws when user is not authenticated', async () => {
    const supabase = createQueryMockSupabase({ user: null })
    await expect(getMyCoffeeChats(supabase)).rejects.toThrow('Not authenticated')
  })

  test('attaches requester and recipient profiles to chats', async () => {
    const chats = [
      { id: 'chat-1', requester_id: 'user-123', recipient_id: 'user-456' },
    ]
    const profiles = [
      { id: 'user-123', name: 'Alice' },
      { id: 'user-456', name: 'Bob' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: chats, error: null },
        profiles: { data: profiles, error: null },
      },
    })
    const result = await getMyCoffeeChats(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].requester.name).toBe('Alice')
    expect(result[0].recipient.name).toBe('Bob')
  })

  test('handles profile fetch error gracefully (returns null profiles)', async () => {
    const chats = [
      { id: 'chat-1', requester_id: 'user-123', recipient_id: 'user-456' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: chats, error: null },
        profiles: { data: null, error: { message: 'fetch error' } },
      },
    })
    const result = await getMyCoffeeChats(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].requester).toBeNull()
    expect(result[0].recipient).toBeNull()
  })

  test('handles null profiles gracefully', async () => {
    const chats = [
      { id: 'chat-1', requester_id: 'user-123', recipient_id: 'user-999' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: chats, error: null },
        profiles: { data: [], error: null },
      },
    })
    const result = await getMyCoffeeChats(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].requester).toBeNull()
    expect(result[0].recipient).toBeNull()
  })

  test('throws on database error', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: null, error: { message: 'DB error' } },
      },
    })
    await expect(getMyCoffeeChats(supabase)).rejects.toBeTruthy()
  })
})

describe('getPendingRequests', () => {
  test('returns empty array when no pending requests', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: [], error: null },
      },
    })
    const result = await getPendingRequests(supabase)
    expect(result).toEqual([])
  })

  test('throws when user is not authenticated', async () => {
    const supabase = createQueryMockSupabase({ user: null })
    await expect(getPendingRequests(supabase)).rejects.toThrow('Not authenticated')
  })

  test('auto-declines stale requests and returns only active ones', async () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const requests = [
      { id: 'stale-1', requester_id: 'user-old', recipient_id: 'user-123', scheduled_time: staleDate },
      { id: 'active-1', requester_id: 'user-456', recipient_id: 'user-123', scheduled_time: futureDate },
    ]
    const profiles = [
      { id: 'user-456', name: 'Bob' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: requests, error: null },
        profiles: { data: profiles, error: null },
      },
    })
    const result = await getPendingRequests(supabase)
    // Only the active request should be returned
    expect(result).toHaveLength(1)
    expect(result[0].requester.name).toBe('Bob')
  })

  test('returns empty when all requests are stale', async () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const requests = [
      { id: 'stale-1', requester_id: 'user-old', recipient_id: 'user-123', scheduled_time: staleDate },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: requests, error: null },
        profiles: { data: [], error: null },
      },
    })
    const result = await getPendingRequests(supabase)
    expect(result).toEqual([])
  })

  test('returns pending requests with requester profiles', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const requests = [
      { id: 'req-1', requester_id: 'user-456', recipient_id: 'user-123', scheduled_time: futureDate },
    ]
    const profiles = [
      { id: 'user-456', name: 'Bob' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: requests, error: null },
        profiles: { data: profiles, error: null },
      },
    })
    const result = await getPendingRequests(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].requester.name).toBe('Bob')
  })

  test('throws on database error', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: null, error: { message: 'DB error' } },
      },
    })
    await expect(getPendingRequests(supabase)).rejects.toBeTruthy()
  })
})

describe('getSentRequests', () => {
  test('returns empty array when no sent requests', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: [], error: null },
      },
    })
    const result = await getSentRequests(supabase)
    expect(result).toEqual([])
  })

  test('throws when user is not authenticated', async () => {
    const supabase = createQueryMockSupabase({ user: null })
    await expect(getSentRequests(supabase)).rejects.toThrow('Not authenticated')
  })

  test('returns sent requests with recipient profiles', async () => {
    const requests = [
      { id: 'req-1', requester_id: 'user-123', recipient_id: 'user-789' },
    ]
    const profiles = [
      { id: 'user-789', name: 'Carol' },
    ]
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: requests, error: null },
        profiles: { data: profiles, error: null },
      },
    })
    const result = await getSentRequests(supabase)
    expect(result).toHaveLength(1)
    expect(result[0].recipient.name).toBe('Carol')
  })

  test('throws on database error', async () => {
    const supabase = createQueryMockSupabase({
      tables: {
        coffee_chats: { data: null, error: { message: 'DB error' } },
      },
    })
    await expect(getSentRequests(supabase)).rejects.toBeTruthy()
  })
})

describe('error paths', () => {
  test('acceptCoffeeChat throws on database error', async () => {
    const supabase = createMockSupabase({
      queryResult: { error: { message: 'DB error' }, data: null },
    })
    await expect(acceptCoffeeChat(supabase, 'chat-1')).rejects.toBeTruthy()
  })

  test('declineCoffeeChat throws on database error', async () => {
    const supabase = createMockSupabase({
      queryResult: { error: { message: 'DB error' }, data: null },
    })
    await expect(declineCoffeeChat(supabase, 'chat-1')).rejects.toBeTruthy()
  })

  test('cancelCoffeeChat throws on database error', async () => {
    const supabase = createMockSupabase({
      queryResult: { error: { message: 'DB error' }, data: null },
    })
    await expect(cancelCoffeeChat(supabase, 'chat-1')).rejects.toBeTruthy()
  })

  test('completeCoffeeChat throws on database error', async () => {
    const supabase = createMockSupabase({
      queryResult: { error: { message: 'DB error' }, data: null },
    })
    await expect(completeCoffeeChat(supabase, 'chat-1')).rejects.toBeTruthy()
  })
})
