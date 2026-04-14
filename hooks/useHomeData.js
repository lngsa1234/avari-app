'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { parseLocalDate, isCoffeeChatUpcoming } from '@/lib/dateUtils'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery, invalidateQuery } from '@/hooks/useSupabaseQuery'

/**
 * Fetch and process primary home page data via RPC.
 * Pure function — no React state, just returns processed data.
 */
async function fetchPrimaryHomeData(sb, userId) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 1)
  const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`

  const { data: homeData, error } = await sb
    .rpc('get_home_page_data', { p_user_id: userId, p_cutoff_date: cutoff })

  if (error) throw error

  const now = new Date()
  const chats = homeData.coffee_chats || []
  const coffeeProfiles = homeData.coffee_profiles || []

  // Process coffee chats with profiles
  let upcomingCoffeeChats = []
  if (coffeeProfiles.length > 0) {
    const profileMap = {}
    coffeeProfiles.forEach(p => { profileMap[p.id] = p })
    upcomingCoffeeChats = chats.filter(chat => isCoffeeChatUpcoming(chat)).map(chat => {
      const otherId = chat.requester_id === userId ? chat.recipient_id : chat.requester_id
      return { ...chat, _otherPerson: profileMap[otherId] || null }
    })
  }

  return {
    meetups: homeData.meetups || [],
    userSignups: homeData.user_signups || [],
    upcomingCoffeeChats,
    unreadMessageCount: homeData.unread_count || 0,
    groupsCount: homeData.groups_count || 0,
    coffeeChatsCount: homeData.coffee_completed_count || 0,
    // Raw data needed by secondary fetch
    _incomingInterests: homeData.incoming_interests || [],
    _attendedSignups: homeData.attended_signups || [],
    _createdCircles: homeData.created_circles || [],
    _circleInvitations: homeData.circle_invitations || [],
    _memberCircleIds: homeData.member_circle_ids || [],
  }
}

export default function useHomeData(currentUser) {
  // === PRIMARY DATA: SWR-cached RPC call ===
  const { data: primary, isLoading: loadingMeetups, mutate: mutatePrimary } = useSupabaseQuery(
    currentUser?.id ? `home-primary-${currentUser.id}` : null,
    (sb) => fetchPrimaryHomeData(sb, currentUser.id),
  )

  // Destructure primary data with safe defaults
  const meetups = primary?.meetups || []
  const userSignups = primary?.userSignups || []
  const upcomingCoffeeChats = primary?.upcomingCoffeeChats || []
  const unreadMessageCount = primary?.unreadMessageCount || 0
  const groupsCount = primary?.groupsCount || 0
  const coffeeChatsCount = primary?.coffeeChatsCount || 0

  // === SECONDARY DATA: deferred, non-blocking (still useState for now) ===
  const [signups, setSignups] = useState({})
  const [connectionRequests, setConnectionRequests] = useState([])
  const [circleJoinRequests, setCircleJoinRequests] = useState([])
  const [circleInvitations, setCircleInvitations] = useState([])
  const [homeEventRecs, setHomeEventRecs] = useState([])
  const [homeCircleRecs, setHomeCircleRecs] = useState([])

  // === PEOPLE RECS: separate SWR query for caching across navigations ===
  const { data: homePeopleRecs = [], mutate: mutatePeopleRecs } = useSupabaseQuery(
    currentUser?.id ? `home-people-recs-${currentUser.id}` : null,
    async (sb) => {
      const { data: mutualMatchesData } = await sb.rpc('get_mutual_matches', { for_user_id: currentUser.id })
      const mutualConnectedIds = new Set((mutualMatchesData || []).map(m => m.matched_user_id))

      // Try AI recommendations first
      const { data: peopleData } = await sb
        .from('connection_recommendations')
        .select('*')
        .eq('user_id', currentUser.id)
        .neq('status', 'dismissed')
        .order('match_score', { ascending: false })
        .limit(6)

      let recs = []
      if (peopleData?.length > 0) {
        const seen = new Set()
        const deduped = peopleData.filter(r => {
          if (mutualConnectedIds.has(r.recommended_user_id)) return false
          if (seen.has(r.recommended_user_id)) return false
          seen.add(r.recommended_user_id)
          return true
        }).slice(0, 3)
        if (deduped.length > 0) {
          const profileIds = deduped.map(r => r.recommended_user_id)
          const { data: recProfiles } = await sb
            .from('profiles')
            .select('id, name, career, profile_picture')
            .in('id', profileIds)
          const recProfileMap = {}
          ;(recProfiles || []).forEach(p => { recProfileMap[p.id] = p })
          recs = deduped.map(r => {
            const reasons = []
            if (r.reason) reasons.push({ reason: r.reason })
            if (r.shared_topics?.length > 0) {
              r.shared_topics.forEach(t => reasons.push({ reason: t }))
            }
            return { ...r, match_reasons: reasons, profile: recProfileMap[r.recommended_user_id] || null }
          }).filter(r => r.profile)
        }
      }

      // Fallback: recently active community members
      if (recs.length === 0) {
        const activeCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: communityProfiles } = await sb
          .from('profiles')
          .select('id, name, career, profile_picture, last_active, industry, hook, city, state')
          .neq('id', currentUser.id)
          .not('name', 'is', null)
          .not('last_active', 'is', null)
          .gte('last_active', activeCutoff)
          .order('last_active', { ascending: false })
          .limit(6)
        if (communityProfiles?.length > 0) {
          const myCareer = (currentUser.career || '').toLowerCase()
          const myIndustry = (currentUser.industry || '').toLowerCase()
          const myCity = (currentUser.city || '').toLowerCase()
          const careerKeywords = myCareer.split(/[\s,\/]+/).filter(w => w.length > 2)
          recs = communityProfiles
            .filter(p => !mutualConnectedIds.has(p.id))
            .map(p => {
              const reasons = []
              let score = 0
              const theirCareer = (p.career || '').toLowerCase()
              if (careerKeywords.some(kw => theirCareer.includes(kw))) {
                reasons.push({ reason: 'Similar role' })
                score += 2
              }
              if (p.industry) {
                if (myIndustry && p.industry.toLowerCase().includes(myIndustry)) {
                  reasons.push({ reason: `Same industry: ${p.industry}` })
                  score += 2
                } else {
                  reasons.push({ reason: p.industry })
                }
              }
              if (p.city && myCity && p.city.toLowerCase() === myCity) {
                reasons.push({ reason: `Same city: ${p.city}` })
                score += 1
              }
              return { id: p.id, recommended_user_id: p.id, match_score: score, match_reasons: reasons, profile: p }
            })
            .filter(r => r.match_reasons.length > 0)
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 3)
        }
      }

      return recs
    }
  )

  const homeRecsLoaded = homePeopleRecs !== undefined

  // Track whether secondary data has been loaded for this primary fetch
  const secondaryLoadedForRef = useRef(null)

  // Load secondary data when primary data arrives
  useEffect(() => {
    if (!primary || !currentUser?.id) return
    // Only load secondary once per primary data version
    const key = JSON.stringify([primary.meetups?.length, primary._incomingInterests?.length])
    if (secondaryLoadedForRef.current === key) return
    secondaryLoadedForRef.current = key

    loadSecondaryData(primary)
  }, [primary, currentUser?.id])

  // Update attended count side effect (from old loadHomePageData)
  useEffect(() => {
    if (!primary?._attendedSignups || !currentUser?.id) return
    const now = new Date()
    const attendedCount = primary._attendedSignups.filter(signup => {
      try {
        if (!signup.date) return false
        const meetupDate = parseLocalDate(signup.date)
        if (isNaN(meetupDate.getTime())) return false
        const meetupTime = signup.time || '00:00'
        const [hours, minutes] = meetupTime.split(':').map(Number)
        meetupDate.setHours(hours, minutes, 0, 0)
        return meetupDate < now
      } catch { return false }
    }).length
    if (attendedCount !== currentUser.meetups_attended) {
      supabase.from('profiles').update({ meetups_attended: attendedCount }).eq('id', currentUser.id)
    }
  }, [primary?._attendedSignups, currentUser?.id])

  // Wrapper for backward compatibility — triggers SWR revalidation
  const loadHomePageData = useCallback(async () => {
    mutatePrimary()
  }, [mutatePrimary])

  // === DEFERRED: Load secondary data in background ===
  const loadSecondaryData = useCallback(async (primaryData) => {
    try {
      const incomingInterests = primaryData._incomingInterests || []
      const createdCircles = primaryData._createdCircles || []
      const circleInvitationsData = primaryData._circleInvitations || []
      const meetupsData = primaryData.meetups || []
      const userSignupsData = primaryData.userSignups || []

      const requestUserIds = incomingInterests.map(i => i.user_id)

      const createdCircleIds = createdCircles.map(c => c.id)
      const circleNameMap = {}
      createdCircles.forEach(c => { circleNameMap[c.id] = c.name })

      const invitations = circleInvitationsData
      const creatorIds = [...new Set(invitations.map(inv => inv.creator_id).filter(Boolean))]

          // Fire all secondary queries in parallel
          const deferredPromises = []
          const deferredKeys = []

          if (requestUserIds.length > 0) {
            deferredPromises.push(supabase.from('user_interests').select('interested_in_user_id').eq('user_id', currentUser.id))
            deferredKeys.push('myInterests')
          }
          if (requestUserIds.length > 0) {
            const pendingIds = incomingInterests.map(i => i.user_id)
            deferredPromises.push(supabase.from('profiles').select('id, name, career, city, state, profile_picture').in('id', pendingIds))
            deferredKeys.push('reqProfiles')
          }
          if (requestUserIds.length > 0) {
            deferredPromises.push(supabase.from('ignored_connection_requests').select('ignored_user_id, created_at').eq('user_id', currentUser.id))
            deferredKeys.push('ignoredRequests')
          }
          if (createdCircleIds.length > 0) {
            deferredPromises.push(supabase.from('connection_group_members').select('id, user_id, group_id, invited_at').eq('status', 'pending').in('group_id', createdCircleIds))
            deferredKeys.push('pendingMembers')
          }
          if (creatorIds.length > 0) {
            deferredPromises.push(supabase.from('profiles').select('id, name, career, city, state, profile_picture').in('id', creatorIds))
            deferredKeys.push('creatorProfiles')
          }
          if (meetupsData.length > 0) {
            const meetupIds = meetupsData.map(m => m.id)
            deferredPromises.push(supabase.from('meetup_signups').select('*').in('meetup_id', meetupIds))
            deferredKeys.push('signups')
          }

          // Recommendations + mutual matches — run in parallel with other secondary data
          deferredPromises.push(
            supabase.from('event_recommendations').select('*').eq('user_id', currentUser.id).in('status', ['pending', 'viewed']).order('match_score', { ascending: false }).limit(4)
          )
          deferredKeys.push('eventRecs')
          deferredPromises.push(
            supabase.from('circle_match_scores').select('*, circle:connection_groups(id, name, is_active, connection_group_members(count))').eq('user_id', currentUser.id).order('match_score', { ascending: false }).limit(4)
          )
          deferredKeys.push('circleRecs')
          // People recs now handled by separate SWR query (home-people-recs)

          const deferredResults = deferredPromises.length > 0 ? await Promise.all(deferredPromises) : []
          const dMap = {}
          deferredKeys.forEach((key, i) => { dMap[key] = deferredResults[i]?.data || [] })

          // Process connection requests
          if (requestUserIds.length > 0) {
            const myInterestIds = new Set((dMap.myInterests || []).map(i => i.interested_in_user_id))
            const ignoredMap = {}
            ;(dMap.ignoredRequests || []).forEach(i => { ignoredMap[i.ignored_user_id] = i.created_at })
            const pendingRequests = incomingInterests.filter(i => !myInterestIds.has(i.user_id) && (!ignoredMap[i.user_id] || new Date(i.created_at) > new Date(ignoredMap[i.user_id])))
            const pendingIds = pendingRequests.map(i => i.user_id)
            if (pendingIds.length > 0) {
              const timestampMap = {}
              pendingRequests.forEach(i => { timestampMap[i.user_id] = i.created_at })
              setConnectionRequests((dMap.reqProfiles || []).filter(p => pendingIds.includes(p.id)).map(p => ({
                ...p,
                type: 'connection_request',
                requested_at: timestampMap[p.id]
              })))
            } else {
              setConnectionRequests([])
            }
          } else {
            setConnectionRequests([])
          }

          // Batch-fetch all profiles needed for join requests + signups in ONE query
          const pendingMembers = dMap.pendingMembers || []
          const signupsData = dMap.signups || []
          const allProfileIds = new Set()
          if (pendingMembers.length > 0) pendingMembers.forEach(m => allProfileIds.add(m.user_id))
          if (signupsData.length > 0) signupsData.forEach(s => allProfileIds.add(s.user_id))

          let batchedProfileMap = {}
          if (allProfileIds.size > 0) {
            const { data: batchProfiles } = await supabase
              .from('profiles')
              .select('id, name, career, city, state, profile_picture')
              .in('id', [...allProfileIds])
            ;(batchProfiles || []).forEach(p => { batchedProfileMap[p.id] = p })
          }

          // Process circle join requests
          if (pendingMembers.length > 0) {
            const pendingUserIds = [...new Set(pendingMembers.map(m => m.user_id))]

            const pendingProfileMap = batchedProfileMap

            const joinRequests = pendingMembers.map(m => ({
              id: m.id,
              user: pendingProfileMap[m.user_id] || null,
              circleName: circleNameMap[m.group_id],
              requested_at: m.invited_at,
              type: 'circle_join_request',
            })).filter(r => r.user)

            joinRequests.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
            setCircleJoinRequests(joinRequests)
          } else {
            setCircleJoinRequests([])
          }

          // Process circle invitations
          if (creatorIds.length > 0) {
            const creatorProfileMap = {}
            ;(dMap.creatorProfiles || []).forEach(p => { creatorProfileMap[p.id] = p })

            const invitationItems = invitations
              .map(inv => ({
                id: inv.id,
                group_id: inv.group_id,
                user: creatorProfileMap[inv.creator_id] || null,
                circleName: inv.circle_name,
                requested_at: inv.invited_at,
                type: 'circle_invitation',
              }))
              .filter(inv => inv.user)

            invitationItems.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
            setCircleInvitations(invitationItems)
          } else {
            setCircleInvitations([])
          }

          // Process signups (profiles already batched above)
          if (signupsData.length > 0) {
            const signupsByMeetup = {}
            signupsData.forEach(signup => {
              if (!signupsByMeetup[signup.meetup_id]) signupsByMeetup[signup.meetup_id] = []
              signupsByMeetup[signup.meetup_id].push({ ...signup, profiles: batchedProfileMap[signup.user_id] || null })
            })
            setSignups(signupsByMeetup)
          } else {
            setSignups({})
          }

          // === Process home page recommendation sections (data already fetched in parallel above) ===
          try {
            const eventRes = { status: 'fulfilled', value: { data: dMap.eventRecs || [], error: null } }
            const circleRes = { status: 'fulfilled', value: { data: dMap.circleRecs || [], error: null } }
            // Process event recs
            let eventRecs = []
            const eventData = eventRes.status === 'fulfilled' && !eventRes.value.error ? eventRes.value.data : []
            if (eventData.length > 0) {
              const recMeetupIds = eventData.map(r => r.meetup_id).filter(Boolean)
              if (recMeetupIds.length > 0) {
                const { data: recMeetups } = await supabase
                  .from('meetups')
                  .select('id, topic, date, time, location')
                  .in('id', recMeetupIds)
                const recMeetupMap = {}
                ;(recMeetups || []).forEach(m => { recMeetupMap[m.id] = m })
                const todayStart = new Date()
                todayStart.setHours(0, 0, 0, 0)
                eventRecs = eventData
                  .map(r => ({ ...r, meetup: recMeetupMap[r.meetup_id] || null }))
                  .filter(r => r.meetup && parseLocalDate(r.meetup.date) >= todayStart)
                  .slice(0, 2)
              }
            }
            // Event fallback: upcoming meetups user hasn't signed up for
            if (eventRecs.length === 0 && meetupsData.length > 0) {
              const todayStart = new Date()
              todayStart.setHours(0, 0, 0, 0)
              const signupSet = new Set(userSignupsData)
              eventRecs = meetupsData
                .filter(m => { try { return !signupSet.has(m.id) && parseLocalDate(m.date) >= todayStart } catch { return false } })
                .slice(0, 2)
                .map(m => ({ id: m.id, meetup_id: m.id, match_score: 0.7, match_reasons: [], meetup: { id: m.id, topic: m.topic, date: m.date, time: m.time, location: m.location } }))
            }

            // Process circle recs
            let circleRecs = []
            const circleData = circleRes.status === 'fulfilled' && !circleRes.value.error ? circleRes.value.data : []
            if (circleData.length > 0) {
              circleRecs = circleData.filter(m => m.circle?.is_active).slice(0, 2)
            }
            // Circle fallback: active circles user hasn't joined
            if (circleRecs.length === 0) {
              try {
                const [{ data: myMemberships }, { data: activeCircles }] = await Promise.all([
                  supabase.from('connection_group_members').select('group_id').eq('user_id', currentUser.id),
                  supabase.from('connection_groups').select('id, name, is_active, connection_group_members(count)').eq('is_active', true).order('created_at', { ascending: false }).limit(6),
                ])
                const myGroupIds = new Set((myMemberships || []).map(m => m.group_id))
                if (activeCircles?.length > 0) {
                  circleRecs = activeCircles
                    .filter(c => !myGroupIds.has(c.id))
                    .slice(0, 2)
                    .map(c => ({ id: c.id, circle_id: c.id, match_score: 0.65, match_reasons: [], circle: c }))
                }
              } catch (e) { console.error('[HomeRecs] Circle fallback:', e) }
            }

            // Enrich top circle rec with members + creator for card display
            if (circleRecs.length > 0) {
              try {
                const topCircleId = circleRecs[0].circle_id || circleRecs[0].circle?.id
                if (topCircleId) {
                  const [{ data: circleDetail }, { data: circleMembers }] = await Promise.all([
                    supabase.from('connection_groups').select('id, name, description, creator_id, cadence, meeting_day, time_of_day, image_url').eq('id', topCircleId).single(),
                    supabase.from('connection_group_members').select('user_id, status').eq('group_id', topCircleId).eq('status', 'accepted'),
                  ])
                  if (circleDetail) {
                    const memberUserIds = (circleMembers || []).map(m => m.user_id)
                    // Include the creator_id in the profile fetch so we resolve the
                    // creator's name even for legacy circles where the creator row
                    // isn't in connection_group_members with status='accepted'.
                    const idsToFetch = [...new Set([...memberUserIds, circleDetail.creator_id].filter(Boolean))]
                    let fetchedProfiles = []
                    if (idsToFetch.length > 0) {
                      const { data: profiles } = await supabase.from('profiles').select('id, name, profile_picture').in('id', idsToFetch)
                      fetchedProfiles = profiles || []
                    }
                    // Attach the creator as a dedicated field — UI should prefer
                    // this over finding the creator inside members.
                    const creatorProfile = fetchedProfiles.find(p => p.id === circleDetail.creator_id) || null
                    circleRecs[0].circle = {
                      ...circleRecs[0].circle,
                      ...circleDetail,
                      members: (circleMembers || []).map(m => ({ ...m, user: fetchedProfiles.find(p => p.id === m.user_id) || null })),
                      creator: creatorProfile,
                    }
                  }
                }
              } catch (e) { console.error('[HomeRecs] Circle enrich:', e) }
            }

            setHomeEventRecs(eventRecs)
            setHomeCircleRecs(circleRecs)
          } catch (e) {
            console.error('[HomeRecs] Error:', e)
          }

        } catch (err) {
          console.error('Error loading secondary data:', err)
        }
  }, [currentUser?.id])

  // Refresh functions — trigger SWR revalidation of the primary RPC
  const loadMeetupsFromDatabase = useCallback(async () => {
    mutatePrimary()
    return meetups
  }, [mutatePrimary, meetups])

  const loadSignupsForMeetups = useCallback(async (meetupIds) => {
    try {
      // Build query — filter by meetup IDs if provided
      let query = supabase.from('meetup_signups').select('*')
      if (meetupIds && meetupIds.length > 0) {
        query = query.in('meetup_id', meetupIds)
      }

      const { data: signupsData, error: signupsError } = await query

      if (signupsError) {
        console.error('Error loading signups:', signupsError)
        return
      }

      if (!signupsData || signupsData.length === 0) {
        setSignups({})
        return
      }

      // Get profiles for all signup users in one query
      const userIds = [...new Set(signupsData.map(s => s.user_id))]
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, profile_picture')
        .in('id', userIds)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
      }

      const profilesMap = {}
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap[profile.id] = profile
        })
      }

      // Group by meetup_id
      const signupsByMeetup = {}
      signupsData.forEach(signup => {
        if (!signupsByMeetup[signup.meetup_id]) {
          signupsByMeetup[signup.meetup_id] = []
        }
        signupsByMeetup[signup.meetup_id].push({
          ...signup,
          profiles: profilesMap[signup.user_id] || null
        })
      })

      setSignups(signupsByMeetup)
    } catch (err) {
      console.error('Error loading signups:', err)
    }
  }, [supabase])

  const loadUserSignups = useCallback(async () => {
    // User signups now come from the primary SWR cache — trigger revalidation
    mutatePrimary()
  }, [mutatePrimary])

  // Load incoming connection requests (people interested in me, but not mutual yet)
  const loadConnectionRequests = useCallback(async () => {
    try {
      // Load incoming connection requests (non-mutual interests)

      // Step 1: Get people who expressed interest in current user
      const { data: incomingInterests, error: incomingError } = await supabase
        .from('user_interests')
        .select('user_id, created_at')
        .eq('interested_in_user_id', currentUser.id)

      if (incomingError) throw incomingError

      if (!incomingInterests || incomingInterests.length === 0) {
        setConnectionRequests([])
        return
      }

      // Step 2: Get people current user has expressed interest in (to filter out mutual)
      // and get ignored requests
      const [{ data: myInterestsData, error: myError }, { data: ignoredData }] = await Promise.all([
        supabase.from('user_interests').select('interested_in_user_id').eq('user_id', currentUser.id),
        supabase.from('ignored_connection_requests').select('ignored_user_id').eq('user_id', currentUser.id),
      ])

      if (myError) throw myError

      const myInterestIds = new Set((myInterestsData || []).map(i => i.interested_in_user_id))
      const ignoredIds = new Set((ignoredData || []).map(i => i.ignored_user_id))

      // Step 3: Filter to only non-mutual, non-ignored (pending requests)
      const pendingRequestUserIds = incomingInterests
        .filter(i => !myInterestIds.has(i.user_id) && !ignoredIds.has(i.user_id))
        .map(i => ({ user_id: i.user_id, created_at: i.created_at }))

      if (pendingRequestUserIds.length === 0) {
        setConnectionRequests([])
        return
      }

      // Step 4: Get profile details for pending request users
      const userIds = pendingRequestUserIds.map(p => p.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, profile_picture')
        .in('id', userIds)

      if (profileError) throw profileError

      // Step 5: Combine with request timestamps
      const requestsWithProfiles = pendingRequestUserIds.map(req => {
        const profile = profiles.find(p => p.id === req.user_id)
        return {
          id: req.user_id,
          user: profile,
          requested_at: req.created_at
        }
      }).filter(r => r.user) // Filter out any without profile

      // Sort by most recent first
      requestsWithProfiles.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))

      setConnectionRequests(requestsWithProfiles)
      console.log('✅ Loaded connection requests:', requestsWithProfiles.length)
    } catch (err) {
      console.error('💥 Error loading connection requests:', err)
      setConnectionRequests([])
    }
  }, [currentUser.id, supabase])

  // Accept a circle join request
  const handleAcceptCircleJoin = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', membershipId)

      if (error) throw error
      setCircleJoinRequests(prev => prev.filter(r => r.id !== membershipId))
      invalidateQuery(`circles-page-${currentUser.id}`)
      console.log('✅ Accepted circle join request:', membershipId)
    } catch (err) {
      console.error('💥 Error accepting circle join request:', err)
    }
  }, [supabase, currentUser.id])

  // Decline a circle join request
  const handleDeclineCircleJoin = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .delete()
        .eq('id', membershipId)

      if (error) throw error
      setCircleJoinRequests(prev => prev.filter(r => r.id !== membershipId))
      invalidateQuery(`circles-page-${currentUser.id}`)
      console.log('✅ Declined circle join request:', membershipId)
    } catch (err) {
      console.error('💥 Error declining circle join request:', err)
    }
  }, [supabase, currentUser.id])

  // Accept a circle invitation (invitee perspective)
  const handleAcceptCircleInvitation = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', membershipId)

      if (error) throw error
      setCircleInvitations(prev => prev.filter(r => r.id !== membershipId))
      mutatePrimary()
      console.log('✅ Accepted circle invitation:', membershipId)
    } catch (err) {
      console.error('💥 Error accepting circle invitation:', err)
    }
  }, [supabase, mutatePrimary])

  // Decline a circle invitation (invitee perspective — uses update, not delete, due to RLS)
  const handleDeclineCircleInvitation = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', membershipId)
        .eq('user_id', currentUser.id)

      if (error) throw error
      setCircleInvitations(prev => prev.filter(r => r.id !== membershipId))
      invalidateQuery(`circles-page-${currentUser.id}`)
      console.log('✅ Declined circle invitation:', membershipId)
    } catch (err) {
      console.error('💥 Error declining circle invitation:', err)
    }
  }, [supabase, currentUser.id])

  // Unread count comes from primary SWR cache — trigger revalidation
  const loadUnreadMessageCount = useCallback(async () => {
    mutatePrimary()
  }, [mutatePrimary])

  // Lightweight refresh — SWR revalidation replaces manual re-fetch
  const refreshCoffeeChats = useCallback(async () => {
    mutatePrimary()
  }, [mutatePrimary])

  return {
    // State
    meetups,
    loadingMeetups,
    signups,
    userSignups,
    upcomingCoffeeChats,
    groupsCount,
    coffeeChatsCount,
    unreadMessageCount,
    connectionRequests,
    circleJoinRequests,
    circleInvitations,
    homeEventRecs,
    homeCircleRecs,
    homePeopleRecs,
    homeRecsLoaded,

    // Revalidate primary data (replaces manual setters)
    mutatePrimary,

    // Functions
    loadHomePageData,
    loadMeetupsFromDatabase,
    loadSignupsForMeetups,
    loadUserSignups,
    loadConnectionRequests,
    handleAcceptCircleJoin,
    handleDeclineCircleJoin,
    handleAcceptCircleInvitation,
    handleDeclineCircleInvitation,
    loadUnreadMessageCount,
    refreshCoffeeChats,
    refreshMeetups: loadMeetupsFromDatabase,
    refreshUserSignups: loadUserSignups,
    refreshSignups: loadSignupsForMeetups,
  }
}
