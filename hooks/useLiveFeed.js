// hooks/useLiveFeed.js
// Subscribes to feed_events via Supabase Realtime, enriches with profiles,
// and injects synthetic coffee_available items from profiles.open_to_coffee_chat.

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 20

/**
 * Fetch a page of feed events, then enrich with profile/circle data.
 */
async function fetchFeedPage({ before = null, limit = PAGE_SIZE } = {}) {
  let query = supabase
    .from('feed_events')
    .select('id, event_type, actor_id, target_id, circle_id, is_live, metadata, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) return []

  return enrichEvents(data)
}

/**
 * Enrich a single raw Realtime INSERT payload with profile data.
 */
async function enrichEvent(rawEvent) {
  const results = await enrichEvents([rawEvent])
  return results[0] || null
}

/**
 * Batch-enrich feed events with profiles and circle names.
 */
async function enrichEvents(events) {
  // Collect unique IDs
  const userIds = new Set()
  const circleIds = new Set()
  events.forEach(e => {
    if (e.actor_id) userIds.add(e.actor_id)
    if (e.target_id) userIds.add(e.target_id)
    if (e.circle_id) circleIds.add(e.circle_id)
  })

  // Fetch profiles and circles in parallel
  const promises = []
  if (userIds.size > 0) {
    promises.push(
      supabase.from('profiles').select('id, name, profile_picture').in('id', [...userIds])
    )
  } else {
    promises.push(Promise.resolve({ data: [] }))
  }
  if (circleIds.size > 0) {
    promises.push(
      supabase.from('connection_groups').select('id, name, max_members, connection_group_members(count)').eq('connection_group_members.status', 'accepted').in('id', [...circleIds])
    )
  } else {
    promises.push(Promise.resolve({ data: [] }))
  }

  const [profilesResult, circlesResult] = await Promise.all(promises)
  const profileMap = {}
  ;(profilesResult.data || []).forEach(p => { profileMap[p.id] = p })
  const circleMap = {}
  ;(circlesResult.data || []).forEach(c => {
    circleMap[c.id] = {
      ...c,
      member_count: c.connection_group_members?.[0]?.count || 0,
    }
  })

  return events.map(e => ({
    ...e,
    actor: profileMap[e.actor_id] || null,
    target: profileMap[e.target_id] || null,
    circle: circleMap[e.circle_id] || null,
  }))
}

/**
 * Fetch profiles with open_to_coffee_chat = true and return as synthetic feed events.
 */
async function fetchAvailableProfiles(currentUserId) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, profile_picture, career')
    .eq('open_to_coffee_chat', true)
    .neq('id', currentUserId)
    .limit(20)

  if (error || !profiles) return []

  return profiles.map(p => ({
    id: `available-${p.id}`,
    event_type: 'coffee_available',
    is_live: false,
    metadata: { career: p.career },
    expires_at: null,
    created_at: new Date().toISOString(),
    actor: { id: p.id, name: p.name, profile_picture: p.profile_picture },
    target: null,
    circle: null,
    _synthetic: true,
  }))
}

/**
 * useLiveFeed
 *
 * Returns:
 *   events      — enriched feed items, live pinned to top
 *   loading     — initial load in progress
 *   hasMore     — whether more pages exist
 *   loadMore()  — fetch the next page
 *   refresh()   — refetch from the top
 *   liveCount   — number of currently live events
 */
export function useLiveFeed(currentUserId) {
  const [events, setEvents] = useState([])
  const [availableProfiles, setAvailableProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const channelRef = useRef(null)

  // Initial load
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [data, available] = await Promise.all([
        fetchFeedPage(),
        currentUserId ? fetchAvailableProfiles(currentUserId) : [],
      ])
      setEvents(data)
      setAvailableProfiles(available)
      setHasMore(data.length === PAGE_SIZE)
    } catch (err) {
      console.error('[useLiveFeed] initial fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  // Pagination
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    const oldest = events[events.length - 1]
    if (!oldest) return
    try {
      const more = await fetchFeedPage({ before: oldest.created_at })
      setEvents(prev => [...prev, ...more])
      setHasMore(more.length === PAGE_SIZE)
    } catch (err) {
      console.error('[useLiveFeed] loadMore failed:', err)
    }
  }, [events, hasMore, loading])

  // Realtime subscription
  useEffect(() => {
    refresh()

    channelRef.current = supabase
      .channel('feed_events_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events' },
        async (payload) => {
          const enriched = await enrichEvent(payload.new)
          if (!enriched) return
          setEvents(prev => {
            if (prev.some(e => e.id === enriched.id)) return prev
            return [enriched, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'feed_events' },
        (payload) => {
          setEvents(prev =>
            prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'feed_events' },
        (payload) => {
          setEvents(prev => prev.filter(e => e.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Combine DB events + synthetic available profiles
  const now = Date.now()
  const visibleEvents = events.filter(e =>
    !e.expires_at || new Date(e.expires_at).getTime() > now
  )

  // Merge: live pinned to top, then available profiles, then rest chronological
  // Only show coffee_live events once both participants have joined (target_id set)
  const liveEvents = visibleEvents.filter(e => e.is_live && !(e.event_type === 'coffee_live' && !e.target_id))
  const nonLiveEvents = visibleEvents.filter(e => !e.is_live && !(e.event_type === 'coffee_live' && !e.target_id))

  const sorted = [
    ...liveEvents,
    ...availableProfiles,
    ...nonLiveEvents,
  ]

  const liveCount = liveEvents.length

  return { events: sorted, loading, hasMore, loadMore, refresh, liveCount }
}
