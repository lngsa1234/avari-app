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
