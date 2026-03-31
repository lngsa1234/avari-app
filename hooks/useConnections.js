import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * useConnections — connections, interests, discovery, meetup people, potential connections
 */
export default function useConnections(currentUser, { refreshConnectionRequests, toast } = {}) {
  const [connections, setConnections] = useState([])
  const [myInterests, setMyInterests] = useState([])
  const [meetupPeople, setMeetupPeople] = useState({})
  const [potentialConnections, setPotentialConnections] = useState([])

  const loadConnections = useCallback(async () => {
    try {
      const { data: matches, error } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (error) throw error

      if (!matches || matches.length === 0) {
        setConnections([])
        return
      }

      const matchedUserIds = matches.map(m => m.matched_user_id)

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, bio, last_active')
        .in('id', matchedUserIds)

      if (profileError) throw profileError

      // Combine matches with profile data
      const connectionsWithProfiles = matches.map(match => {
        const profile = profiles.find(p => p.id === match.matched_user_id)
        return {
          id: match.matched_user_id,
          connected_user: profile,
          matched_at: match.matched_at
        }
      })

      setConnections(connectionsWithProfiles)
    } catch (err) {
      console.error('Error loading connections:', err)
      setConnections([])
    }
  }, [currentUser.id, supabase])

  const loadMyInterests = useCallback(async () => {
    try {
      const { data: interests, error } = await supabase
        .from('user_interests')
        .select('interested_in_user_id')
        .eq('user_id', currentUser.id)

      if (error) throw error

      const interestIds = (interests || []).map(i => i.interested_in_user_id)
      setMyInterests(interestIds)
    } catch (err) {
      console.error('Error loading interests:', err)
      setMyInterests([])
    }
  }, [currentUser.id, supabase])

  const loadMeetupPeople = useCallback(async () => {
    try {
      // STEP 1: Get existing connections to exclude them
      const { data: existingConnections, error: connectionsError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (connectionsError) {
        console.error('Error loading connections for filtering:', connectionsError)
      }

      const connectedUserIds = new Set()
      if (existingConnections) {
        existingConnections.forEach(match => {
          connectedUserIds.add(match.matched_user_id)
        })
      }

      // STEP 2: Get meetups current user attended (for mutual meetup scoring)
      const { data: mySignups } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id)

      const myMeetupIds = (mySignups || []).map(s => s.meetup_id)

      // Get other users who attended the same meetups
      const mutualMeetupUserIds = new Set()
      if (myMeetupIds.length > 0) {
        const { data: coAttendees } = await supabase
          .from('meetup_signups')
          .select('user_id')
          .in('meetup_id', myMeetupIds)
          .neq('user_id', currentUser.id)

        ;(coAttendees || []).forEach(s => mutualMeetupUserIds.add(s.user_id))
      }

      // STEP 3: Fetch ALL profiles (except self and already-connected)
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, bio, last_active, open_to_coffee_chat, profile_picture')
        .neq('id', currentUser.id)
        .not('name', 'is', null)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        setMeetupPeople({})
        return
      }

      // Filter out connected users and sort by priority
      const candidates = (allProfiles || [])
        .filter(p => !connectedUserIds.has(p.id))
        .map(p => ({
          id: p.id,
          user: p,
          hasMutualMeetup: mutualMeetupUserIds.has(p.id),
        }))
        .sort((a, b) => {
          // Priority: mutual meetup > open to coffee chat > others
          const scoreA = (a.hasMutualMeetup ? 4 : 0) + (a.user.open_to_coffee_chat ? 2 : 0)
          const scoreB = (b.hasMutualMeetup ? 4 : 0) + (b.user.open_to_coffee_chat ? 2 : 0)
          return scoreB - scoreA
        })

      if (candidates.length === 0) {
        setMeetupPeople({})
        return
      }

      // Wrap in a single "recommended" group for the existing UI
      setMeetupPeople({
        recommended: {
          meetup: { id: 'recommended', title: 'Recommended' },
          people: candidates,
        }
      })
    } catch (err) {
      console.error('Error loading meetup people:', err)
      setMeetupPeople({})
    }
  }, [currentUser.id, supabase])

  const loadPotentialConnections = useCallback(async () => {
    try {
      // Get meetups current user attended
      const { data: mySignups, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id)

      if (signupsError) throw signupsError

      const myMeetupIds = mySignups.map(s => s.meetup_id)

      if (myMeetupIds.length === 0) {
        setPotentialConnections([])
        return
      }

      // Get other people who attended the same meetups
      const { data: otherSignups, error: othersError } = await supabase
        .from('meetup_signups')
        .select('user_id, meetup_id')
        .in('meetup_id', myMeetupIds)
        .neq('user_id', currentUser.id)

      if (othersError) throw othersError

      // Get mutual matches to filter them out
      const { data: matches, error: matchError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (matchError) throw matchError

      const matchedUserIds = new Set((matches || []).map(m => m.matched_user_id))

      // Group by user and count shared meetups, excluding already matched
      const potentialMap = {}
      otherSignups.forEach(signup => {
        const userId = signup.user_id
        if (matchedUserIds.has(userId)) return

        if (!potentialMap[userId]) {
          potentialMap[userId] = {
            id: userId,
            shared_meetups: [],
            meetup_count: 0
          }
        }
        potentialMap[userId].shared_meetups.push(signup.meetup_id)
        potentialMap[userId].meetup_count++
      })

      // Fetch profiles for potential connections
      const potentialUserIds = Object.keys(potentialMap)
      if (potentialUserIds.length === 0) {
        setPotentialConnections([])
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, bio, profile_picture')
        .in('id', potentialUserIds)

      const profileMap = {}
      ;(profiles || []).forEach(p => { profileMap[p.id] = p })

      // Convert to array with profile data and sort by most shared meetups
      const potentialArray = Object.values(potentialMap)
        .map(p => ({
          id: p.id,
          name: profileMap[p.id]?.name,
          career: profileMap[p.id]?.career,
          city: profileMap[p.id]?.city,
          state: profileMap[p.id]?.state,
          bio: profileMap[p.id]?.bio,
          profile_picture: profileMap[p.id]?.profile_picture,
          shared_meetups: p.shared_meetups,
          meetup_count: p.meetup_count,
        }))
        .sort((a, b) => b.meetup_count - a.meetup_count)

      setPotentialConnections(potentialArray)
    } catch (err) {
      console.error('Error loading potential connections:', err)
      setPotentialConnections([])
    }
  }, [currentUser.id, supabase])

  // Lazy-load all connection data at once
  const lazyLoadAll = useCallback(() => {
    loadConnections()
    loadMyInterests()
    loadMeetupPeople()
    loadPotentialConnections()
  }, [loadConnections, loadMyInterests, loadMeetupPeople, loadPotentialConnections])

  const handleShowInterest = async (userId, userName) => {
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert([{
          user_id: currentUser.id,
          interested_in_user_id: userId
        }])

      if (error) {
        if (error.code === '23505') {
          toast?.info('You already showed interest in this person')
        } else {
          console.error('Error inserting interest:', error)
          toast?.error('Error: ' + error.message)
        }
        return
      }

      // Check if this creates a mutual match
      const { data: mutualCheck, error: mutualError } = await supabase
        .rpc('check_mutual_interest', {
          user_a: currentUser.id,
          user_b: userId
        })

      if (mutualError) {
        console.error('Error checking mutual interest:', mutualError)
      } else {
        if (mutualCheck) {
          toast?.success(`It's a match! You and ${userName} are now connected!`)
        } else {
          toast?.success(`Interest shown in ${userName}`)
        }
      }

      // Reload data
      await loadMyInterests()
      await loadConnections()
      await refreshConnectionRequests?.()
      await loadMeetupPeople()
    } catch (err) {
      console.error('Error in handleShowInterest:', err)
      toast?.error('Error: ' + err.message)
    }
  }

  const handleRemoveInterest = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('interested_in_user_id', userId)

      if (error) {
        toast?.error('Error: ' + error.message)
      } else {
        toast?.info('Interest removed')
        loadMyInterests()
        loadMeetupPeople()
      }
    } catch (err) {
      toast?.error('Error: ' + err.message)
    }
  }

  return {
    connections,
    setConnections,
    myInterests,
    meetupPeople,
    potentialConnections,
    loadConnections,
    loadMyInterests,
    loadMeetupPeople,
    loadPotentialConnections,
    lazyLoadAll,
    handleShowInterest,
    handleRemoveInterest,
  }
}
