/**
 * Tests for hooks/useCoffeeChats.js — coffee chat request management.
 */

import { renderHook, act } from '@testing-library/react'

// Mock dependencies
const mockGetPendingRequests = jest.fn()
const mockAcceptCoffeeChat = jest.fn()
const mockDeclineCoffeeChat = jest.fn()
const mockApiFetch = jest.fn().mockResolvedValue({})

jest.mock('@/lib/coffeeChatHelpers', () => ({
  getPendingRequests: (...args) => mockGetPendingRequests(...args),
  acceptCoffeeChat: (...args) => mockAcceptCoffeeChat(...args),
  declineCoffeeChat: (...args) => mockDeclineCoffeeChat(...args),
}))

jest.mock('@/lib/apiFetch', () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: { mock: true },
}))

const useCoffeeChats = require('@/hooks/useCoffeeChats').default

const currentUser = { id: 'u1' }

describe('useCoffeeChats', () => {
  beforeEach(() => {
    mockGetPendingRequests.mockReset()
    mockAcceptCoffeeChat.mockReset()
    mockDeclineCoffeeChat.mockReset()
    mockApiFetch.mockReset().mockResolvedValue({})
  })

  test('initializes with empty requests', () => {
    const { result } = renderHook(() => useCoffeeChats(currentUser))
    expect(result.current.coffeeChatRequests).toEqual([])
  })

  test('loadCoffeeChatRequests fetches and sets requests', async () => {
    const requests = [{ id: 'cc-1', requester: { name: 'Alice' } }]
    mockGetPendingRequests.mockResolvedValue(requests)

    const { result } = renderHook(() => useCoffeeChats(currentUser))

    await act(async () => {
      await result.current.loadCoffeeChatRequests()
    })

    expect(result.current.coffeeChatRequests).toEqual(requests)
  })

  test('loadCoffeeChatRequests sets empty on error', async () => {
    mockGetPendingRequests.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useCoffeeChats(currentUser))

    await act(async () => {
      await result.current.loadCoffeeChatRequests()
    })

    expect(result.current.coffeeChatRequests).toEqual([])
  })

  test('handleAcceptCoffeeChat accepts and removes from list', async () => {
    const requests = [{ id: 'cc-1' }, { id: 'cc-2' }]
    mockGetPendingRequests.mockResolvedValue(requests)
    mockAcceptCoffeeChat.mockResolvedValue()

    const refreshCoffeeChats = jest.fn()
    const { result } = renderHook(() =>
      useCoffeeChats(currentUser, { refreshCoffeeChats })
    )

    await act(async () => {
      await result.current.loadCoffeeChatRequests()
    })

    await act(async () => {
      await result.current.handleAcceptCoffeeChat('cc-1')
    })

    expect(mockAcceptCoffeeChat).toHaveBeenCalledWith(expect.anything(), 'cc-1')
    expect(result.current.coffeeChatRequests).toHaveLength(1)
    expect(result.current.coffeeChatRequests[0].id).toBe('cc-2')
    expect(refreshCoffeeChats).toHaveBeenCalled()
    expect(mockApiFetch).toHaveBeenCalledWith('/api/notifications/coffee-chat', expect.objectContaining({
      method: 'POST',
    }))
  })

  test('handleDeclineCoffeeChat declines and removes from list', async () => {
    const requests = [{ id: 'cc-1' }]
    mockGetPendingRequests.mockResolvedValue(requests)
    mockDeclineCoffeeChat.mockResolvedValue()

    const { result } = renderHook(() => useCoffeeChats(currentUser))

    await act(async () => {
      await result.current.loadCoffeeChatRequests()
    })

    await act(async () => {
      await result.current.handleDeclineCoffeeChat('cc-1')
    })

    expect(mockDeclineCoffeeChat).toHaveBeenCalledWith(expect.anything(), 'cc-1')
    expect(result.current.coffeeChatRequests).toHaveLength(0)
  })

  test('handleAcceptCoffeeChat handles errors gracefully', async () => {
    mockAcceptCoffeeChat.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useCoffeeChats(currentUser))

    await act(async () => {
      await result.current.handleAcceptCoffeeChat('cc-1')
    })
    // Should not throw
  })
})
