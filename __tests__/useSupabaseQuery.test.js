/**
 * Tests for useSupabaseQuery hook — centralized SWR + Supabase caching layer.
 */

// Mock SWR
const mockUseSWR = jest.fn()
jest.mock('swr', () => ({
  __esModule: true,
  default: (...args) => mockUseSWR(...args),
  mutate: jest.fn(),
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const { useSupabaseQuery, invalidateQuery } = require('@/hooks/useSupabaseQuery')
const { supabase } = require('@/lib/supabase')

describe('useSupabaseQuery', () => {
  beforeEach(() => {
    mockUseSWR.mockReset()
  })

  test('passes key and fetcher to SWR with correct defaults', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: true })

    const queryFn = jest.fn()
    useSupabaseQuery('test-key', queryFn)

    expect(mockUseSWR).toHaveBeenCalledWith(
      'test-key',
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 30000,
        errorRetryCount: 2,
      })
    )
  })

  test('calls queryFn with supabase client when fetcher executes', async () => {
    let capturedFetcher
    mockUseSWR.mockImplementation((key, fetcher, opts) => {
      capturedFetcher = fetcher
      return { data: null, error: null, isLoading: true }
    })

    const queryFn = jest.fn().mockResolvedValue([{ id: 1 }])
    useSupabaseQuery('test-key', queryFn)

    const result = await capturedFetcher()
    expect(queryFn).toHaveBeenCalledWith(supabase)
    expect(result).toEqual([{ id: 1 }])
  })

  test('returns null key to skip fetching (conditional queries)', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false })

    useSupabaseQuery(null, jest.fn())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })

  test('allows overriding default SWR options', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: true })

    useSupabaseQuery('key', jest.fn(), { dedupingInterval: 5000, revalidateOnFocus: true })

    expect(mockUseSWR).toHaveBeenCalledWith(
      'key',
      expect.any(Function),
      expect.objectContaining({
        dedupingInterval: 5000,
        revalidateOnFocus: true,
      })
    )
  })

  test('invalidateQuery re-exports SWR mutate', () => {
    const { mutate } = require('swr')
    expect(invalidateQuery).toBe(mutate)
  })
})
