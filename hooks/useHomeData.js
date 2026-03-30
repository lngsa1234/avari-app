'use client'

import { useState, useCallback } from 'react'
import { parseLocalDate } from '@/lib/dateUtils'

export default function useHomeData(currentUser, supabase) {
  // State variables
  const [meetups, setMeetups] = useState([])
  const [loadingMeetups, setLoadingMeetups] = useState(true)
  const [signups, setSignups] = useState({})
  const [userSignups, setUserSignups] = useState([])
  const [upcomingCoffeeChats, setUpcomingCoffeeChats] = useState([])
  const [groupsCount, setGroupsCount] = useState(0)
  const [coffeeChatsCount, setCoffeeChatsCount] = useState(0)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [connectionRequests, setConnectionRequests] = useState([])
  const [circleJoinRequests, setCircleJoinRequests] = useState([])
  const [circleInvitations, setCircleInvitations] = useState([])
  const [homeEventRecs, setHomeEventRecs] = useState([])
  const [homeCircleRecs, setHomeCircleRecs] = useState([])
  const [homePeopleRecs, setHomePeopleRecs] = useState([])
  const [homeRecsLoaded, setHomeRecsLoaded] = useState(false)

  const loadHomePageData = useCallback(async () => {
    const t0 = Date.now()
    try {
      setLoadingMeetups(true)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 1)
      const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`

      // === SINGLE RPC: Get all home page data in one database round-trip ===
      const { data: homeData, error: rpcError } = await supabase
        .rpc('get_home_page_data', { p_user_id: currentUser.id, p_cutoff_date: cutoff })

      if (rpcError) {
        console.error('RPC error:', rpcError)
        throw rpcError
      }

      const now = new Date()

      // Extract data from RPC result
      const memberCircleIds = homeData.member_circle_ids || []
      const userSignupsData = homeData.user_signups || []
      const chats = homeData.coffee_chats || []
      const incomingInterests = homeData.incoming_interests || []
      const attendedSignups = homeData.attended_signups || []
      const createdCircles = homeData.created_circles || []
      const circleInvitationsData = homeData.circle_invitations || []

      // Set simple state immediately
      setUserSignups(userSignupsData)
      setUnreadMessageCount(homeData.unread_count || 0)
      setGroupsCount(homeData.groups_count || 0)
      setCoffeeChatsCount(homeData.coffee_completed_count || 0)

      // Process attended count
      const attendedCount = attendedSignups.filter(signup => {
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
        currentUser.meetups_attended = attendedCount
      }

      console.log(`⏱️ RPC done in ${Date.now() - t0}ms`)

      // Meetups and coffee profiles are now included in the RPC
      const meetupsData = homeData.meetups || []
      setMeetups(meetupsData)

      const coffeeProfiles = homeData.coffee_profiles || []
      if (coffeeProfiles.length > 0) {
        const profileMap = {}
        coffeeProfiles.forEach(p => { profileMap[p.id] = p })
        const gracePeriod = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        const upcoming = chats.filter(chat => {
          if (!chat.scheduled_time) return true
          return new Date(chat.scheduled_time) > gracePeriod
        }).map(chat => {
          const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
          return { ...chat, _otherPerson: profileMap[otherId] || null }
        })
        setUpcomingCoffeeChats(upcoming)
      } else {
        setUpcomingCoffeeChats([])
      }

      // Mark page as ready — show the home page now
      console.log(`⏱️ Home page rendered in ${Date.now() - t0}ms`)
      setLoadingMeetups(false)

      // === DEFERRED: Load secondary data in background (signups, requests, invitations) ===
      const loadSecondaryData = async () => {
        try {
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

          // Recommendations — run in parallel with other secondary data, not after
          deferredPromises.push(
            supabase.from('event_recommendations').select('*').eq('user_id', currentUser.id).in('status', ['pending', 'viewed']).order('match_score', { ascending: false }).limit(4)
          )
          deferredKeys.push('eventRecs')
          deferredPromises.push(
            supabase.from('circle_match_scores').select('*, circle:connection_groups(id, name, is_active, connection_group_members(count))').eq('user_id', currentUser.id).order('match_score', { ascending: false }).limit(4)
          )
          deferredKeys.push('circleRecs')
          deferredPromises.push(
            supabase.from('connection_recommendations').select('*').eq('user_id', currentUser.id).neq('status', 'dismissed').order('match_score', { ascending: false }).limit(6)
          )
          deferredKeys.push('peopleRecs')

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
            const peopleRes = { status: 'fulfilled', value: { data: dMap.peopleRecs || [], error: null } }

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
                const { data: myMemberships } = await supabase
                  .from('connection_group_members')
                  .select('group_id')
                  .eq('user_id', currentUser.id)
                const myGroupIds = new Set((myMemberships || []).map(m => m.group_id))
                const { data: activeCircles } = await supabase
                  .from('connection_groups')
                  .select('id, name, is_active, connection_group_members(count)')
                  .eq('is_active', true)
                  .order('created_at', { ascending: false })
                  .limit(6)
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
                    let memberProfiles = []
                    if (memberUserIds.length > 0) {
                      const { data: profiles } = await supabase.from('profiles').select('id, name, profile_picture').in('id', memberUserIds)
                      memberProfiles = profiles || []
                    }
                    circleRecs[0].circle = {
                      ...circleRecs[0].circle,
                      ...circleDetail,
                      members: (circleMembers || []).map(m => ({ ...m, user: memberProfiles.find(p => p.id === m.user_id) || null })),
                    }
                  }
                }
              } catch (e) { console.error('[HomeRecs] Circle enrich:', e) }
            }

            // Process people recs
            let peopleRecs = []
            // Get mutual connections once — shared by AI recs and fallback
            const { data: mutualMatchesForRecs } = await supabase
              .rpc('get_mutual_matches', { for_user_id: currentUser.id })
            const mutualConnectedIds = new Set((mutualMatchesForRecs || []).map(m => m.matched_user_id))

            const peopleData = peopleRes.status === 'fulfilled' && !peopleRes.value.error ? peopleRes.value.data : []
            if (peopleData.length > 0) {
              const connectedIds = mutualConnectedIds
              const seen = new Set()
              const deduped = peopleData.filter(r => {
                if (connectedIds.has(r.recommended_user_id)) return false
                if (seen.has(r.recommended_user_id)) return false
                seen.add(r.recommended_user_id)
                return true
              }).slice(0, 3)
              if (deduped.length > 0) {
                const profileIds = deduped.map(r => r.recommended_user_id)
                const { data: recProfiles } = await supabase
                  .from('profiles')
                  .select('id, name, career, profile_picture')
                  .in('id', profileIds)
                const recProfileMap = {}
                ;(recProfiles || []).forEach(p => { recProfileMap[p.id] = p })
                peopleRecs = deduped.map(r => {
                  // Build match_reasons from DB fields
                  const reasons = []
                  if (r.reason) reasons.push({ reason: r.reason })
                  if (r.shared_topics?.length > 0) {
                    r.shared_topics.forEach(t => reasons.push({ reason: t }))
                  }
                  return { ...r, match_reasons: reasons, profile: recProfileMap[r.recommended_user_id] || null }
                }).filter(r => r.profile)
              }
            }
            // People fallback: recently active community members (active in last 30 days)
            if (peopleRecs.length === 0) {
              try {
                const activeCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                const { data: communityProfiles } = await supabase
                  .from('profiles')
                  .select('id, name, career, profile_picture, last_active')
                  .neq('id', currentUser.id)
                  .not('name', 'is', null)
                  .not('last_active', 'is', null)
                  .gte('last_active', activeCutoff)
                  .order('last_active', { ascending: false })
                  .limit(6)
                if (communityProfiles?.length > 0) {
                  // Fetch industry/hook for tags
                  const fallbackIds = communityProfiles.filter(p => !mutualConnectedIds.has(p.id)).map(p => p.id)
                  let extraFields = {}
                  if (fallbackIds.length > 0) {
                    const { data: extraProfiles } = await supabase
                      .from('profiles')
                      .select('id, industry, hook, city, state')
                      .in('id', fallbackIds)
                    ;(extraProfiles || []).forEach(p => { extraFields[p.id] = p })
                  }
                  // Detect career/role similarity
                  const myCareer = (currentUser.career || '').toLowerCase()
                  const myIndustry = (currentUser.industry || '').toLowerCase()
                  const careerKeywords = myCareer.split(/[\s,\/]+/).filter(w => w.length > 2)
                  peopleRecs = communityProfiles
                    .filter(p => !mutualConnectedIds.has(p.id))
                    .map(p => {
                      const extra = extraFields[p.id] || {}
                      const reasons = []
                      let score = 0

                      // Career similarity
                      const theirCareer = (p.career || '').toLowerCase()
                      const hasSimilarRole = careerKeywords.some(kw => theirCareer.includes(kw))
                      if (hasSimilarRole) {
                        reasons.push({ reason: 'Similar role' })
                        score += 2
                      }

                      // Industry match
                      if (extra.industry) {
                        if (myIndustry && extra.industry.toLowerCase().includes(myIndustry)) {
                          reasons.push({ reason: `Same industry: ${extra.industry}` })
                          score += 2
                        } else {
                          reasons.push({ reason: extra.industry })
                        }
                      }

                      // Only show location if it matches current user's location or there are other reasons
                      const myCity = (currentUser.city || '').toLowerCase()
                      if (extra.city && myCity && extra.city.toLowerCase() === myCity) {
                        reasons.push({ reason: `Same city: ${extra.city}` })
                        score += 1
                      }

                      return { id: p.id, recommended_user_id: p.id, match_score: score, match_reasons: reasons, profile: p }
                    })
                    .filter(r => r.match_reasons.length > 0)
                    .sort((a, b) => b.match_score - a.match_score)
                    .slice(0, 3)
                }
              } catch (e) { console.error('[HomeRecs] People fallback:', e) }
            }

            // Final activity filter: exclude anyone inactive for 30+ days
            if (peopleRecs.length > 0) {
              const activityCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
              const profileIds = peopleRecs.map(r => r.profile?.id || r.recommended_user_id).filter(Boolean)
              const { data: activityCheck } = await supabase
                .from('profiles')
                .select('id, last_active')
                .in('id', profileIds)
              const activeIds = new Set(
                (activityCheck || [])
                  .filter(p => p.last_active && p.last_active >= activityCutoff)
                  .map(p => p.id)
              )
              peopleRecs = peopleRecs.filter(r => activeIds.has(r.profile?.id || r.recommended_user_id))
            }

            // Compute shared meetup counts for people recs
            if (peopleRecs.length > 0) {
              try {
                // Get all meetups Admin signed up for
                const { data: mySignups } = await supabase
                  .from('meetup_signups')
                  .select('meetup_id')
                  .eq('user_id', currentUser.id)
                const myMeetupIds = (mySignups || []).map(s => s.meetup_id)

                if (myMeetupIds.length > 0) {
                  const recUserIds = peopleRecs.map(r => r.recommended_user_id)
                  // Get signups for recommended users in the same meetups
                  const { data: theirSignups } = await supabase
                    .from('meetup_signups')
                    .select('user_id, meetup_id')
                    .in('meetup_id', myMeetupIds)
                    .in('user_id', recUserIds)

                  // Count shared meetups per user
                  const sharedCounts = {}
                  ;(theirSignups || []).forEach(s => {
                    sharedCounts[s.user_id] = (sharedCounts[s.user_id] || 0) + 1
                  })

                  peopleRecs = peopleRecs.map(r => ({
                    ...r,
                    sharedMeetups: sharedCounts[r.recommended_user_id] || 0,
                  }))
                }
              } catch (e) { console.error('[HomeRecs] Shared meetups:', e) }
            }

            setHomeEventRecs(eventRecs)
            setHomeCircleRecs(circleRecs)
            setHomePeopleRecs(peopleRecs)
            setHomeRecsLoaded(true)
          } catch (e) {
            console.error('[HomeRecs] Error:', e)
            setHomeRecsLoaded(true)
          }

          console.log(`⏱️ Secondary data loaded in ${Date.now() - t0}ms`)
        } catch (err) {
          console.error('Error loading secondary data:', err)
        }
      }
      // Fire and forget — don't block the page
      loadSecondaryData()

    } catch (err) {
      console.error('Error loading home page data:', err)
      setLoadingMeetups(false)
    }
  }, [supabase, currentUser.id])

  const loadMeetupsFromDatabase = useCallback(async () => {
    try {
      setLoadingMeetups(true)

      // Only fetch meetups from yesterday onwards (grace period for recently ended ones)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 1)
      const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`

      // Get circles where user is a member
      const { data: memberCircles, error: circleError } = await supabase
        .from('connection_group_members')
        .select('group_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted')

      const memberCircleIds = (memberCircles || []).map(m => m.group_id)

      // Load public meetups AND circle meetups from user's circles (upcoming only)
      let data, error

      if (memberCircleIds.length > 0) {
        // Get public meetups OR meetups from user's circles
        const result = await supabase
          .from('meetups')
          .select('*, connection_groups(id, name), host:profiles!created_by(id, name, profile_picture)')
          .or(`circle_id.is.null,circle_id.in.(${memberCircleIds.join(',')})`)
          .gte('date', cutoff)
          .not('status', 'eq', 'cancelled')
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        data = result.data
        error = result.error
      } else {
        // No circle memberships, just get public meetups
        const result = await supabase
          .from('meetups')
          .select('*, connection_groups(id, name), host:profiles!created_by(id, name, profile_picture)')
          .is('circle_id', null)
          .gte('date', cutoff)
          .not('status', 'eq', 'cancelled')
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Error loading meetups:', error)
        return []
      } else {
        setMeetups(data || [])
        return data || []
      }
    } catch (err) {
      console.error('Error:', err)
      return []
    } finally {
      setLoadingMeetups(false)
    }
  }, [supabase, currentUser.id])

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
    try {
      const { data, error } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id)

      if (error) {
        console.error('Error loading user signups:', error)
      } else {
        setUserSignups((data || []).map(s => s.meetup_id))
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }, [currentUser.id, supabase])

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
      console.log('✅ Accepted circle join request:', membershipId)
    } catch (err) {
      console.error('💥 Error accepting circle join request:', err)
    }
  }, [supabase])

  // Decline a circle join request
  const handleDeclineCircleJoin = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .delete()
        .eq('id', membershipId)

      if (error) throw error
      setCircleJoinRequests(prev => prev.filter(r => r.id !== membershipId))
      console.log('✅ Declined circle join request:', membershipId)
    } catch (err) {
      console.error('💥 Error declining circle join request:', err)
    }
  }, [supabase])

  // Accept a circle invitation (invitee perspective)
  const handleAcceptCircleInvitation = useCallback(async (membershipId) => {
    try {
      const { error } = await supabase
        .from('connection_group_members')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', membershipId)

      if (error) throw error
      setCircleInvitations(prev => prev.filter(r => r.id !== membershipId))
      console.log('✅ Accepted circle invitation:', membershipId)
    } catch (err) {
      console.error('💥 Error accepting circle invitation:', err)
    }
  }, [supabase])

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
      console.log('✅ Declined circle invitation:', membershipId)
    } catch (err) {
      console.error('💥 Error declining circle invitation:', err)
    }
  }, [supabase, currentUser.id])

  const loadUnreadMessageCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('read', false)

      if (error) throw error
      setUnreadMessageCount(count || 0)
    } catch (error) {
      console.error('Error loading unread message count:', error)
      setUnreadMessageCount(0)
    }
  }, [currentUser.id, supabase])

  // Lightweight refresh: re-fetch coffee chats + meetups when returning to home
  const refreshCoffeeChats = useCallback(async () => {
    try {
      const now = new Date()
      const gracePeriod = new Date(now.getTime() - 4 * 60 * 60 * 1000)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 1)
      const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`

      const [chatsRes, meetupsRes] = await Promise.all([
        supabase
          .from('coffee_chats')
          .select('*')
          .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
          .in('status', ['pending', 'accepted', 'scheduled']),
        supabase
          .from('meetups')
          .select('*')
          .gte('date', cutoff)
          .not('status', 'eq', 'cancelled')
          .order('date', { ascending: true })
      ])

      if (chatsRes.data) {
        const chats = chatsRes.data
        const otherIds = [...new Set(chats.map(c => c.requester_id === currentUser.id ? c.recipient_id : c.requester_id))]
        let profileMap = {}
        if (otherIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, career, city, state, profile_picture')
            .in('id', otherIds)
          if (profiles) profiles.forEach(p => { profileMap[p.id] = p })
        }
        const upcoming = chats.filter(chat => {
          if (!chat.scheduled_time) return true
          return new Date(chat.scheduled_time) > gracePeriod
        }).map(chat => {
          const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
          return { ...chat, _otherPerson: profileMap[otherId] || null }
        })
        setUpcomingCoffeeChats(upcoming)
      }

      if (meetupsRes.data) {
        setMeetups(meetupsRes.data)
      }
    } catch (err) {
      console.error('Error refreshing home coffee chats:', err)
    }
  }, [supabase, currentUser.id])

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

    // State setters (needed by MainApp)
    setMeetups,
    setUpcomingCoffeeChats,

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
