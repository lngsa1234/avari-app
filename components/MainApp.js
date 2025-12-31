'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar, Coffee, Users, Star, MapPin, Clock, User, Heart, MessageCircle, Send, X, Video } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import CoffeeChatsView from './CoffeeChatsView'
import MessagesView from './MessagesView'

function MainApp({ currentUser, onSignOut, supabase }) {
  // DEBUGGING: Track renders vs mounts
  const renderCountRef = useRef(0)
  renderCountRef.current++
  
  const mountTimeRef = useRef(Date.now())
  const componentIdRef = useRef(Math.random().toString(36).substring(7))
  
  console.log('🔥 MainApp loaded - UPDATED VERSION with TIME ORDERING')
  console.log(`🔁 Render #${renderCountRef.current} | Component ID: ${componentIdRef.current} | Age: ${Date.now() - mountTimeRef.current}ms`)
  console.log(`👤 currentUser.id: ${currentUser?.id}`)
  console.log(`🔑 Props changed: currentUser=${!!currentUser}, onSignOut=${!!onSignOut}, supabase=${!!supabase}`)
  
  const [currentView, setCurrentView] = useState('home')
  const [showChatModal, setShowChatModal] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showCreateMeetup, setShowCreateMeetup] = useState(false)
  const [showEditMeetup, setShowEditMeetup] = useState(false)
  const [editedProfile, setEditedProfile] = useState(null)
  const [newMeetup, setNewMeetup] = useState({ date: '', time: '', location: '' })
  const [selectedDate, setSelectedDate] = useState(null) // For DatePicker
  const [editingMeetup, setEditingMeetup] = useState(null)
  const [meetups, setMeetups] = useState([])
  const [loadingMeetups, setLoadingMeetups] = useState(true)
  const [signups, setSignups] = useState({}) // Store signups by meetup_id
  const [userSignups, setUserSignups] = useState([]) // Store current user's signups
  const [connections, setConnections] = useState([]) // Store mutual matches
  const [potentialConnections, setPotentialConnections] = useState([]) // People from same meetups
  const [myInterests, setMyInterests] = useState([]) // People current user is interested in
  const [meetupPeople, setMeetupPeople] = useState({}) // People grouped by meetup
  const [unreadMessageCount, setUnreadMessageCount] = useState(0) // Unread messages from database

  // DEBUGGING: Detect prop changes
  const prevPropsRef = useRef({ currentUser, onSignOut, supabase })
  useEffect(() => {
    const prev = prevPropsRef.current
    if (prev.currentUser !== currentUser) {
      console.log('⚠️ currentUser prop CHANGED!')
    }
    if (prev.onSignOut !== onSignOut) {
      console.log('⚠️ onSignOut prop CHANGED!')
    }
    if (prev.supabase !== supabase) {
      console.log('⚠️ supabase prop CHANGED!')
    }
    prevPropsRef.current = { currentUser, onSignOut, supabase }
  })

  // Guard to prevent multiple loads
  const hasLoadedRef = useRef(false)

  // DEBUGGING: Detect mount/unmount cycles
  useEffect(() => {
    console.log(`🧨 MainApp MOUNTED (Component ID: ${componentIdRef.current})`)
    return () => {
      console.log(`🧹 MainApp UNMOUNTED (Component ID: ${componentIdRef.current})`)
      console.log(`⚠️ This component lived for ${Date.now() - mountTimeRef.current}ms`)
    }
  }, [])

  // Load meetups from Supabase on component mount
  useEffect(() => {
    // CRITICAL: Only run once, ignore React Strict Mode double-render
    if (hasLoadedRef.current) {
      console.log('⏭️ useEffect already ran, skipping to prevent duplicates')
      return
    }
    
    console.log('🚀 useEffect running for the FIRST time')
    hasLoadedRef.current = true
    
    loadMeetupsFromDatabase()
    loadSignupsForMeetups([]) // Load all signups
    loadUserSignups()
    loadConnections()
    loadMyInterests()
    loadMeetupPeople()
    updateAttendedCount()
    loadUnreadMessageCount()

    // SUBSCRIPTIONS TEMPORARILY DISABLED TO FIX INFINITE RELOAD
    // Re-enable after adding useCallback to all functions
    /*
    // Set up real-time subscription for meetups
    const meetupsSubscription = supabase
      .channel('meetups_changes')
      .on('postgres_changes', 
        { 
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public', \n          table: 'meetups'
        }, 
        (payload) => {
          console.log('Meetup changed:', payload)
          // Reload meetups when any change occurs
          loadMeetupsFromDatabase()
        }
      )
      .subscribe()

    // Set up real-time subscription for signups
    const signupsSubscription = supabase
      .channel('signups_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'meetup_signups'
        }, 
        (payload) => {
          console.log('Signup changed:', payload)
          // Reload signups and user signups
          loadMeetupsFromDatabase()
          loadUserSignups()
          loadMeetupPeople() // Reload meetup people
        }
      )
      .subscribe()

    // Set up real-time subscription for interests
    const interestsSubscription = supabase
      .channel('interests_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'user_interests'
        }, 
        (payload) => {
          console.log('Interest changed:', payload)
          loadConnections() // Reload to check for new mutual matches
          loadMyInterests()
          loadMeetupPeople()
        }
      )
      .subscribe()

    // Set up real-time subscription for messages
    const messagesSubscription = supabase
      .channel('messages_changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        }, 
        (payload) => {
          console.log('Message changed:', payload)
          loadUnreadMessageCount()
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      meetupsSubscription.unsubscribe()
      signupsSubscription.unsubscribe()
      interestsSubscription.unsubscribe()
      messagesSubscription.unsubscribe()
    }
    */
  }, []) // Empty array - functions are defined below and stable due to useCallback

  const loadMeetupsFromDatabase = useCallback(async () => {
    try {
      setLoadingMeetups(true)
      const { data, error } = await supabase
        .from('meetups')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) {
        console.error('Error loading meetups:', error)
      } else {
        setMeetups(data || [])
        // Note: loadSignupsForMeetups will be called separately in useEffect
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoadingMeetups(false)
    }
  }, [supabase])


  const loadSignupsForMeetups = useCallback(async (meetupsList) => {
    try {
      console.log('Loading signups...')
      
      // Get all signups first
      const { data: signupsData, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('*')

      console.log('Signups raw data:', signupsData)
      console.log('Signups error:', signupsError)

      if (signupsError) {
        console.error('Error loading signups:', signupsError)
        return
      }

      if (!signupsData || signupsData.length === 0) {
        console.log('No signups found')
        setSignups({})
        return
      }

      // Get user IDs from signups
      const userIds = [...new Set(signupsData.map(s => s.user_id))]
      
      // Get profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      console.log('Profiles data:', profilesData)
      console.log('Profiles error:', profilesError)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
      }

      // Create a map of user profiles
      const profilesMap = {}
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap[profile.id] = profile
        })
      }

      // Combine signups with profiles and group by meetup_id
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

      console.log('Signups by meetup:', signupsByMeetup)
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

  const loadConnections = useCallback(async () => {
    try {
      console.log('🔍 Loading connections (mutual matches)...')
      // Get mutual matches using the database function
      const { data: matches, error } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (error) {
        console.error('💥 Error calling get_mutual_matches:', error)
        throw error
      }

      console.log('📊 Raw mutual matches result:', matches)

      if (!matches || matches.length === 0) {
        console.log('⚠️ No mutual matches found')
        setConnections([])
        return
      }

      // Get profile details for matched users
      const matchedUserIds = matches.map(m => m.matched_user_id)
      console.log('👥 Matched user IDs:', matchedUserIds)
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, career, city, state, bio')
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
      console.log('✅ Loaded mutual matches:', connectionsWithProfiles.length, 'connections')
    } catch (err) {
      console.error('💥 Error loading connections:', err)
      setConnections([])
    }
  }, [currentUser.id, supabase])

  const loadMyInterests = useCallback(async () => {
    try {
      console.log('🔍 Loading my interests...')
      // Get people current user has expressed interest in
      const { data: interests, error } = await supabase
        .from('user_interests')
        .select('interested_in_user_id')
        .eq('user_id', currentUser.id)

      if (error) throw error

      const interestIds = (interests || []).map(i => i.interested_in_user_id)
      setMyInterests(interestIds)
      console.log('✅ Loaded my interests:', interestIds.length, 'people -', interestIds)
    } catch (err) {
      console.error('💥 Error loading interests:', err)
      setMyInterests([])
    }
  }, [currentUser.id, supabase])

  const loadMeetupPeople = useCallback(async () => {
    try {
      console.log('🔍 Loading meetup people...')
      
      // Get meetups current user attended
      const { data: mySignups, error: signupsError } = await supabase
        .from('meetup_signups')
        .select('meetup_id')
        .eq('user_id', currentUser.id)

      if (signupsError) throw signupsError

      const myMeetupIds = mySignups.map(s => s.meetup_id)
      console.log('📋 User attended', myMeetupIds.length, 'meetups')

      if (myMeetupIds.length === 0) {
        console.log('❌ No meetups attended')
        setMeetupPeople({})
        return
      }

      // ✅ FIX: Get meetup details for attended meetups
      const { data: allMeetupsData, error: meetupsError } = await supabase
        .from('meetups')
        .select('*')
        .in('id', myMeetupIds)
        .order('date', { ascending: false })

      if (meetupsError) throw meetupsError

      // ✅ FIX: Filter to ONLY PAST meetups (date + time check)
      const now = new Date()
      const meetupsData = allMeetupsData.filter(meetup => {
        // Combine date and time into a single datetime for comparison
        const meetupDateTime = new Date(`${meetup.date}T${meetup.time}`)
        const isPast = meetupDateTime < now
        
        console.log(`📅 Meetup: ${meetup.date} ${meetup.time} - Is Past? ${isPast}`)
        return isPast
      })

      // ✅ FIX: Check if we have any past meetups
      if (!meetupsData || meetupsData.length === 0) {
        console.log('⚠️ No PAST meetups found (based on date + time)')
        setMeetupPeople({})
        return
      }

      console.log('✅ Loaded', meetupsData.length, 'PAST meetup details (date + time verified)')

      // For each meetup, get other attendees (that's it - no filtering!)
      const meetupPeopleMap = {}

      for (const meetup of meetupsData) {
        console.log('🔎 Checking past meetup:', meetup.date, meetup.time, '- Meetup ID:', meetup.id)
        
        // Get attendee user_ids for this meetup
        const { data: signups, error: signupsError } = await supabase
          .from('meetup_signups')
          .select('user_id')
          .eq('meetup_id', meetup.id)
          .neq('user_id', currentUser.id)

        console.log('🔍 Raw signups query result:', signups)
        console.log('🔍 Current user ID:', currentUser.id)

        if (signupsError) {
          console.error('❌ Error loading signups:', signupsError)
          continue
        }

        if (!signups || signups.length === 0) {
          console.log('⚠️ No other attendees at this meetup')
          console.log('💡 Check: Did other users actually sign up for meetup ID:', meetup.id, '?')
          continue
        }

        console.log('👥 Found', signups.length, 'other attendees')

        // Get profile data for these user_ids
        const userIds = signups.map(s => s.user_id)
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, career, city, state, bio')
          .in('id', userIds)

        if (profilesError) {
          console.error('❌ Error loading profiles:', profilesError)
          continue
        }

        // Combine into people array
        const people = profiles.map(profile => ({
          id: profile.id,
          user: profile
        }))

        console.log('✅ Available people:', people.length)

        if (people.length > 0) {
          meetupPeopleMap[meetup.id] = {
            meetup: meetup,
            people: people
          }
        }
      }

      setMeetupPeople(meetupPeopleMap)
      console.log('🎉 Final result:', Object.keys(meetupPeopleMap).length, 'meetups with people')
      
      // Log summary
      const totalPeople = Object.values(meetupPeopleMap).reduce((sum, mp) => sum + mp.people.length, 0)
      console.log('👥 Total people to discover:', totalPeople)
    } catch (err) {
      console.error('💥 Error loading meetup people:', err)
      setMeetupPeople({})
    }
  }, [currentUser.id, supabase])

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
        .select(`
          user_id,
          meetup_id,
          profiles:user_id (
            id,
            name,
            career,
            city,
            state,
            bio
          )
        `)
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
        
        // Skip if already matched
        if (matchedUserIds.has(userId)) return

        if (!potentialMap[userId]) {
          potentialMap[userId] = {
            id: userId,
            user: signup.profiles,
            shared_meetups: [],
            meetup_count: 0
          }
        }
        potentialMap[userId].shared_meetups.push(signup.meetup_id)
        potentialMap[userId].meetup_count++
      })

      // Convert to array and sort by most shared meetups
      const potentialArray = Object.values(potentialMap)
        .sort((a, b) => b.meetup_count - a.meetup_count)

      setPotentialConnections(potentialArray)
      console.log('Loaded potential connections:', potentialArray.length)
    } catch (err) {
      console.error('Error loading potential connections:', err)
      setPotentialConnections([])
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
        console.log('No signups found or error:', error)
        return
      }
      
      console.log('Found signups:', signups)
      
      // Count how many meetups are in the past
      const now = new Date()
      const attendedCount = signups.filter(signup => {
        try {
          if (!signup.meetups) return false
          
          // Parse date - same logic as HomeView filter
          let dateStr = signup.meetups.date
          
          // Remove day of week if present
          dateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          
          // Add current year if not present
          if (!dateStr.includes('2024') && !dateStr.includes('2025')) {
            dateStr = `${dateStr}, ${new Date().getFullYear()}`
          }
          
          const meetupDate = new Date(dateStr)
          
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
          console.log(`Meetup ${signup.meetups.date} ${meetupTime}: ${isPast ? 'PAST' : 'FUTURE'}`)
          
          return isPast
        } catch (err) {
          console.error('Error parsing date:', err)
          return false
        }
      }).length
      
      console.log(`Attended count: ${attendedCount}, Current: ${currentUser.meetups_attended}`)
      
      // Update profile if count changed
      if (attendedCount !== currentUser.meetups_attended) {
        console.log(`Updating meetups_attended from ${currentUser.meetups_attended} to ${attendedCount}`)
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ meetups_attended: attendedCount })
          .eq('id', currentUser.id)
        
        if (!updateError) {
          // Update local state
          currentUser.meetups_attended = attendedCount
          console.log(`✅ Updated meetups_attended to ${attendedCount}`)
          // Force re-render
          window.location.reload()
        } else {
          console.error('Error updating profile:', updateError)
        }
      } else {
        console.log('✅ Attended count already correct')
      }
    } catch (err) {
      console.error('Error updating attended count:', err)
    }
  }, [currentUser.id, supabase])

  // Helper function to format time from 24hr to 12hr
  const formatTime = (time24) => {
    if (!time24) return ''
    try {
      const [hours, minutes] = time24.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    } catch {
      return time24 // Return original if parsing fails
    }
  }

  // Helper function to format date from ISO to friendly display
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      // Handle both ISO format (2024-12-28) and old format (Wednesday, Dec 3)
      let date
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO format - parse as local timezone to avoid UTC issues
        const [year, month, day] = dateStr.split('-').map(Number)
        date = new Date(year, month - 1, day) // month is 0-indexed
      } else {
        // Old format - clean and parse
        const cleanDateStr = dateStr
          .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
          .trim()
        date = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
      }
      
      if (isNaN(date.getTime())) return dateStr // Return original if can't parse
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  // Safety check - if currentUser is not loaded yet, show loading
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Demo data - will be replaced with Supabase data later
  const upcomingMeetups = meetups

  // Use database unread count instead of hardcoded chats
  const unreadCount = unreadMessageCount

  const handleSignUp = async (meetupId) => {
    try {
      const { error } = await supabase
        .from('meetup_signups')
        .insert([
          {
            meetup_id: meetupId,
            user_id: currentUser.id
          }
        ])

      if (error) {
        if (error.code === '23505') { // Unique violation
          alert('You have already signed up for this meetup!')
        } else {
          alert('Error signing up: ' + error.message)
        }
      } else {
        await loadUserSignups()
        await loadMeetupsFromDatabase()
        alert('Successfully signed up for meetup!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleCancelSignup = async (meetupId) => {
    if (!confirm('Are you sure you want to cancel your signup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetup_signups')
        .delete()
        .eq('meetup_id', meetupId)
        .eq('user_id', currentUser.id)

      if (error) {
        alert('Error canceling signup: ' + error.message)
      } else {
        await loadUserSignups()
        await loadMeetupsFromDatabase()
        alert('Signup canceled successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleCreateMeetup = async () => {
    if (!newMeetup.date || !newMeetup.time) {
      alert('Please fill in date and time')
      return
    }

    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert([
          {
            date: newMeetup.date,
            time: newMeetup.time,
            location: newMeetup.location || null,
            created_by: currentUser.id
          }
        ])
        .select()

      if (error) {
        alert('Error creating meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        setNewMeetup({ date: '', time: '', location: '' })
        setSelectedDate(null)
        setShowCreateMeetup(false)
        alert('Meetup created successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleEditMeetup = (meetup) => {
    setEditingMeetup({ ...meetup })
    setShowEditMeetup(true)
  }

  const handleUpdateMeetup = async () => {
    if (!editingMeetup.date || !editingMeetup.time) {
      alert('Please fill in date and time')
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          date: editingMeetup.date,
          time: editingMeetup.time,
          location: editingMeetup.location || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMeetup.id)

      if (error) {
        alert('Error updating meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        setShowEditMeetup(false)
        setEditingMeetup(null)
        alert('Meetup updated successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteMeetup = async (meetupId) => {
    if (!confirm('Are you sure you want to delete this meetup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .delete()
        .eq('id', meetupId)

      if (error) {
        alert('Error deleting meetup: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        alert('Meetup deleted successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleSetLocation = async (meetupId, location) => {
    if (!location.trim()) {
      alert('Please enter a location')
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({
          location: location,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetupId)

      if (error) {
        alert('Error setting location: ' + error.message)
      } else {
        // Real-time subscription will automatically reload meetups
        alert('Location set successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleSaveProfile = async () => {
    if (!editedProfile.name || !editedProfile.career || !editedProfile.age || !editedProfile.city || !editedProfile.state) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editedProfile.name,
          career: editedProfile.career,
          age: parseInt(editedProfile.age),
          city: editedProfile.city,
          state: editedProfile.state.toUpperCase(),
          bio: editedProfile.bio
        })
        .eq('id', currentUser.id)

      if (error) {
        alert('Error updating profile: ' + error.message)
      } else {
        // Update local state
        Object.assign(currentUser, editedProfile)
        setShowEditProfile(false)
        alert('Profile updated successfully!')
        window.location.reload() // Reload to fetch updated data
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleShowInterest = async (userId, userName) => {
    try {
      console.log('🔔 Showing interest in:', userName, userId)
      
      const { error } = await supabase
        .from('user_interests')
        .insert([{
          user_id: currentUser.id,
          interested_in_user_id: userId
        }])

      if (error) {
        if (error.code === '23505') {
          alert('You already showed interest in this person')
        } else {
          console.error('Error inserting interest:', error)
          alert('Error: ' + error.message)
        }
        return
      }

      console.log('✅ Interest inserted successfully')
      
      // Check if this creates a mutual match
      const { data: mutualCheck, error: mutualError } = await supabase
        .rpc('check_mutual_interest', { 
          user1_id: currentUser.id, 
          user2_id: userId 
        })

      if (mutualError) {
        console.error('Error checking mutual interest:', mutualError)
        console.log('⚠️ Mutual check failed, but interest was recorded')
      } else {
        console.log('🔍 Mutual check result:', mutualCheck)
        
        if (mutualCheck) {
          alert(`🎉 It's a match! You and ${userName} are now connected!`)
        } else {
          alert(`✓ Interest shown in ${userName}`)
        }
      }
      
      // Reload data
      console.log('🔄 Reloading interests and connections...')
      await loadMyInterests()
      await loadConnections()
      await loadMeetupPeople()
      console.log('✅ Data reloaded')
    } catch (err) {
      console.error('💥 Error in handleShowInterest:', err)
      alert('Error: ' + err.message)
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
        alert('Error: ' + error.message)
      } else {
        alert('Interest removed')
        loadMyInterests()
        loadMeetupPeople()
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const openEditProfile = () => {
    setEditedProfile({ ...currentUser })
    setShowEditProfile(true)
  }

  const ProgressBar = ({ current, total }) => {
    const percentage = Math.min((current / total) * 100, 100) // Cap at 100%
    return (
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className="bg-rose-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  const HomeView = () => {
    // Filter to only show UPCOMING meetups (not past ones)
    // WRAPPED IN useMemo to prevent infinite re-render loop!
    const upcomingMeetups = useMemo(() => {
      const now = new Date()
      return meetups.filter(meetup => {
        try {
          let meetupDate
          const dateStr = meetup.date
          
          // Check if ISO format (YYYY-MM-DD)
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // ISO format - parse as local timezone to avoid UTC issues
            const [year, month, day] = dateStr.split('-').map(Number)
            meetupDate = new Date(year, month - 1, day) // month is 0-indexed
          } else {
            // Old format like "Wednesday, Dec 3" - remove day name
            const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
            meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
          }
          
          // If can't parse, show it
          if (isNaN(meetupDate.getTime())) {
            console.log('Could not parse date:', meetup.date)
            return true
          }
          
          // Add time to the meetup date for accurate comparison
          if (meetup.time) {
            const [hours, minutes] = meetup.time.split(':').map(Number)
            meetupDate.setHours(hours, minutes, 0, 0)
          }
          
          // Compare full datetime (date + time)
          const isUpcoming = meetupDate > now
          
          // Removed console.logs to reduce spam
          // if (!isUpcoming) {
          //   console.log(`Filtering out past meetup: ${meetup.date} at ${meetup.time}`)
          // }
          
          return isUpcoming
          
        } catch (err) {
          console.error('Error parsing date:', meetup.date, err)
          return true
        }
      })
    }, [meetups]) // Only re-filter when meetups array changes

    return (
      <div className="space-y-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-6 border border-rose-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Your Journey</h3>
              <p className="text-sm text-gray-600">Complete 3 meetups to unlock 1-on-1 video chat</p>
            </div>
            <div className="text-3xl font-bold text-rose-500">{currentUser.meetups_attended}/3</div>
          </div>
          <ProgressBar current={currentUser.meetups_attended} total={3} />
          {currentUser.meetups_attended >= 3 && (
            <div className="mt-4 flex items-center text-green-600">
              <Star className="w-5 h-5 mr-2 fill-current" />
              <span className="font-medium">Unlocked! You can now schedule 1-on-1 coffee chats</span>
            </div>
          )}
        </div>

        {/* Upcoming Meetups */}
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Upcoming Meetups</h3>
          {loadingMeetups ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading meetups...</p>
            </div>
          ) : upcomingMeetups.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No upcoming meetups</p>
              <p className="text-sm text-gray-500 mt-2">
                {currentUser.meetups_attended > 0 
                  ? `You've attended ${currentUser.meetups_attended} meetup${currentUser.meetups_attended > 1 ? 's' : ''}! Check back for new events.`
                  : 'Check back soon for new events!'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetups.map(meetup => {
                // Check if we should show participants (12 hours before event)
                const meetupDateTime = new Date(`${meetup.date}T${meetup.time}`)
                const now = new Date()
                const hoursUntilMeetup = (meetupDateTime - now) / (1000 * 60 * 60) // difference in hours
                const showParticipants = hoursUntilMeetup <= 12 && hoursUntilMeetup > 0
                
                const meetupSignups = signups[meetup.id] || []
                const participantCount = meetupSignups.length
                
                return (
                <div key={meetup.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                  <div className="mb-4">
                    <div className="flex items-center text-gray-800 font-semibold mb-1">
                      <Calendar className="w-5 h-5 mr-2 text-rose-500" />
                      {formatDate(meetup.date)}
                    </div>
                    <div className="flex items-center text-gray-600 text-sm ml-7">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(meetup.time)}
                    </div>
                    <div className="text-xs text-gray-500 ml-7 mt-1">
                      Location near {currentUser.city}, {currentUser.state}
                    </div>
                  </div>
                  
                  {/* Show participants 12 hours before event */}
                  {showParticipants && participantCount > 0 && (
                    <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-purple-800 mb-2">
                        👥 {participantCount} {participantCount === 1 ? 'person' : 'people'} joining:
                      </p>
                      <div className="space-y-1">
                        {meetupSignups.map((signup, idx) => (
                          <div key={signup.id || idx} className="text-sm text-purple-700">
                            • {signup.profiles?.career || 'Professional'}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        💡 You'll meet everyone in person at the event
                      </p>
                    </div>
                  )}
                  
                  {/* Don't show participants yet if more than 12 hours away */}
                  {!showParticipants && hoursUntilMeetup > 12 && participantCount > 0 && (
                    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-600">
                        👥 {participantCount} {participantCount === 1 ? 'person has' : 'people have'} signed up
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Participants will be visible 12 hours before the event
                      </p>
                    </div>
                  )}
                  
                  {userSignups.includes(meetup.id) ? (
                    <div className="space-y-2">
                      <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-700 text-sm font-medium">
                        ✓ You're signed up! Location details will be sent the morning of the meetup
                      </div>
                      
                      <button 
                        onClick={() => handleCancelSignup(meetup.id)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded transition-colors border border-red-200 text-sm"
                      >
                        Cancel Signup
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleSignUp(meetup.id)}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded transition-colors"
                    >
                      Sign Up
                    </button>
                  )}
                </div>
              )
            })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const ConnectionsView = () => {
    const [activeTab, setActiveTab] = useState('network') // network, discover
    const [expandedMeetup, setExpandedMeetup] = useState(null) // Track which meetup is expanded

    const toggleMeetup = (meetupId) => {
      setExpandedMeetup(expandedMeetup === meetupId ? null : meetupId)
    }

    const meetupPeopleArray = Object.entries(meetupPeople).map(([meetupId, data]) => ({
      meetupId,
      ...data
    }))

    const totalPeopleCount = meetupPeopleArray.reduce((sum, mp) => sum + mp.people.length, 0)

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Network</h3>
          <p className="text-sm text-gray-600">Show interest privately - connect when it's mutual! ❤️</p>
        </div>

        {currentUser.meetups_attended < 3 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              🔒 Complete {3 - currentUser.meetups_attended} more meetups to unlock 1-on-1 video chats
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'network'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            My Connections ({connections.length})
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'discover'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Discover People ({totalPeopleCount})
          </button>
        </div>

        {/* My Connections Tab */}
        {activeTab === 'network' && (
          <div className="space-y-4">
            {connections.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No connections yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Show interest in people from "Discover" tab to match!
                </p>
              </div>
            ) : (
              connections.map(connection => {
                const person = connection.connected_user
                return (
                  <div key={connection.id} className="bg-white rounded-lg shadow p-5 border border-green-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <h4 className="font-semibold text-gray-800 text-lg">{person.name}</h4>
                          <div className="ml-2 bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full flex items-center">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            Mutual Match
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{person.career}</p>
                        {person.city && person.state && (
                          <p className="text-xs text-gray-500">{person.city}, {person.state}</p>
                        )}
                        {person.bio && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{person.bio}"</p>
                        )}
                      </div>
                    </div>
                    
                    {currentUser.meetups_attended >= 3 ? (
                      <button 
                        onClick={() => setCurrentView('coffeeChats')}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors flex items-center justify-center"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Schedule Video Chat
                      </button>
                    ) : (
                      <button disabled className="w-full bg-gray-300 text-gray-500 font-medium py-2 rounded cursor-not-allowed">
                        🔒 Complete {3 - currentUser.meetups_attended} more meetups to unlock
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Discover Tab - Grouped by Meetups */}
        {activeTab === 'discover' && (
          <div className="space-y-4">
            {meetupPeopleArray.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No one to discover yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Attend more meetups to meet new people!
                </p>
              </div>
            ) : (
              meetupPeopleArray.map(({ meetupId, meetup, people }) => {
                const isExpanded = expandedMeetup === meetupId
                
                return (
                  <div key={meetupId} className="bg-white rounded-lg shadow border border-gray-200">
                    {/* Meetup Header - Clickable to expand/collapse */}
                    <button
                      onClick={() => toggleMeetup(meetupId)}
                      className="w-full p-5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <Calendar className="w-5 h-5 mr-2 text-purple-500" />
                            <h3 className="font-semibold text-gray-800">{formatDate(meetup.date)}</h3>
                          </div>
                          <div className="flex items-center text-sm text-gray-600 ml-7">
                            <Clock className="w-4 h-4 mr-2" />
                            {formatTime(meetup.time)}
                          </div>
                          <div className="flex items-center text-sm text-purple-600 ml-7 mt-1">
                            <Users className="w-4 h-4 mr-1" />
                            {people.length} {people.length === 1 ? 'person' : 'people'} to discover
                          </div>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      </div>
                    </button>

                    {/* People List - Show when expanded */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                        {people.map(personData => {
                          const person = personData.user
                          const hasShownInterest = myInterests.includes(personData.id)
                          
                          return (
                            <div key={personData.id} className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800 text-lg">{person.name}</h4>
                                  <p className="text-sm text-gray-600 mb-1">{person.career}</p>
                                  {person.city && person.state && (
                                    <p className="text-xs text-gray-500">{person.city}, {person.state}</p>
                                  )}
                                  {person.bio && (
                                    <p className="text-sm text-gray-700 mt-2 italic">"{person.bio}"</p>
                                  )}
                                </div>
                              </div>
                              
                              {hasShownInterest ? (
                                <div className="space-y-2">
                                  <div className="bg-purple-50 border border-purple-200 rounded px-4 py-2 text-purple-700 text-sm font-medium text-center">
                                    ✓ Interest shown - waiting for mutual match
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveInterest(personData.id)}
                                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors text-sm"
                                  >
                                    Remove Interest
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleShowInterest(personData.id, person.name)}
                                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded transition-colors flex items-center justify-center"
                                >
                                  <Heart className="w-4 h-4 mr-2" />
                                  Show Interest
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    )
  }

  const ProfileView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-6">
          <div className="w-20 h-20 bg-rose-200 rounded-full flex items-center justify-center text-3xl text-rose-600 font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div className="ml-4">
            <h3 className="text-2xl font-bold text-gray-800">{currentUser.name}</h3>
            <p className="text-gray-600">{currentUser.career} • Age {currentUser.age}</p>
            <p className="text-sm text-gray-500">{currentUser.city}, {currentUser.state}</p>
            {currentUser.role === 'admin' && (
              <span className="inline-block mt-2 bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <p className="text-gray-700">{currentUser.bio || 'No bio yet'}</p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-800 mb-2">Stats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 rounded p-3">
                <div className="text-2xl font-bold text-rose-600">{currentUser.meetups_attended}</div>
                <div className="text-sm text-gray-600">Meetups Attended</div>
              </div>
              <div className="bg-purple-50 rounded p-3">
                <div className="text-2xl font-bold text-purple-600">{connections.length}</div>
                <div className="text-sm text-gray-600">Connections</div>
              </div>
            </div>
          </div>

          <button 
            onClick={openEditProfile}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded transition-colors"
          >
            Edit Profile
          </button>

          <button 
            onClick={onSignOut}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded transition-colors border border-red-200"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Dashboard</h3>
        <p className="text-sm text-gray-600">Manage meetups and view signups</p>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Manage Meetups</h3>
        <button 
          onClick={() => setShowCreateMeetup(true)}
          className="bg-purple-500 hover:bg-purple-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Create Meetup
        </button>
      </div>

      {meetups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No meetups yet</p>
          <p className="text-sm text-gray-500 mt-2">Create your first meetup above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetups.map(meetup => {
            const meetupSignups = signups[meetup.id] || []
            const signupCount = meetupSignups.length

            return (
              <div key={meetup.id} className="bg-white rounded-lg shadow p-5 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center text-gray-800 font-semibold mb-1">
                      <Calendar className="w-5 h-5 mr-2 text-purple-500" />
                      {formatDate(meetup.date)} at {formatTime(meetup.time)}
                    </div>
                    {meetup.location && (
                      <div className="flex items-center text-gray-600 text-sm ml-7 mt-1">
                        <MapPin className="w-4 h-4 mr-2" />
                        {meetup.location}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 ml-7 mt-1">{signupCount} {signupCount === 1 ? 'signup' : 'signups'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditMeetup(meetup)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMeetup(meetup.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {!meetup.location && (
                  <div className="border-t pt-3 mb-3">
                    <p className="text-xs text-gray-500 mb-2">Set location (optional):</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., Blue Bottle Coffee, 123 Main St"
                        className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-purple-500"
                        id={'location-' + meetup.id}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('location-' + meetup.id)
                          if (input.value) {
                            handleSetLocation(meetup.id, input.value)
                          }
                        }}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded text-sm transition-colors"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}

                {signupCount > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Signups:</p>
                    <div className="space-y-2">
                      {meetupSignups.map((signup) => (
                        <div key={signup.id} className="bg-gray-50 rounded p-3">
                          <p className="font-medium text-gray-800">{signup.profiles?.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{signup.profiles?.email || 'N/A'}</p>
                          <p className="text-sm text-gray-600">
                            {signup.profiles?.career || 'N/A'} • Age {signup.profiles?.age || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {signup.profiles?.city || 'N/A'}, {signup.profiles?.state || 'N/A'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center">
            <Coffee className="mr-3" />
            Avari
          </h1>
          <p className="text-rose-100 mt-1">Welcome back, {currentUser.name}!</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {currentView === 'home' && <HomeView />}
        {currentView === 'coffeeChats' && <CoffeeChatsView currentUser={currentUser} connections={connections} supabase={supabase} />}
        {currentView === 'connections' && <ConnectionsView />}
        {currentView === 'messages' && <MessagesView currentUser={currentUser} supabase={supabase} />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'admin' && currentUser.role === 'admin' && <AdminDashboard />}
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full h-[600px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Jessica Lee</h3>
              <button onClick={() => setShowChatModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex justify-start">
                <div className="max-w-xs bg-gray-200 text-gray-800 rounded-lg p-3">
                  <p className="text-sm">Hey! I'd love to grab coffee and chat more about product management!</p>
                  <p className="text-xs text-gray-500 mt-1">2:30 PM</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-xs bg-rose-500 text-white rounded-lg p-3">
                  <p className="text-sm">Absolutely! When works for you?</p>
                  <p className="text-xs text-rose-100 mt-1">2:35 PM</p>
                </div>
              </div>
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-rose-500"
                />
                <button className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && editedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Career</label>
                <input
                  type="text"
                  value={editedProfile.career}
                  onChange={(e) => setEditedProfile({ ...editedProfile, career: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  value={editedProfile.age}
                  onChange={(e) => setEditedProfile({ ...editedProfile, age: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    value={editedProfile.city}
                    onChange={(e) => setEditedProfile({ ...editedProfile, city: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={editedProfile.state}
                    onChange={(e) => setEditedProfile({ ...editedProfile, state: e.target.value.toUpperCase() })}
                    maxLength="2"
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-rose-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editedProfile.bio || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 h-24 resize-none focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-medium py-2 rounded transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Meetup Modal */}
      {showCreateMeetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create New Meetup</h3>
              <button onClick={() => setShowCreateMeetup(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* DATE PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date)
                    if (date) {
                      // Convert to ISO format for database
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      setNewMeetup({ ...newMeetup, date: `${year}-${month}-${day}` })
                    } else {
                      setNewMeetup({ ...newMeetup, date: '' })
                    }
                  }}
                  minDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Click to select a date"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500 cursor-pointer"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                  required
                />
              </div>

              {/* TIME PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  value={newMeetup.time}
                  onChange={(e) => setNewMeetup({ ...newMeetup, time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* LOCATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (Optional)</label>
                <input
                  type="text"
                  value={newMeetup.location}
                  onChange={(e) => setNewMeetup({ ...newMeetup, location: e.target.value })}
                  placeholder="e.g., Starbucks on Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">You can set the location after seeing who signs up</p>
              </div>
            </div>

            {/* PREVIEW */}
            {newMeetup.date && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800 font-medium">Preview:</p>
                <p className="text-sm text-purple-700">
                  {formatDate(newMeetup.date)}
                  {newMeetup.time && ` at ${formatTime(newMeetup.time)}`}
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateMeetup(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeetup}
                disabled={!newMeetup.date || !newMeetup.time}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Meetup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meetup Modal */}
      {showEditMeetup && editingMeetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Meetup</h3>
              <button onClick={() => setShowEditMeetup(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* DATE PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <DatePicker
                  selected={editingMeetup.date ? new Date(editingMeetup.date) : null}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      setEditingMeetup({ ...editingMeetup, date: `${year}-${month}-${day}` })
                    }
                  }}
                  minDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Click to select a date"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500 cursor-pointer"
                  wrapperClassName="w-full"
                  showPopperArrow={false}
                  required
                />
              </div>

              {/* TIME PICKER */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  value={editingMeetup.time}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* LOCATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={editingMeetup.location || ''}
                  onChange={(e) => setEditingMeetup({ ...editingMeetup, location: e.target.value })}
                  placeholder="e.g., Blue Bottle Coffee, 123 Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* PREVIEW */}
            {editingMeetup.date && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800 font-medium">Preview:</p>
                <p className="text-sm text-purple-700">
                  {formatDate(editingMeetup.date)}
                  {editingMeetup.time && ` at ${formatTime(editingMeetup.time)}`}
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditMeetup(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMeetup}
                disabled={!editingMeetup.date || !editingMeetup.time}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Update Meetup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-around py-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex flex-col items-center px-4 py-2 flex-shrink-0 ${
              currentView === 'home' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Calendar className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Meetups</span>
          </button>
          <button
            onClick={() => setCurrentView('coffeeChats')}
            className={`flex flex-col items-center px-4 py-2 flex-shrink-0 ${
              currentView === 'coffeeChats' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Video className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Chats</span>
          </button>
          <button
            onClick={() => setCurrentView('connections')}
            className={`flex flex-col items-center px-4 py-2 flex-shrink-0 ${
              currentView === 'connections' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Network</span>
          </button>
          <button
            onClick={() => setCurrentView('messages')}
            className={`flex flex-col items-center px-4 py-2 flex-shrink-0 relative ${
              currentView === 'messages' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <MessageCircle className="w-6 h-6 mb-1" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
            <span className="text-xs font-medium">Messages</span>
          </button>
          <button
            onClick={() => setCurrentView('profile')}
            className={`flex flex-col items-center px-4 py-2 flex-shrink-0 ${
              currentView === 'profile' ? 'text-rose-500' : 'text-gray-500'
            }`}
          >
            <User className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Profile</span>
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex flex-col items-center px-4 py-2 flex-shrink-0 ${
                currentView === 'admin' ? 'text-rose-500' : 'text-gray-500'
              }`}
            >
              <Coffee className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Admin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Memoize MainApp to prevent re-renders unless userId actually changes
export default React.memo(MainApp, (prevProps, nextProps) => {
  // Only re-render if user ID changes (ignore function reference changes)
  return prevProps.currentUser?.id === nextProps.currentUser?.id
})
