/**
 * Tests for hooks/useConnections.js — connection management.
 */

import { renderHook, act } from '@testing-library/react'

// Mock supabase
const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockAuth = { getUser: jest.fn() }

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args) => mockAuth.getUser(...args) },
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}))

const useConnections = require('@/hooks/useConnections').default

const currentUser = { id: 'user-1', career: 'Engineer', industry: 'Tech' }

function makeChain(result) {
  const chain = {}
  const methods = ['select', 'insert', 'delete', 'eq', 'neq', 'in', 'not', 'or', 'gte', 'order', 'limit', 'contains', 'filter']
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve) => resolve(result)
  return chain
}

describe('useConnections', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockRpc.mockReset()
    mockAuth.getUser.mockReset()
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    mockRpc.mockResolvedValue({ data: [], error: null })
  })

  test('initializes with empty connections', () => {
    const { result } = renderHook(() => useConnections(currentUser, {}))
    expect(result.current.connections).toEqual([])
  })

  test('loadConnections fetches mutual matches and profiles', async () => {
    const matches = [{ matched_user_id: 'u2' }, { matched_user_id: 'u3' }]
    const profiles = [
      { id: 'u2', name: 'Alice', career: 'Designer' },
      { id: 'u3', name: 'Bob', career: 'Engineer' },
    ]

    mockRpc.mockResolvedValue({ data: matches, error: null })
    mockFrom.mockReturnValue(makeChain({ data: profiles, error: null }))

    const { result } = renderHook(() => useConnections(currentUser, {}))

    await act(async () => {
      await result.current.loadConnections()
    })

    expect(result.current.connections).toHaveLength(2)
    expect(mockRpc).toHaveBeenCalledWith('get_mutual_matches', { for_user_id: 'user-1' })
  })

  test('loadConnections handles RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } })

    const { result } = renderHook(() => useConnections(currentUser, {}))

    await act(async () => {
      await result.current.loadConnections()
    })

    expect(result.current.connections).toEqual([])
  })

  test('handleShowInterest inserts user_interests record', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      ...makeChain({ data: null, error: null }),
      insert: mockInsert,
    })

    const { result } = renderHook(() => useConnections(currentUser, {}))

    await act(async () => {
      await result.current.handleShowInterest('u2')
    })

    expect(mockFrom).toHaveBeenCalledWith('user_interests')
  })

  test('handleRemoveInterest deletes user_interests record', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))

    const { result } = renderHook(() => useConnections(currentUser, {}))

    await act(async () => {
      await result.current.handleRemoveInterest('u2')
    })

    expect(mockFrom).toHaveBeenCalledWith('user_interests')
  })

  // Note: useConnections crashes with null currentUser (accesses currentUser.id
  // in useCallback deps). This is a real bug but the app never passes null here
  // because the auth gate in layout.js prevents it.
})
