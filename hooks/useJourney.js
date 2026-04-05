import { useState, useCallback } from 'react'
import { parseLocalDate } from '@/lib/dateUtils'
import { supabase } from '@/lib/supabase'

/**
 * useJourney — tracks user progress: pending recaps, attended count
 * groupsCount and coffeeChatsCount are owned by useHomeData (set via RPC)
 */
export default function useJourney(currentUser) {
  const [pendingRecaps, setPendingRecaps] = useState([])

  const loadPendingRecaps = useCallback(async () => {
    try {
      // Uses created_by or participant_ids array (correct column names)
      // Only consider recaps from the last 30 days as potentially pending
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const [{ data, error }, { data: viewedData }] = await Promise.all([
        supabase
          .from('call_recaps')
          .select('id, channel_name, call_type, started_at, ended_at, duration_seconds, participant_count, participant_ids, created_by, created_at')
          .or(`created_by.eq.${currentUser.id},participant_ids.cs.{${currentUser.id}}`)
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('recap_views')
          .select('recap_id')
          .eq('user_id', currentUser.id),
      ])

      if (error) {
        // Silently handle missing table/column errors
        if (!error.message?.includes('does not exist')) {
          console.log('Pending recaps not available:', error.message)
        }
        setPendingRecaps([])
        return
      }

      const viewedIds = new Set((viewedData || []).map(v => v.recap_id))
      const unviewedRecaps = (data || []).filter(r => !viewedIds.has(r.id))

      // Deduplicate: keep only the most recent recap per entity (meetup/chat)
      const bestByEntity = {}
      unviewedRecaps.forEach(recap => {
        const channelName = recap.channel_name || ''
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
        const entityId = uuidMatch ? uuidMatch[0] : recap.id // use recap id as fallback for orphans
        if (!bestByEntity[entityId] || new Date(recap.created_at) > new Date(bestByEntity[entityId].created_at)) {
          bestByEntity[entityId] = recap
        }
      })
      const recapsData = Object.values(bestByEntity)

      // Extract IDs from channel_name and separate by call type
      const meetupIds = []
      const groupIds = []
      const coffeeIds = []
      recapsData.forEach(recap => {
        const channelName = recap.channel_name || ''
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
        if (uuidMatch) {
          if (recap.call_type === 'group') {
            groupIds.push(uuidMatch[0])
          } else if (recap.call_type === '1on1') {
            coffeeIds.push(uuidMatch[0])
          } else {
            meetupIds.push(uuidMatch[0])
          }
        }
      })

      // Fetch titles for all entity types in parallel
      let titleMap = {}
      const titlePromises = []
      const titleKeys = []

      if (meetupIds.length > 0) {
        titlePromises.push(supabase.from('meetups').select('id, topic').in('id', meetupIds))
        titleKeys.push('meetups')
      }
      if (groupIds.length > 0) {
        titlePromises.push(supabase.from('connection_groups').select('id, name').in('id', groupIds))
        titleKeys.push('groups')
      }
      if (coffeeIds.length > 0) {
        titlePromises.push(supabase.from('coffee_chats').select('id, requester_id, recipient_id').in('id', coffeeIds))
        titleKeys.push('coffees')
      }

      if (titlePromises.length > 0) {
        const titleResults = await Promise.all(titlePromises)
        titleKeys.forEach((key, i) => {
          const data = titleResults[i]?.data || []
          if (key === 'meetups') {
            data.forEach(m => { titleMap[m.id] = m.topic })
          } else if (key === 'groups') {
            data.forEach(g => { titleMap[g.id] = g.name })
          } else if (key === 'coffees') {
            data.forEach(c => { titleMap[c.id] = 'Coffee Chat' })
          }
        })
      }

      // Helper to parse AI summary for counts
      const parseSummaryCounts = (summary) => {
        if (!summary) return { takeaways: 0, actionItems: 0 }

        let takeaways = 0
        let actionItems = 0
        const lines = summary.split('\n')
        let section = 'summary'

        for (const line of lines) {
          const lower = line.toLowerCase()
          if (lower.includes('key takeaway') || lower.includes('takeaways:')) {
            section = 'takeaways'
          } else if (lower.includes('action item') || lower.includes('follow up') || lower.includes('next step')) {
            section = 'actions'
          } else if (line.trim().match(/^[-•*]/) || line.trim().match(/^\d+\./)) {
            if (section === 'takeaways') takeaways++
            if (section === 'actions') actionItems++
          }
        }
        return { takeaways, actionItems }
      }

      // Enrich recaps with title and parsed counts, filter out orphans with no matching entity
      const enrichedRecaps = recapsData.map(recap => {
        const channelName = recap.channel_name || ''
        const uuidMatch = channelName.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
        const entityId = uuidMatch ? uuidMatch[0] : null
        const title = entityId ? titleMap[entityId] : null
        const counts = parseSummaryCounts(recap.ai_summary)

        return {
          ...recap,
          entityId,
          meetup_title: title || null,
          takeaways_count: counts.takeaways,
          action_items_count: counts.actionItems
        }
      }).filter(r => r.meetup_title) // Only count recaps with a matching meetup/group

      setPendingRecaps(enrichedRecaps)
    } catch (err) {
      console.error('Error loading pending recaps:', err)
      setPendingRecaps([])
    }
  }, [currentUser.id, supabase])

  const updateAttendedCount = useCallback(async () => {
    try {
      // Get user's signups with meetup dates
      const { data: signups, error } = await supabase
        .from('meetup_signups')
        .select(`
          meetup_id,
          meetups (date, time)
        `)
        .eq('user_id', currentUser.id)

      if (error || !signups) {
        return
      }

      // Count how many meetups are in the past
      const now = new Date()
      const attendedCount = signups.filter(signup => {
        try {
          if (!signup.meetups) return false

          // Parse date using local timezone utility
          const meetupDate = parseLocalDate(signup.meetups.date)

          // Check if valid date
          if (isNaN(meetupDate.getTime())) {
            console.log('Invalid date:', signup.meetups.date)
            return false
          }

          // CRITICAL: Add TIME to the date
          const meetupTime = signup.meetups.time || '00:00'
          const [hours, minutes] = meetupTime.split(':').map(Number)
          meetupDate.setHours(hours, minutes, 0, 0)

          // Now compare full datetime
          const isPast = meetupDate < now
          return isPast
        } catch (err) {
          console.error('Error parsing date:', err)
          return false
        }
      }).length

      // Update profile if count changed
      if (attendedCount !== currentUser.meetups_attended) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ meetups_attended: attendedCount })
          .eq('id', currentUser.id)

        if (!updateError) {
          currentUser.meetups_attended = attendedCount
        } else {
          console.error('Error updating profile:', updateError)
        }
      }
    } catch (err) {
      console.error('Error updating attended count:', err)
    }
  }, [currentUser.id, supabase])

  return {
    pendingRecaps,
    setPendingRecaps,
    loadPendingRecaps,
    updateAttendedCount,
  }
}
