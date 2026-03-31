import { useEffect, useRef } from 'react'
import { prefetchQuery } from './useSupabaseQuery'

/**
 * Prefetches SWR cache for Discover, Coffee, and Circles pages
 * while the user is on the Home page. Runs once after home loads.
 */
export default function usePrefetchPages(currentUser, supabase) {
  const hasPrefetched = useRef(false)

  useEffect(() => {
    if (!currentUser?.id || hasPrefetched.current) return
    hasPrefetched.current = true

    // Delay prefetch to not compete with home page loading
    const timer = setTimeout(() => {
      const userId = currentUser.id

      // Discover: connection groups
      prefetchQuery('discover-connection-groups', async (sb) => {
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

        return groups.map(g => ({
          ...g,
          members: (allMembers || [])
            .filter(m => m.group_id === g.id)
            .map(m => ({ ...m, user: profileMap[m.user_id] || null }))
        }))
      })

      // Coffee: coffee chats
      prefetchQuery(`meetups-coffee-${userId}`, async (sb) => {
        const { data, error } = await sb
          .from('coffee_chats')
          .select('*')
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
          .in('status', ['pending', 'accepted', 'scheduled'])
          .order('scheduled_time', { ascending: true })

        if (error || !data || data.length === 0) return []

        const otherIds = [...new Set(data.map(c =>
          c.requester_id === userId ? c.recipient_id : c.requester_id
        ))]
        let profileMap = {}
        if (otherIds.length > 0) {
          const { data: profiles } = await sb
            .from('profiles')
            .select('id, name, career, city, state, profile_picture')
            .in('id', otherIds)
          profileMap = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc }, {})
        }

        return data.map(chat => {
          const otherId = chat.requester_id === userId ? chat.recipient_id : chat.requester_id
          return { ...chat, otherUser: profileMap[otherId] || null }
        })
      })

      // Circles: main RPC
      prefetchQuery(`circles-page-${userId}`, async (sb) => {
        const [rpcResult, mutualResult, pendingReqsResult] = await Promise.all([
          sb.rpc('get_circles_page_data', { p_user_id: userId }),
          sb.rpc('get_mutual_matches', { for_user_id: userId }),
          sb.from('connection_group_members')
            .select('id, group_id, status, invited_at, connection_groups(id, name)')
            .eq('user_id', userId)
            .eq('status', 'pending'),
        ])

        if (rpcResult.error) return null // Let the component handle the full fetch

        const d = rpcResult.data
        const sharedMatches = mutualResult.data || []
        const groups = d.groups || []
        const members = d.members || []
        const creators = d.creators || []

        // Minimal processing — enough for initial render
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
        latestMessages.forEach(msg => {
          latestMessageByGroup[msg.group_id] = { ...msg, sender: { id: msg.user_id, name: msg.sender_name } }
        })

        const upcomingMeetups = d.upcoming_meetups || []
        const nextMeetupByCircle = {}
        upcomingMeetups.forEach(meetup => {
          if (!nextMeetupByCircle[meetup.circle_id]) nextMeetupByCircle[meetup.circle_id] = meetup
        })

        const pastMeetups = d.past_meetups || []
        const pastMeetupCountByCircle = {}
        pastMeetups.forEach(meetup => {
          pastMeetupCountByCircle[meetup.circle_id] = (pastMeetupCountByCircle[meetup.circle_id] || 0) + 1
        })

        for (const group of groups) {
          group.creator = creatorMap[group.creator_id] || null
          group.members = membersByGroup[group.id] || []
          group.lastMessage = latestMessageByGroup[group.id] || null
          group.nextMeetup = nextMeetupByCircle[group.id] || null
          group.pastSessionCount = pastMeetupCountByCircle[group.id] || 0
        }
        groups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        // Invitations
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

        // Connections
        let connectionsResult = []
        if (sharedMatches.length > 0) {
          const matchedUserIds = sharedMatches.map(m => m.matched_user_id)
          const { data: profiles } = await sb
            .from('profiles')
            .select('id, name, career, city, state, profile_picture, last_active')
            .in('id', matchedUserIds)
          if (profiles) {
            connectionsResult = profiles.map(user => ({
              id: user.id, userId: user.id, name: user.name || 'Unknown',
              avatar: user.profile_picture, career: user.career || '',
              city: user.city, state: user.state, last_active: user.last_active,
            }))
          }
        }

        return { connectionGroups: groups, groupInvites, pendingJoinRequests, unreadCounts: counts, connections: connectionsResult, sharedMatches }
      })
    }, 1000) // Wait 1s after home loads

    return () => clearTimeout(timer)
  }, [currentUser?.id])
}
