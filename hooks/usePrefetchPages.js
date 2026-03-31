import { useEffect, useRef } from 'react'
import { prefetchQuery } from './useSupabaseQuery'

/**
 * Prefetches SWR cache for key pages while user is on Home.
 * Only prefetches queries whose fetcher output matches the component's
 * expected data shape exactly (Circles page RPC).
 *
 * Discover and Coffee use simpler queries that load fast enough (<500ms)
 * and their data shapes are complex to duplicate, so we skip those.
 */
export default function usePrefetchPages(currentUser, supabase) {
  const hasPrefetched = useRef(false)

  useEffect(() => {
    if (!currentUser?.id || hasPrefetched.current) return
    hasPrefetched.current = true

    // Wait for home page to finish rendering, then prefetch
    const timer = setTimeout(() => {
      const userId = currentUser.id

      // Circles page — slowest page, most benefit from prefetch
      prefetchQuery(`circles-page-${userId}`, async (sb) => {
        const t0 = Date.now()
        const [rpcResult, mutualResult, pendingReqsResult] = await Promise.all([
          sb.rpc('get_circles_page_data', { p_user_id: userId }),
          sb.rpc('get_mutual_matches', { for_user_id: userId }),
          sb.from('connection_group_members')
            .select('id, group_id, status, invited_at, connection_groups(id, name)')
            .eq('user_id', userId)
            .eq('status', 'pending'),
        ])

        if (rpcResult.error) return null

        const d = rpcResult.data
        const sharedMatches = mutualResult.data || []
        const groups = d.groups || []
        const members = d.members || []
        const creators = d.creators || []

        // Round 2: recaps + profiles in parallel
        const groupIds = groups.map(g => g.id)
        const channelNames = groupIds.map(id => `connection-group-${id}`)
        const matchedUserIds = sharedMatches.map(m => m.matched_user_id)

        const round2Promises = []
        const round2Keys = []
        if (channelNames.length > 0) {
          round2Promises.push(sb.from('call_recaps').select('id, channel_name, created_at, ai_summary').in('channel_name', channelNames).order('created_at', { ascending: false }))
          round2Keys.push('recaps')
        }
        if (matchedUserIds.length > 0) {
          round2Promises.push(sb.from('profiles').select('id, name, career, city, state, profile_picture, last_active').in('id', matchedUserIds))
          round2Keys.push('profiles')
        }
        const round2Results = round2Promises.length > 0 ? await Promise.all(round2Promises) : []
        const round2Map = {}
        round2Keys.forEach((key, i) => { round2Map[key] = round2Results[i]?.data || [] })

        const creatorMap = {}
        creators.forEach(c => { creatorMap[c.id] = c })

        const membersByGroup = {}
        members.forEach(m => {
          if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
          membersByGroup[m.group_id].push({
            id: m.id, status: m.status, user_id: m.user_id, group_id: m.group_id,
            user: { id: m.user_id, name: m.name, career: m.career, last_active: m.last_active, profile_picture: m.profile_picture }
          })
        })

        const latestMessages = d.latest_messages || []
        const latestMessageByGroup = {}
        latestMessages.forEach(msg => { latestMessageByGroup[msg.group_id] = { ...msg, sender: { id: msg.user_id, name: msg.sender_name } } })

        const upcomingMeetups = d.upcoming_meetups || []
        const nextMeetupByCircle = {}
        upcomingMeetups.forEach(meetup => {
          if (!nextMeetupByCircle[meetup.circle_id]) nextMeetupByCircle[meetup.circle_id] = meetup
        })

        const pastMeetups = d.past_meetups || []
        const pastMeetupCountByCircle = {}
        const lastTopicByCircle = {}
        pastMeetups.forEach(meetup => {
          pastMeetupCountByCircle[meetup.circle_id] = (pastMeetupCountByCircle[meetup.circle_id] || 0) + 1
          if (!lastTopicByCircle[meetup.circle_id] && meetup.topic) lastTopicByCircle[meetup.circle_id] = meetup.topic
        })

        const latestRecapByCircle = {}
        ;(round2Map.recaps || []).forEach(r => {
          const circleId = r.channel_name.replace('connection-group-', '')
          if (!latestRecapByCircle[circleId]) latestRecapByCircle[circleId] = r
        })

        for (const group of groups) {
          group.creator = creatorMap[group.creator_id] || null
          group.members = membersByGroup[group.id] || []
          group.lastMessage = latestMessageByGroup[group.id] || null
          group.nextMeetup = nextMeetupByCircle[group.id] || null
          group.pastSessionCount = pastMeetupCountByCircle[group.id] || 0
          group.lastTopic = lastTopicByCircle[group.id] || null
          group.lastRecap = latestRecapByCircle[group.id] || null
        }
        groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const invitations = d.invitations || []
        const groupInvites = invitations.map(inv => ({
          id: inv.id, group_id: inv.group_id, user_id: inv.user_id, status: inv.status, invited_at: inv.invited_at,
          group: { id: inv.group_id, name: inv.group_name, creator_id: inv.group_creator_id, created_at: inv.group_created_at, is_active: inv.group_is_active, creator: { id: inv.group_creator_id, name: inv.creator_name } }
        }))

        const pendingReqs = pendingReqsResult.data
        const pendingJoinRequests = (pendingReqs || []).map(r => ({
          id: r.id, group_id: r.group_id, invited_at: r.invited_at, groupName: r.connection_groups?.name || 'Unknown circle',
        }))

        const unreadData = d.unread_counts || []
        const counts = {}
        unreadData.forEach(u => { counts[u.sender_id] = u.count })

        let connectionsResult = []
        const connectionProfiles = round2Map.profiles || []
        if (connectionProfiles.length > 0) {
          connectionsResult = connectionProfiles.map(user => ({
            id: user.id, userId: user.id, name: user.name || 'Unknown',
            avatar: user.profile_picture, career: user.career || '',
            city: user.city, state: user.state, last_active: user.last_active,
          }))
        }

        console.log(`[Prefetch] Circles page prefetched in ${Date.now() - t0}ms`)
        return { connectionGroups: groups, groupInvites, pendingJoinRequests, unreadCounts: counts, connections: connectionsResult, sharedMatches }
      })

      // Discover: connection groups (simple shape, matches component exactly)
      prefetchQuery('discover-connection-groups', async (sb) => {
        const t0 = Date.now()
        const { data: groups, error } = await sb
          .from('connection_groups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(30)

        if (error || !groups || groups.length === 0) return []

        const groupIds = groups.map(g => g.id)
        const { data: allMembers } = await sb
          .from('connection_group_members')
          .select('id, group_id, user_id, status')
          .in('group_id', groupIds)
          .eq('status', 'accepted')

        const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))]
        let profileMap = {}
        if (memberUserIds.length > 0) {
          const { data: profiles } = await sb
            .from('profiles')
            .select('id, name, career, profile_picture')
            .in('id', memberUserIds)
          profileMap = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {})
        }

        console.log(`[Prefetch] Discover groups prefetched in ${Date.now() - t0}ms`)
        return groups.map(g => ({
          ...g,
          members: (allMembers || [])
            .filter(m => m.group_id === g.id)
            .map(m => ({ ...m, user: profileMap[m.user_id] || null }))
        }))
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentUser?.id])
}
