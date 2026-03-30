import useSWR from 'swr'
import { supabase } from '@/lib/supabase'

/**
 * Centralized Supabase query hook with SWR caching.
 *
 * Shows cached data instantly on navigation, refreshes in background.
 * Eliminates loading spinners on repeated visits to the same page.
 *
 * @param {string|null} key - SWR cache key (null to skip fetching)
 * @param {function} queryFn - async (supabase) => data
 * @param {object} opts - SWR options override
 * @returns {{ data, error, isLoading, isValidating, mutate }}
 *
 * Usage:
 *   const { data: meetups, isLoading } = useSupabaseQuery(
 *     'home-meetups',
 *     async (sb) => {
 *       const { data } = await sb.from('meetups').select('*')
 *       return data
 *     }
 *   )
 */
export function useSupabaseQuery(key, queryFn, opts = {}) {
  return useSWR(
    key,
    () => queryFn(supabase),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
      keepPreviousData: true,
      errorRetryCount: 2,
      ...opts,
    }
  )
}

/**
 * Mutate (invalidate) a cached query by key.
 * Use after mutations to force a background refresh.
 *
 * Usage:
 *   import { invalidateQuery } from '@/hooks/useSupabaseQuery'
 *   await supabase.from('meetups').insert(newMeetup)
 *   invalidateQuery('home-meetups')
 */
export { mutate as invalidateQuery } from 'swr'
