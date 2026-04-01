/**
 * Tests for hooks/useJourney.js — pending recaps tracking.
 */

import { renderHook, act } from '@testing-library/react'

// Mock supabase
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}))

jest.mock('@/lib/dateUtils', () => ({
  parseLocalDate: (s) => new Date(s),
}))

const useJourney = require('@/hooks/useJourney').default

const currentUser = { id: 'user-1' }

function makeChain(result) {
  const chain = {}
  const methods = ['select', 'eq', 'neq', 'in', 'or', 'gte', 'order', 'limit', 'contains']
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single = jest.fn().mockResolvedValue(result)
  // Use a getter so .then is fresh for each await
  Object.defineProperty(chain, 'then', {
    get: () => (resolve) => resolve(result),
    configurable: true,
  })
  return chain
}

describe('useJourney', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockRpc.mockReset()
  })

  test('initializes with empty pending recaps', () => {
    const { result } = renderHook(() => useJourney(currentUser))
    expect(result.current.pendingRecaps).toEqual([])
  })

  test('loadPendingRecaps calls supabase with correct tables', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: [], error: null }))

    const { result } = renderHook(() => useJourney(currentUser))

    await act(async () => {
      await result.current.loadPendingRecaps()
    })

    expect(mockFrom).toHaveBeenCalledWith('call_recaps')
    expect(mockFrom).toHaveBeenCalledWith('recap_views')
    expect(result.current.pendingRecaps).toEqual([])
  })

  test('loadPendingRecaps handles errors gracefully', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'fail' } }))

    const { result } = renderHook(() => useJourney(currentUser))

    await act(async () => {
      await result.current.loadPendingRecaps()
    })

    expect(result.current.pendingRecaps).toEqual([])
  })

  test('loadPendingRecaps handles missing table errors silently', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'relation does not exist' } }))

    const { result } = renderHook(() => useJourney(currentUser))

    await act(async () => {
      await result.current.loadPendingRecaps()
    })

    expect(result.current.pendingRecaps).toEqual([])
  })

  test('setPendingRecaps updates state', async () => {
    const { result } = renderHook(() => useJourney(currentUser))

    act(() => {
      result.current.setPendingRecaps([{ id: 'r1' }])
    })

    expect(result.current.pendingRecaps).toHaveLength(1)
  })
})
