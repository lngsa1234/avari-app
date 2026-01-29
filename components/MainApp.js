'use client'

import { supabase } from '@/lib/supabase'
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar, Coffee, Users, Star, MapPin, Clock, User, Heart, MessageCircle, Send, X, Video, Compass } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import MeetupsView from './MeetupsView'
import ConnectionGroupsView from './ConnectionGroupsView'
import MeetupProposalsView from './MeetupProposalsView'
import MessagesView from './MessagesView'
import CallHistoryView from './CallHistoryView'
import FeedbackButton from './FeedbackButton'
import AdminFeedbackView from './AdminFeedbackView'
import Onboarding from './Onboarding'
import JourneyProgress from './JourneyProgress'
import NextStepPrompt from './NextStepPrompt'
import { createAgoraRoom, hasAgoraRoom } from '@/lib/agoraHelpers'
import NetworkDiscoverView from './NetworkDiscoverView'
import { updateLastActiveThrottled } from '@/lib/activityHelpers'

function MainApp({ currentUser, onSignOut }) {
  // DEBUGGING: Track renders vs mounts
  const renderCountRef = useRef(0)
  renderCountRef.current++
  
  const mountTimeRef = useRef(Date.now())
  const componentIdRef = useRef(Math.random().toString(36).substring(7))
  
  console.log('🔥 MainApp loaded - UPDATED VERSION with TIME ORDERING')
  console.log(`🔁 Render #${renderCountRef.current} | Component ID: ${componentIdRef.current} | Age: ${Date.now() - mountTimeRef.current}ms`)
  console.log(`👤 currentUser.id: ${currentUser?.id}`)
  console.log(`🔑 Props changed: currentUser=${!!currentUser}, onSignOut=${!!onSignOut}, supabase=${!!supabase}`)
  
  // 🔥 WRAPPER for sign out with debugging
  const handleSignOut = useCallback(async () => {
    console.log('🚨 MainApp: Sign out button clicked!')
    console.log('🚨 MainApp: onSignOut function exists?', typeof onSignOut)
    
    if (!onSignOut) {
      console.error('❌ MainApp: onSignOut function is undefined!')
      return
    }
    
    try {
      console.log('🚨 MainApp: Calling onSignOut...')
      await onSignOut()
      console.log('✅ MainApp: onSignOut completed')
    } catch (error) {
      console.error('❌ MainApp: Error in onSignOut:', error)
    }
  }, [onSignOut])
  
  const [currentView, setCurrentView] = useState('home')
  const [showChatModal, setShowChatModal] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showCreateMeetup, setShowCreateMeetup] = useState(false)
  const [showEditMeetup, setShowEditMeetup] = useState(false)
  const [editedProfile, setEditedProfile] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [newMeetup, setNewMeetup] = useState({ date: '', time: '', location: '', topic: '', duration: '60', participantLimit: '100', description: '' })
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
  const [showOnboarding, setShowOnboarding] = useState(false) // Onboarding for new users
  const [groupsCount, setGroupsCount] = useState(0) // Number of groups user is in
  const [coffeeChatsCount, setCoffeeChatsCount] = useState(0) // Number of 1:1 coffee chats completed
  const [nextStepPrompt, setNextStepPrompt] = useState(null) // { type, data } for post-action prompts
  const [showProfileDropdown, setShowProfileDropdown] = useState(false) // Profile dropdown in header
  const [pendingRecaps, setPendingRecaps] = useState([]) // Pending recaps checklist
  const [connectionRequests, setConnectionRequests] = useState([]) // Incoming connection requests

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

  // Check if user needs onboarding
  useEffect(() => {
    if (!currentUser?.id) return

    const onboardingKey = `circlew_onboarding_complete_${currentUser.id}`
    const hasCompletedOnboarding = localStorage.getItem(onboardingKey)

    if (!hasCompletedOnboarding) {
      // Show onboarding for new users
      setShowOnboarding(true)
    }
  }, [currentUser?.id])

  // Track user activity (update last_active timestamp)
  useEffect(() => {
    if (!currentUser?.id) return

    // Update on initial load
    updateLastActiveThrottled(currentUser.id)

    // Update periodically while user is active (every 5 minutes)
    const interval = setInterval(() => {
      updateLastActiveThrottled(currentUser.id)
    }, 5 * 60 * 1000)

    // Update on user interactions
    const handleActivity = () => {
      updateLastActiveThrottled(currentUser.id)
    }

    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
      clearInterval(interval)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [currentUser?.id])

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    if (!currentUser?.id) return

    const onboardingKey = `circlew_onboarding_complete_${currentUser.id}`
    localStorage.setItem(onboardingKey, 'true')
    setShowOnboarding(false)
  }, [currentUser?.id])

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
    loadConnectionRequests()
    loadMeetupPeople()
    updateAttendedCount()
    loadUnreadMessageCount()
    loadGroupsCount()
    loadCoffeeChatsCount()
    loadPendingRecaps()

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
          loadConnectionRequests() // Reload incoming requests
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

  // Load incoming connection requests (people interested in me, but not mutual yet)
  const loadConnectionRequests = useCallback(async () => {
    try {
      console.log('🔍 Loading connection requests...')

      // Step 1: Get people who expressed interest in current user
      const { data: incomingInterests, error: incomingError } = await supabase
        .from('user_interests')
        .select('user_id, created_at')
        .eq('interested_in_user_id', currentUser.id)

      if (incomingError) throw incomingError

      if (!incomingInterests || incomingInterests.length === 0) {
        console.log('📭 No incoming interests')
        setConnectionRequests([])
        return
      }

      // Step 2: Get people current user has expressed interest in (to filter out mutual)
      const { data: myInterestsData, error: myError } = await supabase
        .from('user_interests')
        .select('interested_in_user_id')
        .eq('user_id', currentUser.id)

      if (myError) throw myError

      const myInterestIds = new Set((myInterestsData || []).map(i => i.interested_in_user_id))

      // Step 3: Filter to only non-mutual (pending requests)
      const pendingRequestUserIds = incomingInterests
        .filter(i => !myInterestIds.has(i.user_id))
        .map(i => ({ user_id: i.user_id, created_at: i.created_at }))

      if (pendingRequestUserIds.length === 0) {
        console.log('📭 All incoming interests are mutual (already connections)')
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

  // Load groups count for journey progress
  const loadGroupsCount = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('connection_group_members')
        .select('id', { count: 'exact' })
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted')

      if (error) throw error
      setGroupsCount(data?.length || 0)
    } catch (err) {
      console.error('Error loading groups count:', err)
      setGroupsCount(0)
    }
  }, [currentUser.id, supabase])

  // Load coffee chats count (1:1 calls completed)
  const loadCoffeeChatsCount = useCallback(async () => {
    try {
      // Count call recaps where this user participated in a 1:1 call
      const { data, error } = await supabase
        .from('call_recaps')
        .select('id', { count: 'exact' })
        .eq('call_type', '1on1')
        .or(`caller_id.eq.${currentUser.id},callee_id.eq.${currentUser.id}`)

      if (error) {
        // Table might not exist, that's okay
        console.log('Coffee chats count not available:', error.message)
        setCoffeeChatsCount(0)
        return
      }
      setCoffeeChatsCount(data?.length || 0)
    } catch (err) {
      console.error('Error loading coffee chats count:', err)
      setCoffeeChatsCount(0)
    }
  }, [currentUser.id, supabase])

  // Load pending recaps for the checklist
  const loadPendingRecaps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('call_recaps')
        .select('*')
        .or(`caller_id.eq.${currentUser.id},callee_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.log('Pending recaps not available:', error.message)
        setPendingRecaps([])
        return
      }
      setPendingRecaps(data || [])
    } catch (err) {
      console.error('Error loading pending recaps:', err)
      setPendingRecaps([])
    }
  }, [currentUser.id, supabase])

  // Get greeting based on time of day
  const getTimeBasedGreeting = useCallback(() => {
    const hour = new Date().getHours()
    if (hour < 12) return { greeting: 'Good morning', emoji: '☀️' }
    if (hour < 17) return { greeting: 'Good afternoon', emoji: '🌤️' }
    return { greeting: 'Good evening', emoji: '🌙' }
  }, [])

  // Get next meeting within 60 minutes
  const getNextUpcomingMeeting = useCallback((meetupsList, userSignupsList) => {
    const now = new Date()
    const sixtyMinLater = new Date(now.getTime() + 60 * 60 * 1000)

    for (const meetup of meetupsList) {
      if (!userSignupsList.includes(meetup.id)) continue

      try {
        let meetupDate
        const dateStr = meetup.date
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateStr.split('-').map(Number)
          meetupDate = new Date(year, month - 1, day)
        } else {
          const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
        }

        if (meetup.time) {
          const [hours, minutes] = meetup.time.split(':').map(Number)
          meetupDate.setHours(hours, minutes, 0, 0)
        }

        if (meetupDate >= now && meetupDate <= sixtyMinLater) {
          // Calculate minutes until meeting
          const minutesUntil = Math.round((meetupDate - now) / (1000 * 60))
          return { ...meetup, minutesUntil }
        }
      } catch (err) {
        console.error('Error parsing meetup date:', err)
      }
    }
    return null
  }, [])

  // Count meetings within 60 minutes
  const getUpcomingMeetingCount = useCallback((meetupsList, userSignupsList) => {
    const now = new Date()
    const sixtyMinLater = new Date(now.getTime() + 60 * 60 * 1000)
    let count = 0

    for (const meetup of meetupsList) {
      if (!userSignupsList.includes(meetup.id)) continue

      try {
        let meetupDate
        const dateStr = meetup.date
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateStr.split('-').map(Number)
          meetupDate = new Date(year, month - 1, day)
        } else {
          const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
          meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
        }

        if (meetup.time) {
          const [hours, minutes] = meetup.time.split(':').map(Number)
          meetupDate.setHours(hours, minutes, 0, 0)
        }

        if (meetupDate >= now && meetupDate <= sixtyMinLater) {
          count++
        }
      } catch (err) {
        console.error('Error parsing meetup date:', err)
      }
    }
    return count
  }, [])

  const loadMeetupPeople = useCallback(async () => {
    try {
      console.log('🔍 Loading meetup people...')

      // STEP 1: Get meetups current user attended
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

      // STEP 2: Get meetup details for attended meetups
      const { data: allMeetupsData, error: meetupsError } = await supabase
        .from('meetups')
        .select('*')
        .in('id', myMeetupIds)
        .order('date', { ascending: false })

      if (meetupsError) throw meetupsError

      // STEP 3: Filter to ONLY PAST meetups (date + time check)
      const now = new Date()
      const meetupsData = allMeetupsData.filter(meetup => {
        const meetupDateTime = new Date(`${meetup.date}T${meetup.time}`)
        const isPast = meetupDateTime < now
        
        console.log(`📅 Meetup: ${meetup.date} ${meetup.time} - Is Past? ${isPast}`)
        return isPast
      })

      if (!meetupsData || meetupsData.length === 0) {
        console.log('⚠️ No PAST meetups found (based on date + time)')
        setMeetupPeople({})
        return
      }

      console.log('✅ Loaded', meetupsData.length, 'PAST meetup details (date + time verified)')

      // STEP 4: 🔥 Get existing connections to exclude them
      // Use the same RPC function as loadConnections
      const { data: existingConnections, error: connectionsError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (connectionsError) {
        console.error('⚠️ Error loading connections for filtering:', connectionsError)
      }

      // Build a Set of connected user IDs for fast lookup
      const connectedUserIds = new Set()
      if (existingConnections) {
        existingConnections.forEach(match => {
          // The RPC returns matched_user_id
          connectedUserIds.add(match.matched_user_id)
        })
      }

      console.log('🚫 Excluding', connectedUserIds.size, 'existing connections:', Array.from(connectedUserIds))

      // STEP 5: For each meetup, get other attendees and FILTER OUT connections
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

        if (signupsError) {
          console.error('❌ Error loading signups:', signupsError)
          continue
        }

        if (!signups || signups.length === 0) {
          console.log('⚠️ No other attendees at this meetup')
          continue
        }

        // 🔥 CRITICAL FIX: Filter out existing connections
        const userIds = signups
          .map(s => s.user_id)
          .filter(userId => !connectedUserIds.has(userId))

        console.log('👥 Found', signups.length, 'total attendees,', userIds.length, 'after filtering connections')

        if (userIds.length === 0) {
          console.log('✨ All attendees are already connections - nothing to discover here')
          continue
        }

        // Get profile data for these user_ids
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, career, city, state, bio, last_active')
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

        console.log('✅ Available people to discover:', people.length)

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

        // Find the meetup to get its date
        const meetup = meetups.find(m => m.id === meetupId)
        const isFirstMeetup = userSignups.length === 0

        // Show appropriate next step prompt
        setNextStepPrompt({
          type: isFirstMeetup ? 'first_meetup' : 'meetup_signup',
          data: {
            meetupDate: meetup ? formatDate(meetup.date) : null
          }
        })
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
    if (!newMeetup.date || !newMeetup.time || !newMeetup.topic) {
      alert('Please fill in topic, date and time')
      return
    }

    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert([
          {
            date: newMeetup.date,
            time: newMeetup.time,
            topic: newMeetup.topic.trim(),
            duration: parseInt(newMeetup.duration) || 60,
            participant_limit: parseInt(newMeetup.participantLimit) || 100,
            description: newMeetup.description?.trim() || null,
            location: newMeetup.location || null,
            created_by: currentUser.id
          }
        ])
        .select()

      if (error) {
        alert('Error creating meetup: ' + error.message)
      } else {
        // Reload meetups from database to ensure consistency
        await loadMeetupsFromDatabase()
        setNewMeetup({ date: '', time: '', location: '', topic: '', duration: '60', participantLimit: '100', description: '' })
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
        // Reload meetups to get updated data
        await loadMeetupsFromDatabase()
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
        // Reload meetups from database
        await loadMeetupsFromDatabase()
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
        // Reload meetups from database
        await loadMeetupsFromDatabase()
        alert('Location set successfully!')
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  // Handle profile photo upload
  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploadingPhoto(true)

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-photos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update editedProfile with new photo URL
      setEditedProfile({ ...editedProfile, profile_picture: publicUrl })
      console.log('Photo uploaded:', publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload photo: ' + err.message)
    } finally {
      setUploadingPhoto(false)
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
          bio: editedProfile.bio,
          profile_picture: editedProfile.profile_picture || null
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
      await loadConnectionRequests()
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

  const handleJoinVideoCall = async (meetupId) => {
    try {
      console.log('📹 Creating/joining video call for meetup:', meetupId);

      // Check Agora App ID is configured
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        alert('❌ Agora not configured\n\nPlease add NEXT_PUBLIC_AGORA_APP_ID to your .env.local file and restart the server.\n\nSee AGORA_SETUP.md for instructions.');
        return;
      }

      // Check if room already exists
      const exists = await hasAgoraRoom(meetupId);

      if (!exists) {
        // Create new Agora room
        console.log('🎥 Creating new Agora room...');
        const { channelName, link } = await createAgoraRoom(meetupId);
        console.log('✅ Video room created:', link);
      } else {
        console.log('✅ Video room already exists');
      }

      // Navigate to the video call
      const channelName = `meetup-${meetupId}`;
      window.location.href = `/group-meeting/${channelName}`;
    } catch (error) {
      console.error('❌ Error joining video call:', error);

      let errorMsg = '❌ Could not join video call\n\n';

      if (error.message.includes('agora_rooms')) {
        errorMsg += 'Database table not found.\n\n';
        errorMsg += 'Please run the database migration:\n';
        errorMsg += '1. Open Supabase SQL Editor\n';
        errorMsg += '2. Run database-migration-agora.sql\n\n';
        errorMsg += 'See AGORA_SETUP.md for details.';
      } else if (error.message.includes('Not authenticated')) {
        errorMsg += 'You must be logged in to join video calls.';
      } else {
        errorMsg += error.message;
      }

      alert(errorMsg);
    }
  }

  const openEditProfile = () => {
    setEditedProfile({ ...currentUser })
    setShowEditProfile(true)
  }

  const ProgressBar = ({ current, total }) => {
    const percentage = Math.min((current / total) * 100, 100) // Cap at 100%
    return (
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div 
          className="bg-rose-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  const HomeView = () => {
    // Filter to show UPCOMING meetups and recent ones (within 4 hours grace period)
    const upcomingMeetups = useMemo(() => {
      const now = new Date()
      const GRACE_PERIOD_HOURS = 4

      return meetups.filter(meetup => {
        try {
          let meetupDate
          const dateStr = meetup.date

          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateStr.split('-').map(Number)
            meetupDate = new Date(year, month - 1, day)
          } else {
            const cleanDateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')
            meetupDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
          }

          if (isNaN(meetupDate.getTime())) return true

          if (meetup.time) {
            const [hours, minutes] = meetup.time.split(':').map(Number)
            meetupDate.setHours(hours, minutes, 0, 0)
          }

          const gracePeriodEnd = new Date(meetupDate.getTime() + (GRACE_PERIOD_HOURS * 60 * 60 * 1000))
          return now < gracePeriodEnd
        } catch (err) {
          return true
        }
      })
    }, [meetups])

    // Get time-based greeting
    const { greeting, emoji } = getTimeBasedGreeting()
    const firstName = (currentUser.name || currentUser.email?.split('@')[0] || 'User').split(' ')[0]

    // Check for meetings within 60 minutes
    const nextMeeting = getNextUpcomingMeeting(meetups, userSignups)
    const upcomingMeetingCount = getUpcomingMeetingCount(meetups, userSignups)

    // Calculate momentum tracker step
    const getMomentumStep = () => {
      if (connections.length === 0) return { step: 1, label: 'Make connections' }
      if (userSignups.length === 0) return { step: 2, label: 'Schedule meetings' }
      if (pendingRecaps.length > 0) return { step: 3, label: 'Review recaps' }
      if (unreadMessageCount > 0) return { step: 4, label: 'Send follow-ups' }
      return { step: 4, label: 'All caught up!' }
    }
    const momentum = getMomentumStep()

    return (
      <div className="space-y-6">
        {/* Time-Aware Greeting Banner */}
        <div className="bg-white rounded-xl p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-stone-700">
                {greeting}, {firstName} {emoji}
              </h2>
              {upcomingMeetingCount > 0 && (
                <p className="text-stone-500 mt-1">
                  You have {upcomingMeetingCount} circle{upcomingMeetingCount > 1 ? 's' : ''} starting soon
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Hero "Next Step" Card - Only shows if meeting within 60 min */}
        {nextMeeting && (
          <div
            className="relative overflow-hidden p-6"
            style={{
              background: 'linear-gradient(to right, #FFFFFF 50%, #E8F4F8 70%, #D4E9F7 100%)',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                {/* CircleW Logo */}
                <svg width="32" height="32" viewBox="0 0 100 100" className="mr-3 text-[#6B4F3F]">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="220 60"/>
                  <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="currentColor">W</text>
                </svg>
                <div className="flex-1">
                  <h3 className="text-[#6B4F3F] font-semibold text-lg">Circle Meeting</h3>
                  <p className="text-stone-500 text-sm">
                    starts in {nextMeeting.minutesUntil}m
                  </p>
                </div>
              </div>

              <p className="text-stone-600 text-sm mb-4">
                {formatDate(nextMeeting.date)} at {formatTime(nextMeeting.time)}
              </p>

              <button
                onClick={() => handleJoinVideoCall(nextMeeting.id)}
                className="w-full bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                <Video className="w-5 h-5 mr-2" />
                Join Room
              </button>
            </div>
          </div>
        )}

        {/* Momentum Tracker */}
        <div className="bg-white rounded-xl p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-700">Your momentum</h3>
            <span className="text-sm text-stone-500">
              Step {momentum.step} of 4 — {momentum.label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Connections Card */}
            <button
              onClick={() => setCurrentView('meetups')}
              className={`p-4 border-0 transition-all text-left ${
                momentum.step === 1 ? 'ring-2 ring-[#6B4F3F] ring-offset-2' : 'hover:opacity-80'
              }`}
              style={{ backgroundColor: '#F8F5F2', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <Users className={`w-5 h-5 ${connections.length > 0 ? 'text-[#6B4F3F]' : 'text-stone-400'}`} />
                {connections.length > 0 && (
                  <div className="w-5 h-5 bg-[#6B4F3F] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-stone-700">{connections.length}</p>
              <p className="text-xs text-stone-500">Connections</p>
            </button>

            {/* Meetings Card */}
            <button
              onClick={() => setCurrentView('home')}
              className={`p-4 border-0 transition-all text-left ${
                momentum.step === 2 ? 'ring-2 ring-[#6B4F3F] ring-offset-2' : 'hover:opacity-80'
              }`}
              style={{ backgroundColor: '#F8F5F2', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <Calendar className={`w-5 h-5 ${userSignups.length > 0 ? 'text-[#6B4F3F]' : 'text-stone-400'}`} />
                {userSignups.length > 0 && (
                  <div className="w-5 h-5 bg-[#6B4F3F] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-stone-700">{userSignups.length}</p>
              <p className="text-xs text-stone-500">Meetings</p>
            </button>

            {/* Recaps Card */}
            <button
              onClick={() => setCurrentView('callHistory')}
              className={`p-4 border-0 transition-all text-left ${
                momentum.step === 3 ? 'ring-2 ring-[#6B4F3F] ring-offset-2' : 'hover:opacity-80'
              }`}
              style={{ backgroundColor: '#F8F5F2', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <Video className={`w-5 h-5 ${pendingRecaps.length === 0 ? 'text-[#6B4F3F]' : 'text-stone-400'}`} />
                {pendingRecaps.length === 0 && coffeeChatsCount > 0 && (
                  <div className="w-5 h-5 bg-[#6B4F3F] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-stone-700">{pendingRecaps.length}</p>
              <p className="text-xs text-stone-500">Recaps</p>
            </button>

            {/* Follow-up Card */}
            <button
              onClick={() => setCurrentView('messages')}
              className={`p-4 border-0 transition-all text-left ${
                momentum.step === 4 && unreadMessageCount > 0 ? 'ring-2 ring-[#6B4F3F] ring-offset-2' : 'hover:opacity-80'
              }`}
              style={{ backgroundColor: '#F8F5F2', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <MessageCircle className={`w-5 h-5 ${unreadMessageCount === 0 ? 'text-[#6B4F3F]' : 'text-stone-400'}`} />
                {unreadMessageCount === 0 && (
                  <div className="w-5 h-5 bg-[#6B4F3F] rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-stone-700">{unreadMessageCount}</p>
              <p className="text-xs text-stone-500">Follow-up</p>
            </button>
          </div>
        </div>

        {/* Connection Requests Section */}
        {connectionRequests.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center mr-3">
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-700">
                    {connectionRequests.length} {connectionRequests.length === 1 ? 'person wants' : 'people want'} to connect
                  </h3>
                  <p className="text-sm text-stone-500">Accept to start a conversation</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {connectionRequests.slice(0, 3).map(request => {
                const user = request.user
                const requestDate = new Date(request.requested_at)
                const daysAgo = Math.floor((Date.now() - requestDate) / (1000 * 60 * 60 * 24))
                const timeAgo = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`

                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-[#FDFBF9] rounded-xl border border-[#E6D5C3]"
                  >
                    <div className="flex items-center">
                      {user.profile_picture ? (
                        <img
                          src={user.profile_picture}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center text-white font-semibold mr-3">
                          {user.name?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-stone-700">{user.name}</h4>
                        <p className="text-sm text-stone-500">{user.career || 'Professional'}</p>
                        {user.city && (
                          <p className="text-xs text-stone-400">{user.city}{user.state ? `, ${user.state}` : ''}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400 mr-2">{timeAgo}</span>
                      <button
                        onClick={() => handleShowInterest(request.id, user.name)}
                        className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center"
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        Accept
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {connectionRequests.length > 3 && (
              <button
                onClick={() => setCurrentView('discover')}
                className="w-full mt-3 text-sm text-[#6B4F3F] hover:text-[#5A4235] font-medium py-2"
              >
                View all {connectionRequests.length} requests &gt;
              </button>
            )}
          </div>
        )}

        {/* Upcoming Events Section */}
        <div className="bg-white rounded-xl p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-700">Upcoming events</h3>
            <button
              onClick={() => setCurrentView('meetupProposals')}
              className="text-sm text-stone-500 hover:text-stone-700 font-medium"
            >
              View all &gt;
            </button>
          </div>

          {loadingMeetups ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-4 border-stone-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-stone-500">Loading events...</p>
            </div>
          ) : upcomingMeetups.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">No upcoming events</p>
              <p className="text-sm text-stone-400 mt-1">Check back soon for new circles!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetups.slice(0, 3).map(meetup => {
                const isSignedUp = userSignups.includes(meetup.id)
                const meetupSignups = signups[meetup.id] || []
                const participantCount = meetupSignups.length

                return (
                  <div
                    key={meetup.id}
                    className="bg-white border border-[#E6D5C3] p-4 hover:border-[#D4A574] transition-colors rounded-xl"
                    style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-stone-700">Circle Meetup</h4>
                        <div className="flex items-center text-stone-500 text-sm mt-1">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(meetup.date)}
                          <Clock className="w-4 h-4 ml-3 mr-1" />
                          {formatTime(meetup.time)}
                        </div>
                        {participantCount > 0 && (
                          <p className="text-xs text-stone-400 mt-1">
                            {participantCount} {participantCount === 1 ? 'person' : 'people'} attending
                          </p>
                        )}
                      </div>

                      {isSignedUp ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="bg-[#F4EEE6] text-[#6B4F3F] text-xs font-medium px-2 py-1 rounded">
                            Signed up
                          </span>
                          <button
                            onClick={() => handleJoinVideoCall(meetup.id)}
                            className="text-sm text-[#6B4F3F] hover:text-[#5A4235] font-medium"
                          >
                            Join &gt;
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSignUp(meetup.id)}
                          className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          Reserve my spot &gt;
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending Recaps Checklist */}
        {pendingRecaps.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-700">Pending recaps</h3>
              <button
                onClick={() => setCurrentView('callHistory')}
                className="text-sm text-stone-500 hover:text-stone-700 font-medium"
              >
                View all recaps &gt;
              </button>
            </div>

            <div className="space-y-3">
              {pendingRecaps.slice(0, 3).map(recap => (
                <div key={recap.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                  <div className="w-5 h-5 border-2 border-stone-400 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-stone-700 font-medium">
                      Review call recap
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {new Date(recap.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentView('callHistory')}
                    className="text-sm text-stone-600 hover:text-stone-800 font-medium"
                  >
                    Open &gt;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const ConnectionsView = () => {
    // Flatten and deduplicate people by user ID
    const meetupPeopleArray = Object.entries(meetupPeople).map(([meetupId, data]) => ({
      meetupId,
      ...data
    }))

    const allPeople = meetupPeopleArray.flatMap(({ people }) => people)
    const uniquePeopleMap = new Map()
    allPeople.forEach(personData => {
      if (!uniquePeopleMap.has(personData.id)) {
        uniquePeopleMap.set(personData.id, personData)
      }
    })
    const uniquePeople = Array.from(uniquePeopleMap.values())

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#F4EEE6] to-[#E8DDD0] rounded-lg p-6 border border-[#D4A574]">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Network</h3>
          <p className="text-sm text-gray-600">Show interest privately - connect when it's mutual!</p>
        </div>

        {currentUser.meetups_attended < 3 && (
          <div className="bg-[#F4EEE6] border border-[#D4A574] rounded-lg p-4">
            <p className="text-sm text-[#5A4235]">
              Complete {3 - currentUser.meetups_attended} more meetups to unlock 1-on-1 video chats
            </p>
          </div>
        )}

        {/* Recommend to Connect Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recommend to Connect ({uniquePeople.length})</h3>
          <div className="space-y-4">
            {uniquePeople.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No recommendations yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Attend more meetups to get connection recommendations!
                </p>
              </div>
            ) : (
              uniquePeople.map(personData => {
                const person = personData.user
                const hasShownInterest = myInterests.includes(personData.id)

                return (
                  <div key={personData.id} className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
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
                        <div className="bg-[#F4EEE6] border border-[#D4A574] rounded px-4 py-2 text-[#6B4F3F] text-sm font-medium text-center">
                          Interest shown - waiting for mutual match
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
              })
            )}
          </div>
        </div>

        {/* My Connections Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">My Connections ({connections.length})</h3>
          <div className="space-y-4">
            {connections.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No connections yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Show interest in people above to match!
                </p>
              </div>
            ) : (
              connections.map(connection => {
                const person = connection.connected_user
                return (
                  <div key={connection.id} className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <h4 className="font-semibold text-gray-800 text-lg">{person.name}</h4>
                          <div className="ml-2 bg-[#F4EEE6] text-[#6B4F3F] text-xs px-2 py-1 rounded-full flex items-center">
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
                        onClick={() => setCurrentView('meetups')}
                        className="w-full bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors flex items-center justify-center"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Schedule Video Chat
                      </button>
                    ) : (
                      <button disabled className="w-full bg-gray-300 text-gray-500 font-medium py-2 rounded cursor-not-allowed">
                        Complete {3 - currentUser.meetups_attended} more meetups to unlock
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  const ProfileView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
        <div className="flex items-center mb-6">
          {currentUser.profile_picture ? (
            <img
              src={currentUser.profile_picture}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-4 border-rose-200"
            />
          ) : (
            <div className="w-20 h-20 bg-rose-200 rounded-full flex items-center justify-center text-3xl text-rose-600 font-bold">
              {(currentUser.name || currentUser.email?.split('@')[0] || 'User').charAt(0)}
            </div>
          )}
          <div className="ml-4">
            <h3 className="text-2xl font-bold text-gray-800">{currentUser.name || currentUser.email?.split('@')[0] || 'User'}</h3>
            <p className="text-gray-600">{currentUser.career} • Age {currentUser.age}</p>
            <p className="text-sm text-gray-500">{currentUser.city}, {currentUser.state}</p>
            {currentUser.role === 'admin' && (
              <span className="inline-block mt-2 bg-[#E8DDD0] text-[#6B4F3F] text-xs px-3 py-1 rounded-full font-medium">
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
              <div className="bg-[#F4EEE6] rounded p-3">
                <div className="text-2xl font-bold text-[#6B4F3F]">{connections.length}</div>
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
            onClick={() => setShowOnboarding(true)}
            className="w-full bg-[#F4EEE6] hover:bg-[#E8DDD0] text-[#6B4F3F] font-medium py-2 rounded transition-colors border border-[#D4A574] flex items-center justify-center"
          >
            <span className="mr-2">&#128218;</span>
            View App Tutorial
          </button>

          {/* Admin Dashboard Link */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setCurrentView('admin')}
              className="w-full bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors flex items-center justify-center"
            >
              <Star className="w-4 h-4 mr-2" />
              Admin Dashboard
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 rounded transition-colors border border-red-200 mt-4"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#F4EEE6] to-[#E8DDD0] rounded-lg p-6 border border-[#D4A574]">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Dashboard</h3>
        <p className="text-sm text-gray-600">Manage meetups and view signups</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setCurrentView('meetupProposals')}
          className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Calendar className="w-5 h-5 mr-2" />
          Review Proposals
        </button>
        <button
          onClick={() => setShowCreateMeetup(true)}
          className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Calendar className="w-5 h-5 mr-2" />
          Create Meetup
        </button>
        <button
          onClick={() => setCurrentView('adminFeedback')}
          className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          View Feedback
        </button>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Manage Meetups</h3>
      </div>

      {meetups.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
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
              <div key={meetup.id} className="bg-white rounded-lg p-5 border border-[#E6D5C3]" style={{ boxShadow: '0 2px 8px rgba(107, 79, 63, 0.08)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center text-gray-800 font-semibold mb-1">
                      <Calendar className="w-5 h-5 mr-2 text-[#6B4F3F]" />
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
                      className="text-[#6B4F3F] hover:text-[#5A4235] text-sm font-medium"
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
                        className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#6B4F3F]"
                        id={'location-' + meetup.id}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('location-' + meetup.id)
                          if (input.value) {
                            handleSetLocation(meetup.id, input.value)
                          }
                        }}
                        className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white px-4 py-2 rounded text-sm transition-colors"
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
    <div className="min-h-screen bg-[#F4EEE6] pb-28">
      {/* Onboarding for new users */}
      {showOnboarding && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          userName={currentUser.name || currentUser.email?.split('@')[0]}
        />
      )}

      {/* Post-action prompts */}
      {nextStepPrompt && (
        <NextStepPrompt
          type={nextStepPrompt.type}
          data={nextStepPrompt.data}
          onAction={(action) => {
            setNextStepPrompt(null)
            setCurrentView(action)
          }}
          onDismiss={() => setNextStepPrompt(null)}
        />
      )}

      {/* Header */}
      <div className="bg-[#6B4F3F] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold flex items-center">
              <svg width="36" height="36" viewBox="0 0 100 100" className="mr-2 md:mr-3 md:w-10 md:h-10">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="220 60"/>
                <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="currentColor">W</text>
              </svg>
              CircleW
            </h1>
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:ring-2 hover:ring-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]"
                style={{
                  backgroundColor: currentUser.profile_picture ? 'transparent' : '#E6D5C3'
                }}
              >
                {currentUser.profile_picture ? (
                  <img
                    src={currentUser.profile_picture}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[#6B4F3F]">
                    {(currentUser.name || currentUser.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-[#E6D5C3] py-1 z-50" style={{ boxShadow: '0 4px 12px rgba(107, 79, 63, 0.12)' }}>
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false)
                        setCurrentView('profile')
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center"
                    >
                      <User className="w-4 h-4 mr-2" />
                      View Profile
                    </button>
                    <hr className="my-1 border-stone-200" />
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false)
                        handleSignOut()
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="bg-[#5A4235] border-t border-[#7D5F4F]">
          <div className="max-w-4xl mx-auto">
            <div className="flex overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setCurrentView('home')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentView === 'home'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Home</span>
              </button>
              <button
                onClick={() => setCurrentView('meetups')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentView === 'meetups'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Meetups</span>
              </button>
              <button
                onClick={() => setCurrentView('discover')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentView === 'discover'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Discover</span>
              </button>
              <button
                onClick={() => setCurrentView('connectionGroups')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentView === 'connectionGroups'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Circles</span>
              </button>
              <button
                onClick={() => setCurrentView('messages')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  currentView === 'messages'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Messages</span>
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#6B4F3F] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadMessageCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCurrentView('callHistory')}
                className={`flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  currentView === 'callHistory'
                    ? 'text-white bg-[#5A4235] border-b-2 border-[#D4A574]'
                    : 'text-[#E8DDD0] hover:text-white hover:bg-[#5A4235]'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Recaps</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {currentView === 'home' && <HomeView />}
        {currentView === 'meetups' && <MeetupsView currentUser={currentUser} connections={connections} supabase={supabase} meetups={meetups} userSignups={userSignups} onNavigate={setCurrentView} />}
        {currentView === 'connectionGroups' && <ConnectionGroupsView currentUser={currentUser} supabase={supabase} connections={connections} onNavigate={setCurrentView} />}
        {currentView === 'connections' && <ConnectionsView />}
        {currentView === 'discover' && <NetworkDiscoverView currentUser={currentUser} supabase={supabase} connections={connections} meetups={meetups} onNavigate={setCurrentView} onHostMeetup={() => setShowCreateMeetup(true)} />}
        {currentView === 'messages' && <MessagesView currentUser={currentUser} supabase={supabase} onUnreadCountChange={loadUnreadMessageCount} />}
        {currentView === 'callHistory' && <CallHistoryView currentUser={currentUser} supabase={supabase} />}
        {currentView === 'meetupProposals' && <MeetupProposalsView currentUser={currentUser} supabase={supabase} isAdmin={currentUser.role === 'admin'} />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'admin' && currentUser.role === 'admin' && <AdminDashboard />}
        {currentView === 'adminFeedback' && currentUser.role === 'admin' && <AdminFeedbackView currentUser={currentUser} supabase={supabase} />}
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full h-[600px] flex flex-col border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
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
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
              <button onClick={() => setShowEditProfile(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Profile Photo Upload */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {editedProfile.profile_picture ? (
                  <img
                    src={editedProfile.profile_picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-rose-200"
                  />
                ) : (
                  <div className="w-24 h-24 bg-rose-200 rounded-full flex items-center justify-center text-3xl text-rose-600 font-bold border-4 border-rose-100">
                    {(editedProfile.name || editedProfile.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors">
                  {uploadingPhoto ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-2">Tap to change photo</p>
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
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Create New Meetup</h3>
              <button onClick={() => setShowCreateMeetup(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* TOPIC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Topic *</label>
                <input
                  type="text"
                  value={newMeetup.topic}
                  onChange={(e) => setNewMeetup({ ...newMeetup, topic: e.target.value })}
                  placeholder="e.g., Product Manager Coffee Chat"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                  maxLength={200}
                  required
                />
              </div>

              {/* DATE & TIME */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => {
                      setSelectedDate(date)
                      if (date) {
                        const year = date.getFullYear()
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const day = String(date.getDate()).padStart(2, '0')
                        setNewMeetup({ ...newMeetup, date: `${year}-${month}-${day}` })
                      } else {
                        setNewMeetup({ ...newMeetup, date: '' })
                      }
                    }}
                    minDate={new Date()}
                    dateFormat="MMM d, yyyy"
                    placeholderText="Select date"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F] cursor-pointer"
                    wrapperClassName="w-full"
                    showPopperArrow={false}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                  <input
                    type="time"
                    value={newMeetup.time}
                    onChange={(e) => setNewMeetup({ ...newMeetup, time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                    required
                  />
                </div>
              </div>

              {/* DURATION & PARTICIPANT LIMIT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration *</label>
                  <select
                    value={newMeetup.duration}
                    onChange={(e) => setNewMeetup({ ...newMeetup, duration: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Participant Limit</label>
                  <input
                    type="number"
                    value={newMeetup.participantLimit}
                    onChange={(e) => setNewMeetup({ ...newMeetup, participantLimit: e.target.value })}
                    placeholder="100"
                    min="2"
                    max="500"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                  />
                </div>
              </div>

              {/* LOCATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location (Optional)</label>
                <input
                  type="text"
                  value={newMeetup.location}
                  onChange={(e) => setNewMeetup({ ...newMeetup, location: e.target.value })}
                  placeholder="e.g., Starbucks on Main St"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                />
                <p className="text-xs text-gray-500 mt-1">You can set the location after seeing who signs up</p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={newMeetup.description}
                  onChange={(e) => setNewMeetup({ ...newMeetup, description: e.target.value })}
                  placeholder="Tell participants what this meetup is about..."
                  className="w-full border border-gray-300 rounded-lg p-3 h-20 resize-none focus:outline-none focus:border-[#6B4F3F]"
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">{newMeetup.description?.length || 0}/1000 characters</p>
              </div>
            </div>

            {/* PREVIEW */}
            {newMeetup.topic && newMeetup.date && (
              <div className="mt-4 bg-[#F4EEE6] border border-[#D4A574] rounded-lg p-3">
                <p className="text-sm text-[#5A4235] font-medium">Preview:</p>
                <p className="text-sm text-[#6B4F3F] font-semibold">{newMeetup.topic}</p>
                <p className="text-sm text-[#6B4F3F]">
                  {formatDate(newMeetup.date)}
                  {newMeetup.time && ` at ${formatTime(newMeetup.time)}`}
                  {` · ${newMeetup.duration} min`}
                  {newMeetup.participantLimit && ` · Max ${newMeetup.participantLimit}`}
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
                disabled={!newMeetup.topic || !newMeetup.date || !newMeetup.time}
                className="flex-1 bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
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
                  selected={editingMeetup.date ? (() => {
                    // Parse date string in LOCAL timezone to avoid day shift
                    const [year, month, day] = editingMeetup.date.split('-').map(Number)
                    return new Date(year, month - 1, day)
                  })() : null}
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
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F] cursor-pointer"
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
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
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
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-[#6B4F3F]"
                />
              </div>
            </div>

            {/* PREVIEW */}
            {editingMeetup.date && (
              <div className="mt-4 bg-[#F4EEE6] border border-[#D4A574] rounded-lg p-3">
                <p className="text-sm text-[#5A4235] font-medium">Preview:</p>
                <p className="text-sm text-[#6B4F3F]">
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
                className="flex-1 bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Update Meetup
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Feedback Button - Floating button for users to submit feedback */}
      <FeedbackButton currentUser={currentUser} pageContext={currentView} />
    </div>
  )
}

// Memoize MainApp to prevent re-renders unless userId actually changes
export default React.memo(MainApp, (prevProps, nextProps) => {
  // Only re-render if user ID changes (ignore function reference changes)
  return prevProps.currentUser?.id === nextProps.currentUser?.id
})
