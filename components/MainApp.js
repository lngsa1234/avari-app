'use client'

import { supabase } from '@/lib/supabase'
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar, Coffee, Users, MapPin, Clock, User, Heart, MessageCircle, Send, X, Video, Compass, Search, Sparkles, ChevronRight, FileText, CheckCircle } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import MeetupsView from './MeetupsView'
import ConnectionGroupsView from './ConnectionGroupsView'
import MeetupProposalsView from './MeetupProposalsView'
import MessagesView from './MessagesView'
import CallHistoryView from './CallHistoryView'
import FeedbackButton from './FeedbackButton'
import AdminFeedbackView from './AdminFeedbackView'
import AdminAnalyticsView from './AdminAnalyticsView'
import Onboarding from './Onboarding'
import JourneyProgress from './JourneyProgress'
import NextStepPrompt from './NextStepPrompt'
import { createAgoraRoom, hasAgoraRoom } from '@/lib/agoraHelpers'
import NetworkDiscoverView from './NetworkDiscoverView'
import AllEventsView from './AllEventsView'
import AllPeopleView from './AllPeopleView'
import AllCirclesView from './AllCirclesView'
import CreateCircleView from './CreateCircleView'
import CircleDetailView from './CircleDetailView'
import MessagesPageView from './MessagesPageView'
import UserProfileView from './UserProfileView'
import ScheduleMeetupView from './ScheduleMeetupView'
import CoffeeChatRecapView from './CoffeeChatRecapView'
import CoffeeChatDetailView from './CoffeeChatDetailView'
import { updateLastActiveThrottled } from '@/lib/activityHelpers'
import { getPendingRequests, acceptCoffeeChat, declineCoffeeChat } from '@/lib/coffeeChatHelpers'
import NudgeBanner from './NudgeBanner'
import { ToastContainer, useToast } from './Toast'
import { parseLocalDate, formatEventTime, isEventPast, isEventLive, eventDateTimeToUTC } from '@/lib/dateUtils'
import LiveFeed from './LiveFeed'

function MainApp({ currentUser, onSignOut }) {
  // DEBUGGING: Track renders vs mounts
  const renderCountRef = useRef(0)
  renderCountRef.current++
  
  const mountTimeRef = useRef(Date.now())
  const componentIdRef = useRef(Math.random().toString(36).substring(7))
  
  // Debug: uncomment to track renders
  // console.log(`🔁 Render #${renderCountRef.current} | Age: ${Date.now() - mountTimeRef.current}ms`)

  const toast = useToast()

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
  const [previousView, setPreviousView] = useState('home')
  const [selectedCircleId, setSelectedCircleId] = useState(null)
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [selectedChatType, setSelectedChatType] = useState(null) // 'user' or 'circle'
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedRecapId, setSelectedRecapId] = useState(null)
  const [selectedMeetupId, setSelectedMeetupId] = useState(null)
  const [selectedMeetupCategory, setSelectedMeetupCategory] = useState(null) // 'coffee', 'circle', or null (community)
  const [showChatModal, setShowChatModal] = useState(false)
  const [selectedChat, setSelectedChat] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [profileRefreshKey, setProfileRefreshKey] = useState(0)
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
  const [homeEventRecs, setHomeEventRecs] = useState([])
  const [homeCircleRecs, setHomeCircleRecs] = useState([])
  const [homePeopleRecs, setHomePeopleRecs] = useState([])
  const [homeRecsLoaded, setHomeRecsLoaded] = useState(false)
  const [myInterests, setMyInterests] = useState([]) // People current user is interested in
  const [meetupPeople, setMeetupPeople] = useState({}) // People grouped by meetup
  const [unreadMessageCount, setUnreadMessageCount] = useState(0) // Unread messages from database
  const [showOnboarding, setShowOnboarding] = useState(false) // Onboarding for new users
  const [groupsCount, setGroupsCount] = useState(0) // Number of groups user is in
  const [coffeeChatsCount, setCoffeeChatsCount] = useState(0) // Number of 1:1 coffee chats completed
  const [upcomingCoffeeChats, setUpcomingCoffeeChats] = useState([]) // Accepted coffee chats for home view
  const [nextStepPrompt, setNextStepPrompt] = useState(null) // { type, data } for post-action prompts
  const [pendingRecaps, setPendingRecaps] = useState([]) // Pending recaps checklist
  const [connectionRequests, setConnectionRequests] = useState([]) // Incoming connection requests
  const [circleJoinRequests, setCircleJoinRequests] = useState([]) // Incoming circle join requests
  const [circleInvitations, setCircleInvitations] = useState([]) // Invitations to join circles (invitee perspective)
  const [coffeeChatRequests, setCoffeeChatRequests] = useState([]) // Incoming coffee chat requests
  const [meetupsInitialView, setMeetupsInitialView] = useState(null) // 'past' when coming from review recaps

  // Home page search
  const [homeSearchQuery, setHomeSearchQuery] = useState('')

  // Schedule meetup context (for pre-filling)
  const [scheduleMeetupContext, setScheduleMeetupContext] = useState({
    type: null,           // 'coffee' or 'circle'
    circleId: null,
    circleName: null,
    connectionId: null,
    connectionName: null
  })

  // Navigation handler that supports passing extra data like circleId, chatId
  const handleNavigate = useCallback((view, data = {}) => {
    console.log('🧭 handleNavigate called:', view, data)
    if (data.circleId) {
      console.log('🔵 Setting circleId:', data.circleId)
      setSelectedCircleId(data.circleId)
    }
    if (data.userId) {
      setSelectedUserId(data.userId)
    }
    if (data.chatId) {
      console.log('💬 Setting chatId:', data.chatId, 'type:', data.chatType)
      setSelectedChatId(data.chatId)
      setSelectedChatType(data.chatType || 'user')
    }
    if (data.recapId) {
      setSelectedRecapId(data.recapId)
      // Mark recap as viewed
      supabase.from('recap_views').upsert({ recap_id: data.recapId, user_id: currentUser.id }, { onConflict: 'recap_id,user_id' }).then(() => {
        setPendingRecaps(prev => prev.filter(r => r.id !== data.recapId))
      })
    }
    if (data.meetupId) {
      setSelectedMeetupId(data.meetupId)
      setSelectedMeetupCategory(data.meetupCategory || null)
    }
    // Handle meetups initial view (e.g., 'past' for review recaps)
    if (view === 'meetups' && data.initialView) {
      setMeetupsInitialView(data.initialView)
    } else if (view === 'meetups') {
      setMeetupsInitialView(null)
    }
    // Handle schedule meetup context
    if (view === 'scheduleMeetup') {
      console.log('📅 Setting scheduleMeetup context:', data)
      setScheduleMeetupContext({
        type: data.meetupType || null,
        circleId: data.scheduleCircleId || null,
        circleName: data.scheduleCircleName || null,
        connectionId: data.scheduleConnectionId || null,
        connectionName: data.scheduleConnectionName || null
      })
    }
    // Lazy-load connections data on first navigate to a view that needs it
    const viewsNeedingConnections = ['meetups', 'connectionGroups', 'discover', 'coffeeChats', 'scheduleMeetup', 'people', 'allPeople', 'profile']
    if (viewsNeedingConnections.includes(view) && !hasLoadedConnectionsRef.current) {
      hasLoadedConnectionsRef.current = true
      lazyLoadConnectionsRef.current?.()
    }
    setCurrentView(prev => {
      setPreviousView(prev)
      return view
    })
  }, [])

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
  const hasLoadedConnectionsRef = useRef(false) // lazy-load connections data on first navigate
  const lazyLoadConnectionsRef = useRef(null) // set after functions are defined

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

  // Handle deep links (e.g. ?event=<id>) — check both URL and localStorage
  // localStorage is used because the query param is lost during OAuth redirect
  useEffect(() => {
    if (!currentUser?.id) return
    const params = new URLSearchParams(window.location.search)
    const eventId = params.get('event') || localStorage.getItem('pendingEventId')
    if (eventId) {
      localStorage.removeItem('pendingEventId')
      handleNavigate('eventDetail', { meetupId: eventId })
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [currentUser?.id, handleNavigate])

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

  // Optimized: load all home page data in 2 round trips instead of 4+ sequential
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

          // Process circle join requests
          const pendingMembers = dMap.pendingMembers || []
          if (pendingMembers.length > 0) {
            const pendingUserIds = [...new Set(pendingMembers.map(m => m.user_id))]
            const { data: pendingProfiles } = await supabase
              .from('profiles')
              .select('id, name, career, city, state, profile_picture')
              .in('id', pendingUserIds)

            const pendingProfileMap = {}
            ;(pendingProfiles || []).forEach(p => { pendingProfileMap[p.id] = p })

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

          // Process signups
          const signupsData = dMap.signups || []
          if (signupsData.length > 0) {
            const signupUserIds = [...new Set(signupsData.map(s => s.user_id))]
            const { data: signupProfiles } = await supabase
              .from('profiles')
              .select('id, name, career, city, state, profile_picture')
              .in('id', signupUserIds)

            const profilesMap = {}
            ;(signupProfiles || []).forEach(p => { profilesMap[p.id] = p })

            const signupsByMeetup = {}
            signupsData.forEach(signup => {
              if (!signupsByMeetup[signup.meetup_id]) signupsByMeetup[signup.meetup_id] = []
              signupsByMeetup[signup.meetup_id].push({ ...signup, profiles: profilesMap[signup.user_id] || null })
            })
            setSignups(signupsByMeetup)
          } else {
            setSignups({})
          }

          // === Load home page recommendation sections ===
          try {
            const [eventRes, circleRes, peopleRes] = await Promise.allSettled([
              supabase
                .from('event_recommendations')
                .select('*')
                .eq('user_id', currentUser.id)
                .in('status', ['pending', 'viewed'])
                .order('match_score', { ascending: false })
                .limit(4),
              supabase
                .from('circle_match_scores')
                .select('*, circle:connection_groups(id, name, is_active, connection_group_members(count))')
                .eq('user_id', currentUser.id)
                .order('match_score', { ascending: false })
                .limit(4),
              supabase
                .from('connection_recommendations')
                .select('*')
                .eq('user_id', currentUser.id)
                .neq('status', 'dismissed')
                .order('match_score', { ascending: false })
                .limit(6),
            ])

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

  // Load data on component mount
  useEffect(() => {
    // CRITICAL: Only run once, ignore React Strict Mode double-render
    if (hasLoadedRef.current) {
      return
    }

    hasLoadedRef.current = true

    // Fast initial load: fetch everything the home page needs in minimal round trips
    // Note: loadHomePageData already fetches unread count, groups count,
    // coffee chats count, attended count, and connection requests —
    // so we do NOT call the standalone versions of those here.
    loadHomePageData()

    // Phase 1 deferred: only data NOT already in loadHomePageData
    loadCoffeeChatRequests()

    // Phase 2 deferred: data needed for other views (connections, discover)
    // These are lazy-loaded when the user navigates to those views.
    // loadConnections, loadMyInterests, loadMeetupPeople, loadPotentialConnections
    // are now called on-demand via handleNavigate instead of eagerly on mount.
    loadPendingRecaps()
  }, []) // Empty array - run once on mount

  // Reload meetups when navigating BACK to home view (not on initial mount)
  const previousViewRef = useRef(currentView)
  useEffect(() => {
    const prevView = previousViewRef.current
    previousViewRef.current = currentView
    // Reload when returning to home or discover from a different view
    // so updated meetup images/data are reflected immediately
    if ((currentView === 'home' || currentView === 'discover') && prevView !== currentView && hasLoadedRef.current) {
      loadHomePageData()
      if (currentView === 'home') loadCoffeeChatRequests()
    }
  }, [currentView])

  // SUBSCRIPTIONS TEMPORARILY DISABLED TO FIX INFINITE RELOAD
  // Re-enable after adding useCallback to all functions

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

  // Load pending coffee chat requests
  const loadCoffeeChatRequests = useCallback(async () => {
    try {
      const requests = await getPendingRequests(supabase)
      setCoffeeChatRequests(requests)
    } catch (err) {
      console.error('Error loading coffee chat requests:', err)
      setCoffeeChatRequests([])
    }
  }, [supabase])

  const notifyEmail = (type, chatId) => {
    fetch('/api/notifications/coffee-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationType: type, chatId }),
    }).catch(err => console.error('[Email] notify failed:', err))
  }

  // Accept a coffee chat request
  const handleAcceptCoffeeChat = useCallback(async (chatId) => {
    try {
      await acceptCoffeeChat(supabase, chatId)
      notifyEmail('accepted', chatId)
      setCoffeeChatRequests(prev => prev.filter(r => r.id !== chatId))
    } catch (err) {
      console.error('Error accepting coffee chat:', err)
    }
  }, [supabase])

  // Decline a coffee chat request
  const handleDeclineCoffeeChat = useCallback(async (chatId) => {
    try {
      await declineCoffeeChat(supabase, chatId)
      notifyEmail('declined', chatId)
      setCoffeeChatRequests(prev => prev.filter(r => r.id !== chatId))
    } catch (err) {
      console.error('Error declining coffee chat:', err)
    }
  }, [supabase])

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
      // Uses created_by or participant_ids array (correct column names)
      const { data, error } = await supabase
        .from('call_recaps')
        .select('id', { count: 'exact' })
        .eq('call_type', '1on1')
        .or(`created_by.eq.${currentUser.id},participant_ids.cs.{${currentUser.id}}`)

      if (error) {
        // Table might not exist or has different schema, that's okay
        if (!error.message?.includes('does not exist')) {
          console.log('Coffee chats count not available:', error.message)
        }
        setCoffeeChatsCount(0)
        return
      }
      setCoffeeChatsCount(data?.length || 0)
    } catch (err) {
      console.error('Error loading coffee chats count:', err)
      setCoffeeChatsCount(0)
    }
  }, [currentUser.id, supabase])

  // Load upcoming accepted coffee chats for home view
  const loadUpcomingCoffeeChats = useCallback(async () => {
    try {
      // Query coffee_chats directly for pending/accepted/scheduled chats involving current user
      const { data: chats, error } = await supabase
        .from('coffee_chats')
        .select('*')
        .in('status', ['pending', 'accepted', 'scheduled'])
        .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('scheduled_time', { ascending: true })

      if (error) {
        console.error('Error loading coffee chats:', error)
        setUpcomingCoffeeChats([])
        return
      }

      if (!chats || chats.length === 0) {
        setUpcomingCoffeeChats([])
        return
      }

      // Fetch profiles for the other person in each chat
      const otherIds = [...new Set(chats.map(c =>
        c.requester_id === currentUser.id ? c.recipient_id : c.requester_id
      ).filter(Boolean))]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', otherIds)

      const profileMap = {}
      ;(profiles || []).forEach(p => { profileMap[p.id] = p })

      const now = new Date()
      const gracePeriod = new Date(now.getTime() - 4 * 60 * 60 * 1000)
      const upcoming = chats.filter(chat => {
        if (!chat.scheduled_time) return true // Pending chats without a time are still active
        return new Date(chat.scheduled_time) > gracePeriod
      }).map(chat => {
        const otherId = chat.requester_id === currentUser.id ? chat.recipient_id : chat.requester_id
        return { ...chat, _otherPerson: profileMap[otherId] || null }
      })

      setUpcomingCoffeeChats(upcoming)
    } catch (err) {
      console.error('☕ Error loading upcoming coffee chats:', err)
      setUpcomingCoffeeChats([])
    }
  }, [supabase, currentUser.id])

  // Load pending recaps for the checklist
  const loadPendingRecaps = useCallback(async () => {
    try {
      // Uses created_by or participant_ids array (correct column names)
      // Only consider recaps from the last 30 days as potentially pending
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const [{ data, error }, { data: viewedData }] = await Promise.all([
        supabase
          .from('call_recaps')
          .select('*')
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
      // STEP 1: Get existing connections to exclude them
      const { data: existingConnections, error: connectionsError } = await supabase
        .rpc('get_mutual_matches', { for_user_id: currentUser.id })

      if (connectionsError) {
        console.error('⚠️ Error loading connections for filtering:', connectionsError)
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
        console.error('❌ Error loading profiles:', profilesError)
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

  // Wire up lazy-load ref for handleNavigate (defined before these functions)
  lazyLoadConnectionsRef.current = () => {
    loadConnections()
    loadMyInterests()
    loadMeetupPeople()
    loadPotentialConnections()
  }

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

  // Show events that haven't ended yet, with 30-min grace for meetings running over
  const upcomingMeetups = (() => {
    const filteredMeetups = meetups.filter(m =>
      !isEventPast(m.date, m.time, m.timezone, parseInt(m.duration || '60'), 30)
    )
    // Merge upcoming coffee chats as pseudo-meetup objects (filter out past ones)
    const now = new Date()
    const coffeeMeetups = upcomingCoffeeChats.filter(chat => {
      if (chat.status === 'completed' || chat.status === 'cancelled' || chat.status === 'declined') return false
      if (!chat.scheduled_time) return true // No time = show it (pending/accepted)
      // Coffee chats last ~30 min, add 30 min grace
      return new Date(chat.scheduled_time).getTime() + 60 * 60 * 1000 > now.getTime()
    }).map(chat => {
      const otherPerson = chat._otherPerson
      const scheduledDate = chat.scheduled_time ? new Date(chat.scheduled_time) : new Date()
      const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`
      const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`
      return {
        id: chat.id,
        topic: `Coffee chat with ${otherPerson?.name || 'Someone'}`,
        date: dateStr,
        time: timeStr,
        duration: '30',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        host: otherPerson ? { id: otherPerson.id, name: otherPerson.name, profile_picture: otherPerson.profile_picture } : null,
        created_by: chat.requester_id,
        _isCoffeeChat: true,
        _coffeeChatData: chat,
      }
    })
    return [...filteredMeetups, ...coffeeMeetups].sort((a, b) => {
      const aDate = new Date(`${a.date}T${a.time || '00:00'}`)
      const bDate = new Date(`${b.date}T${b.time || '00:00'}`)
      return aDate - bDate
    })
  })()

  // Home page search results
  const homeSearchResults = React.useMemo(() => {
    const q = homeSearchQuery.toLowerCase().trim()
    if (!q) return null

    const matchedMeetups = upcomingMeetups.slice(0, 50).filter(m =>
      (m.topic || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.host?.name || '').toLowerCase().includes(q) ||
      (m.connection_groups?.name || '').toLowerCase().includes(q)
    ).slice(0, 4)

    const matchedPeople = connections.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.career || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    ).slice(0, 4)

    const circleMap = {}
    meetups.forEach(m => {
      if (m.connection_groups?.id && m.connection_groups?.name) {
        circleMap[m.connection_groups.id] = m.connection_groups
      }
    })
    const matchedCircles = Object.values(circleMap).filter(c =>
      c.name.toLowerCase().includes(q)
    ).slice(0, 4)

    const total = matchedMeetups.length + matchedPeople.length + matchedCircles.length
    return { meetups: matchedMeetups, people: matchedPeople, circles: matchedCircles, total }
  }, [homeSearchQuery, upcomingMeetups, connections, meetups])

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
          toast.info('You have already signed up for this meetup')
        } else {
          toast.error('Error signing up: ' + error.message)
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
      toast.error('Error: ' + err.message)
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
        toast.error('Error canceling signup: ' + error.message)
      } else {
        await loadUserSignups()
        await loadMeetupsFromDatabase()
        toast.success('Signup canceled')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleCreateMeetup = async () => {
    if (!newMeetup.date || !newMeetup.time || !newMeetup.topic) {
      toast.error('Please fill in topic, date and time')
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
        toast.error('Error creating meetup: ' + error.message)
      } else {
        // Auto-RSVP the creator
        if (data && data[0]?.id) {
          await supabase
            .from('meetup_signups')
            .insert({ meetup_id: data[0].id, user_id: currentUser.id })
        }
        // Reload meetups from database to ensure consistency
        await loadMeetupsFromDatabase()
        await loadUserSignups()
        setNewMeetup({ date: '', time: '', location: '', topic: '', duration: '60', participantLimit: '100', description: '' })
        setSelectedDate(null)
        setShowCreateMeetup(false)
        toast.success('Meetup created!')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEditMeetup = (meetup) => {
    setEditingMeetup({ ...meetup })
    setShowEditMeetup(true)
  }

  const handleUpdateMeetup = async () => {
    if (!editingMeetup.date || !editingMeetup.time) {
      toast.error('Please fill in date and time')
      return
    }

    try {
      const updateData = {
        date: editingMeetup.date,
        time: editingMeetup.time,
        location: editingMeetup.location || null,
        updated_at: new Date().toISOString()
      };
      // If rescheduling a completed meetup, reset status to scheduled
      if (editingMeetup.status === 'completed') {
        updateData.status = 'scheduled';
      }
      const { error } = await supabase
        .from('meetups')
        .update(updateData)
        .eq('id', editingMeetup.id)

      if (error) {
        toast.error('Error updating meetup: ' + error.message)
      } else {
        // Reload meetups to get updated data
        await loadMeetupsFromDatabase()
        setShowEditMeetup(false)
        setEditingMeetup(null)
        toast.success('Meetup updated!')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleDeleteMeetup = async (meetupId) => {
    if (!confirm('Are you sure you want to cancel this meetup?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('meetups')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', meetupId)

      if (error) {
        toast.error('Error cancelling meetup: ' + error.message)
      } else {
        // Reload meetups from database
        await loadMeetupsFromDatabase()
        toast.success('Meetup cancelled')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleSetLocation = async (meetupId, location) => {
    if (!location.trim()) {
      toast.error('Please enter a location')
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
        toast.error('Error setting location: ' + error.message)
      } else {
        // Reload meetups from database
        await loadMeetupsFromDatabase()
        toast.success('Location set!')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  // Handle profile photo upload
  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
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
      toast.error('Failed to upload photo: ' + err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const [profileErrors, setProfileErrors] = useState({})
  const [detectingLocation, setDetectingLocation] = useState(false)

  const detectLocation = useCallback(async () => {
    setDetectingLocation(true)
    try {
      // Use browser timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setEditedProfile(prev => ({ ...prev, timezone }))

      // Try geolocation → reverse geocode
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        )
        const { latitude, longitude } = pos.coords
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`
        )
        const data = await res.json()
        const addr = data.address || {}
        const city = addr.city || addr.town || addr.village || addr.suburb || ''
        const state = addr.state ? (addr['ISO3166-2-lvl4']?.split('-')[1] || addr.state).slice(0, 2).toUpperCase() : ''
        const country = addr.country || ''
        setEditedProfile(prev => ({
          ...prev,
          city: city || prev.city,
          state: state || prev.state,
          country: country || prev.country,
          timezone,
        }))
      }
    } catch (e) {
      console.log('Location detection failed:', e.message)
      // Still set timezone even if geolocation fails
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setEditedProfile(prev => ({ ...prev, timezone }))
    } finally {
      setDetectingLocation(false)
    }
  }, [])

  const handleSaveProfile = async () => {
    const errors = {}
    if (!editedProfile.name?.trim()) errors.name = true
    if (!editedProfile.career?.trim()) errors.career = true
    if (!editedProfile.city?.trim()) errors.city = true
    if (!editedProfile.state?.trim()) errors.state = true
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editedProfile.name,
          career: editedProfile.career,
          industry: editedProfile.industry || null,
          vibe_category: editedProfile.vibe_category || null,
          career_stage: editedProfile.career_stage || null,
          hook: editedProfile.hook || null,
          bio: editedProfile.hook || null,
          open_to_hosting: editedProfile.open_to_hosting || false,
          open_to_coffee_chat: editedProfile.open_to_coffee_chat || false,
          coffee_chat_slots: editedProfile.coffee_chat_slots || null,
          age: editedProfile.age ? parseInt(editedProfile.age) : null,
          city: editedProfile.city,
          state: editedProfile.state.toUpperCase(),
          country: editedProfile.country || null,
          timezone: editedProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          profile_picture: editedProfile.profile_picture || null
        })
        .eq('id', currentUser.id)

      if (error) {
        toast.error('Error updating profile: ' + error.message)
      } else {
        // Update local state and trigger profile view refresh
        Object.assign(currentUser, editedProfile)
        setShowEditProfile(false)
        setProfileRefreshKey(k => k + 1)
        toast.success('Profile updated!')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
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
          toast.info('You already showed interest in this person')
        } else {
          console.error('Error inserting interest:', error)
          toast.error('Error: ' + error.message)
        }
        return
      }

      console.log('✅ Interest inserted successfully')
      
      // Check if this creates a mutual match
      const { data: mutualCheck, error: mutualError } = await supabase
        .rpc('check_mutual_interest', {
          user_a: currentUser.id,
          user_b: userId
        })

      if (mutualError) {
        console.error('Error checking mutual interest:', mutualError)
        console.log('⚠️ Mutual check failed, but interest was recorded')
      } else {
        console.log('🔍 Mutual check result:', mutualCheck)
        
        if (mutualCheck) {
          toast.success(`It's a match! You and ${userName} are now connected!`)
        } else {
          toast.success(`Interest shown in ${userName}`)
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
      toast.error('Error: ' + err.message)
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
        toast.error('Error: ' + error.message)
      } else {
        toast.info('Interest removed')
        loadMyInterests()
        loadMeetupPeople()
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleJoinVideoCall = async (meetup) => {
    try {
      const meetupId = typeof meetup === 'object' ? meetup.id : meetup;
      const circleId = typeof meetup === 'object' ? meetup.circle_id : null;
      const isCoffeeChat = typeof meetup === 'object' && meetup._isCoffeeChat;

      console.log('📹 Creating/joining video call for meetup:', meetupId, 'circleId:', circleId, 'isCoffeeChat:', isCoffeeChat);

      // If this is a 1:1 coffee chat, route to WebRTC peer-to-peer call
      if (isCoffeeChat) {
        window.location.href = `/call/coffee/${meetupId}`;
        return;
      }

      // If this is a circle meetup, route to circle call (Agora) with meetup ID for session isolation
      if (circleId) {
        const channelName = `connection-group-${meetupId}`;
        window.location.href = `/call/circle/${channelName}`;
        return;
      }

      // Regular meetup - use LiveKit via /call/meetup/
      // Check Agora App ID is configured (for room creation)
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        toast.error('Video not configured. Please add NEXT_PUBLIC_AGORA_APP_ID to .env.local and restart.');
        return;
      }

      // Check if room already exists
      const exists = await hasAgoraRoom(meetupId);

      if (!exists) {
        // Create new room
        console.log('🎥 Creating new video room...');
        const { channelName, link } = await createAgoraRoom(meetupId);
        console.log('✅ Video room created:', link);
      } else {
        console.log('✅ Video room already exists');
      }

      // Navigate to the video call
      const channelName = `meetup-${meetupId}`;
      window.location.href = `/call/meetup/${channelName}`;
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

      toast.error(errorMsg);
    }
  }

  const openEditProfile = () => {
    setProfileErrors({})
    const profile = { ...currentUser }
    setEditedProfile(profile)
    setShowEditProfile(true)
    // Auto-detect location if city is empty
    if (!profile.city?.trim()) {
      // Slight delay so the modal renders first
      setTimeout(() => detectLocation(), 300)
    }
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
    // Responsive hook for mobile layout — SSR-safe initializer avoids flash
    const [isMobile, setIsMobile] = useState(() => {
      if (typeof window !== 'undefined') return window.innerWidth < 860
      return false
    })
    useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 860)
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }, [])



    // Get time-based greeting
    const { greeting, emoji } = getTimeBasedGreeting()
    const firstName = (currentUser.name || currentUser.email?.split('@')[0] || 'User').split(' ')[0]

    // Check for meetings within 60 minutes
    const nextMeeting = getNextUpcomingMeeting(meetups, userSignups)
    const upcomingMeetingCount = getUpcomingMeetingCount(meetups, userSignups)

    // Calculate weekly progress (meetups attended this week)
    const getWeeklyProgress = () => {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
      startOfWeek.setHours(0, 0, 0, 0)

      const weeklyMeetups = userSignups.filter(signupId => {
        const meetup = meetups.find(m => m.id === signupId)
        if (!meetup) return false
        try {
          const meetupDate = parseLocalDate(meetup.date)
          return meetupDate >= startOfWeek && meetupDate <= now
        } catch {
          return false
        }
      })

      const goal = 2
      const attended = weeklyMeetups.length
      const percentage = Math.min(Math.round((attended / goal) * 100), 100)
      return { attended, goal, percentage }
    }
    const weeklyProgress = getWeeklyProgress()

    // Shared section header style
    const sectionHeaderStyle = {
      fontFamily: '"Lora", serif',
      fontSize: isMobile ? '18px' : '20px',
      fontWeight: '600',
      color: '#3F1906',
      margin: '0 0 12px 0',
      letterSpacing: '0.15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }

    // Event Date Badge Component — timezone-aware
    const EventDateBadge = ({ date, time, timezone }) => {
      const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      let parsedDate
      try {
        if (timezone && time) {
          // Convert to viewer's local date (handles cross-timezone date shifts)
          const utc = eventDateTimeToUTC(date, time, timezone)
          // Extract date parts in viewer's timezone
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc)
          const y = parseInt(parts.find(p => p.type === 'year').value)
          const m = parseInt(parts.find(p => p.type === 'month').value)
          const d = parseInt(parts.find(p => p.type === 'day').value)
          parsedDate = new Date(y, m - 1, d)
        } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = date.split('-').map(Number)
          parsedDate = new Date(year, month - 1, day)
        } else {
          const cleanDateStr = date.replace(/^[A-Za-z]+,\s*/, '')
          parsedDate = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
        }
      } catch {
        parsedDate = new Date()
      }

      const month = parsedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
      const day = parsedDate.getDate()

      // Determine relative day label
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const eventDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate())
      const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24))

      let dayLabel
      let isHighlight = false
      if (diffDays === 0) {
        dayLabel = 'TODAY'
        isHighlight = true
      } else if (diffDays === 1) {
        dayLabel = 'TOMOR'
        isHighlight = true
      } else {
        const weekday = parsedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
        dayLabel = weekday
      }

      return (
        <div style={{
          minWidth: isMobile ? '56px' : '72px',
          padding: isMobile ? '10px 6px' : '18px 8px',
          backgroundColor: isHighlight ? 'rgba(168, 132, 98, 0.75)' : 'rgba(189, 173, 162, 0.65)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: '"Lora", serif',
            fontSize: isMobile ? '9px' : '11px',
            fontWeight: '600',
            color: isHighlight ? '#FFF' : '#605045',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>{dayLabel}</span>
          <span style={{
            fontFamily: '"Lora", serif',
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: '500',
            color: isHighlight ? '#FFF' : '#605045',
            lineHeight: isMobile ? '26px' : '33px',
            letterSpacing: '0.15px',
          }}>{day}</span>
          <span style={{
            fontFamily: '"Lora", serif',
            fontSize: isMobile ? '10px' : '12px',
            fontWeight: '500',
            color: isHighlight ? 'rgba(255,255,255,0.8)' : '#9B8A7E',
            marginTop: '2px',
          }}>{month}</span>
        </div>
      )
    }

    // Attendee Avatars Component
    const AttendeeAvatars = ({ meetupId }) => {
      const meetupSignups = signups[meetupId] || []
      const displayCount = Math.min(meetupSignups.length, 3)
      const colors = ['#9C8068', '#C9A96E', '#8B9E7E']

      if (meetupSignups.length === 0) return null

      return (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
          {meetupSignups.slice(0, 3).map((signup, idx) => (
            <div
              key={signup.user_id || idx}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: '2px solid white',
                marginLeft: idx === 0 ? 0 : '-6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: '600',
                color: 'white',
                background: colors[idx % 3],
              }}
            >
              {signup.profiles?.name?.[0] || '?'}
            </div>
          ))}
          <span style={{ fontSize: '11px', color: '#B8A089', marginLeft: '8px' }}>
            {meetupSignups.length} attending
          </span>
        </div>
      )
    }

    const homeStyles = {
      container: {
        fontFamily: '"Lora", serif',
        position: 'relative',
        padding: isMobile ? '16px 0' : '24px 0',
        maxWidth: '880px',
        margin: '0 auto',
      },
      titleSection: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        marginBottom: isMobile ? '20px' : '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(139, 111, 92, 0.1)',
        flexWrap: 'wrap',
        gap: '16px',
      },
      pageTitle: {
        fontFamily: '"Lora", serif',
        fontSize: isMobile ? '24px' : '32px',
        fontWeight: '500',
        color: '#584233',
        letterSpacing: '0.15px',
        margin: 0,
        lineHeight: 1.28,
      },
      tagline: {
        fontFamily: '"Lora", serif',
        fontSize: isMobile ? '14px' : '15px',
        fontWeight: '500',
        margin: 0,
        marginTop: '6px',
        background: 'linear-gradient(89.8deg, #7E654D 27.14%, #B9A594 72.64%, #ECDDD2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      },
      contentGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '16px' : '20px',
      },
      card: {
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(255, 255, 255, 0.013) 100%)',
        borderRadius: '19px',
        padding: isMobile ? '16px 0' : '24px 0',
        border: 'none',
        marginBottom: isMobile ? '16px' : '20px',
        backdropFilter: 'blur(2px)',
      },
      cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '10px',
      },
      cardTitle: {
        fontFamily: '"Lora", serif',
        fontSize: isMobile ? '20px' : '24px',
        fontWeight: '500',
        color: '#3F1906',
        margin: 0,
        letterSpacing: '0.15px',
      },
      seeAllBtn: {
        fontFamily: '"Lora", serif',
        fontSize: isMobile ? '13px' : '15px',
        color: 'rgba(107, 86, 71, 0.77)',
        fontWeight: '500',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        letterSpacing: '0.15px',
        transition: 'color 0.2s ease',
        minHeight: '44px',
        padding: '8px 4px',
      },
      quickAction: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
      },
      suggestion: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
      },
    }

    return (
      <div style={homeStyles.container}>
        {/* Title Section */}
        <section style={homeStyles.titleSection}>
          <div>
            <h1 style={homeStyles.pageTitle}>{greeting}, {firstName}</h1>
            <p style={homeStyles.tagline}>
              {upcomingMeetingCount > 0
                ? `You have ${upcomingMeetingCount} circle${upcomingMeetingCount > 1 ? 's' : ''} starting soon`
                : connections.length > 0
                  ? `${connections.length} connection${connections.length > 1 ? 's' : ''} in your network`
                  : 'Your community awaits'}
            </p>
          </div>
        </section>

        {/* AI Agent: Personalized Nudge */}
        <NudgeBanner className="mb-5" />

        {/* Starting Soon label */}
        {nextMeeting && (
          <h2 style={{
            fontFamily: '"Lora", serif',
            fontSize: isMobile ? '22px' : '28px',
            fontWeight: '500',
            color: '#3F1906',
            letterSpacing: '0.15px',
            lineHeight: isMobile ? '26px' : '32px',
            margin: '0 0 16px 0',
          }}>Starting Soon</h2>
        )}

        {/* Hero "Next Step" Card - Only shows if meeting within 60 min */}
        {nextMeeting && (
          <div style={{
            borderRadius: '23px',
            padding: isMobile ? '20px' : '24px',
            marginBottom: isMobile ? '16px' : '20px',
            background: 'rgba(215, 197, 184, 0.2)',
            boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
              <svg width="35" height="35" viewBox="0 0 24 24" fill="#584233" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM12 13l2.12 1.27-.56-2.41 1.88-1.63-2.47-.21L12 7.82l-1.03 2.2-2.47.21 1.88 1.63-.56 2.41z"/>
              </svg>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontFamily: '"Lora", serif',
                  fontSize: isMobile ? '18px' : '24px',
                  fontWeight: '500',
                  color: '#3F1906',
                  margin: 0,
                  letterSpacing: '0.15px',
                  lineHeight: isMobile ? '24px' : '22px',
                  marginBottom: '8px',
                }}>
                  {nextMeeting.title || nextMeeting.topic || 'Meetup'} starts in {nextMeeting.minutesUntil}m
                </h3>
                <p style={{
                  fontFamily: '"Lora", serif',
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: '500',
                  color: '#584233',
                  margin: 0,
                  letterSpacing: '0.15px',
                }}>
                  Time to connect with your group
                </p>
              </div>
            </div>

            <button
              onClick={() => handleJoinVideoCall(nextMeeting)}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(88.65deg, rgba(134, 112, 96, 0.63) 56.79%, rgba(197, 172, 150, 0.63) 98.85%)',
                border: 'none',
                borderRadius: '18px',
                color: '#F5EDE9',
                fontFamily: '"Lora", serif',
                fontStyle: 'italic',
                fontSize: isMobile ? '16px' : '20px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                letterSpacing: '0.15px',
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <Video style={{ width: '20px', height: '20px' }} />
              Join Room
            </button>
          </div>
        )}

        {/* Main Content */}
        <div style={homeStyles.contentGrid}>
          {/* Connection & Circle Join Requests Section */}
            {(connectionRequests.length > 0 || coffeeChatRequests.length > 0 || circleInvitations.length > 0 || circleJoinRequests.length > 0) && (() => {
              const allRequests = [
                ...connectionRequests.map(r => ({ ...r, type: r.type || 'connection_request' })),
                ...circleJoinRequests,
                ...circleInvitations,
                ...coffeeChatRequests.map(r => ({ ...r, type: 'coffee_chat_request' })),
              ].sort((a, b) => new Date(b.requested_at || b.created_at || 0) - new Date(a.requested_at || a.created_at || 0))

              return (
              <div style={homeStyles.card}>
                <h3 style={{
                  fontFamily: '"Lora", serif',
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '500',
                  color: '#3F1906',
                  margin: '0 0 16px 0',
                  letterSpacing: '0.15px',
                  opacity: 0.73,
                }}>
                  Requests waiting for you
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allRequests.slice(0, 5).map(request => {
                    const isCircleJoin = request.type === 'circle_join_request'
                    const isCircleInvitation = request.type === 'circle_invitation'
                    const isCoffeeChatRequest = request.type === 'coffee_chat_request'
                    const user = isCoffeeChatRequest ? (request.requester || {}) : (request.user || request)
                    const rawDate = request.requested_at || request.created_at
                    const requestDate = rawDate ? new Date(rawDate) : null
                    const daysAgo = requestDate ? Math.floor((Date.now() - requestDate) / (1000 * 60 * 60 * 24)) : null
                    const timeAgo = daysAgo === null ? 'new' : daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`

                    return (
                      <div
                        key={`${request.type}-${request.id}`}
                        style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'center',
                          justifyContent: 'space-between',
                          padding: isMobile ? '12px' : '16px',
                          backgroundColor: '#FAF5EF',
                          borderRadius: '12px',
                          border: '1px solid rgba(184, 160, 137, 0.1)',
                          gap: isMobile ? '10px' : '0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {user.profile_picture ? (
                            <img
                              src={user.profile_picture}
                              alt={user.name}
                              style={{ width: isMobile ? '40px' : '48px', height: isMobile ? '40px' : '48px', borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }}
                            />
                          ) : (
                            <div style={{
                              width: isMobile ? '40px' : '64px', height: isMobile ? '40px' : '64px', borderRadius: '50%',
                              background: 'linear-gradient(180deg, rgba(158, 120, 104, 0.2) 0%, rgba(241, 225, 213, 0.2) 100%)',
                              boxShadow: '0px 1px 4px #9E7868',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: '"Lora", serif', fontSize: isMobile ? '15px' : '24px', fontWeight: '700', color: '#523C2E',
                              marginRight: '10px', flexShrink: 0,
                            }}>
                              {(user.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '20px' }}>{user.name}</h4>
                            {isCoffeeChatRequest ? (
                              <>
                                <p style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
                                  wants a coffee chat {request.scheduled_time && <>· {new Date(request.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(request.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>}
                                </p>
                                {user.career && (
                                  <p style={{ fontSize: '11px', color: '#B8A089', margin: 0 }}>{user.career}</p>
                                )}
                                {request.notes && (
                                  <p style={{ fontSize: '11px', color: '#B8A089', margin: '2px 0 0 0', fontStyle: 'italic' }}>"{request.notes}"</p>
                                )}
                              </>
                            ) : isCircleJoin ? (
                              <p style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
                                wants to join <strong>{request.circleName}</strong>
                              </p>
                            ) : isCircleInvitation ? (
                              <p style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
                                invited you to <strong>{request.circleName}</strong>
                              </p>
                            ) : (
                              <p style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>{user.career || 'Professional'}</p>
                            )}
                            {!isCircleJoin && !isCircleInvitation && !isCoffeeChatRequest && user.city && (
                              <p style={{ fontSize: '11px', color: '#B8A089', margin: 0 }}>{user.city}{user.state ? `, ${user.state}` : ''}</p>
                            )}
                            {(isCircleJoin || isCircleInvitation) && user.career && (
                              <p style={{ fontSize: '11px', color: '#B8A089', margin: 0 }}>{user.career}</p>
                            )}
                          </div>
                          {!isMobile && (
                            <span style={{ fontFamily: '"Lora", serif', fontSize: '14px', fontWeight: '600', color: 'rgba(107, 86, 71, 0.77)', letterSpacing: '0.15px', marginLeft: '8px', flexShrink: 0 }}>· {timeAgo === 'Today' ? 'new' : timeAgo}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: '12px' }}>
                          {isMobile && (
                            <span style={{ fontFamily: '"Lora", serif', fontSize: '12px', fontWeight: '600', color: 'rgba(107, 86, 71, 0.77)', letterSpacing: '0.15px' }}>· {timeAgo === 'Today' ? 'new' : timeAgo}</span>
                          )}
                          {isCoffeeChatRequest ? (
                            <>
                              <button
                                onClick={() => handleDeclineCoffeeChat(request.id)}
                                style={{
                                  padding: isMobile ? '7px 14px' : '9px 18px',
                                  background: 'transparent',
                                  border: '1px solid rgba(184, 160, 137, 0.4)',
                                  borderRadius: '18px',
                                  color: '#6B5647',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleAcceptCoffeeChat(request.id)}
                                style={{
                                  padding: isMobile ? '7px 16px' : '9px 20px',
                                  background: 'rgba(103, 77, 59, 0.9)',
                                  border: 'none',
                                  borderRadius: '18px',
                                  color: '#F5EDE9',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                <Coffee style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px' }} />
                                Accept
                              </button>
                            </>
                          ) : isCircleJoin ? (
                            <>
                              <button
                                onClick={() => handleDeclineCircleJoin(request.id)}
                                style={{
                                  padding: isMobile ? '7px 14px' : '9px 18px',
                                  background: 'transparent',
                                  border: '1px solid rgba(184, 160, 137, 0.4)',
                                  borderRadius: '18px',
                                  color: '#6B5647',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleAcceptCircleJoin(request.id)}
                                style={{
                                  padding: isMobile ? '7px 16px' : '9px 20px',
                                  background: 'rgba(103, 77, 59, 0.9)',
                                  border: 'none',
                                  borderRadius: '18px',
                                  color: '#F5EDE9',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                <Users style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px' }} />
                                Approve
                              </button>
                            </>
                          ) : isCircleInvitation ? (
                            <>
                              <button
                                onClick={() => handleDeclineCircleInvitation(request.id)}
                                style={{
                                  padding: isMobile ? '7px 14px' : '9px 18px',
                                  background: 'transparent',
                                  border: '1px solid rgba(184, 160, 137, 0.4)',
                                  borderRadius: '18px',
                                  color: '#6B5647',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleAcceptCircleInvitation(request.id)}
                                style={{
                                  padding: isMobile ? '7px 16px' : '9px 20px',
                                  background: 'rgba(103, 77, 59, 0.9)',
                                  border: 'none',
                                  borderRadius: '18px',
                                  color: '#F5EDE9',
                                  fontFamily: '"Lora", serif',
                                  fontStyle: 'italic',
                                  fontSize: isMobile ? '13px' : '15px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  letterSpacing: '0.15px',
                                }}
                              >
                                <Users style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px' }} />
                                Join
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleNavigate('userProfile', { userId: request.id })}
                              style={{
                                padding: isMobile ? '7px 16px' : '9px 20px',
                                background: 'rgba(103, 77, 59, 0.9)',
                                border: 'none',
                                borderRadius: '18px',
                                color: '#F5EDE9',
                                fontFamily: '"Lora", serif',
                                fontStyle: 'italic',
                                fontSize: isMobile ? '13px' : '15px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                letterSpacing: '0.15px',
                              }}
                            >
                              <Heart style={{ width: isMobile ? '12px' : '14px', height: isMobile ? '12px' : '14px' }} />
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {allRequests.length > 5 && (
                  <button
                    onClick={() => setCurrentView('discover')}
                    style={{ ...homeStyles.seeAllBtn, width: '100%', marginTop: '12px', textAlign: 'center', justifyContent: 'center' }}
                  >
                    View all {allRequests.length} requests →
                  </button>
                )}
              </div>
              )
            })()}

            {/* Upcoming Events Section with Date Badges */}
            <div style={homeStyles.card}>
              <div style={homeStyles.cardHeader}>
                <h3 style={homeStyles.cardTitle}>Upcoming Meetups</h3>
                <button
                  onClick={() => setCurrentView('meetups')}
                  style={homeStyles.seeAllBtn}
                >
                  View all <ChevronRight style={{ width: '14px', height: '14px' }} />
                </button>
              </div>

              {loadingMeetups ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139, 111, 92, 0.2)', borderTopColor: '#7A5C42', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                  <p style={{ color: '#9C8068', fontSize: '14px' }}>Loading events...</p>
                </div>
              ) : upcomingMeetups.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <Calendar style={{ width: '48px', height: '48px', color: '#D4C4B0', margin: '0 auto 12px' }} />
                  <p style={{ color: '#7A5C42', fontSize: '15px', margin: 0 }}>No upcoming events</p>
                  <p style={{ color: '#B8A089', fontSize: '13px', marginTop: '4px' }}>Check back soon for new events!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '4px' }}>
                  {upcomingMeetups.slice(0, 3).map((meetup, idx) => {
                    const isSignedUp = meetup._isCoffeeChat || userSignups.includes(meetup.id) || meetup.created_by === currentUser.id
                    // Build signups list — for coffee chats, use the two participants
                    let meetupSignups
                    if (meetup._isCoffeeChat) {
                      const chatData = meetup._coffeeChatData
                      const partner = meetup.host
                      meetupSignups = [
                        { user_id: currentUser.id, profiles: { name: currentUser.name, profile_picture: currentUser.profile_picture } },
                        ...(partner ? [{ user_id: partner.id, profiles: partner }] : []),
                      ]
                    } else {
                      const rawSignups = signups[meetup.id] || []
                      const hostIncluded = meetup.host && !rawSignups.some(s => s.user_id === meetup.host.id)
                      meetupSignups = hostIncluded
                        ? [{ user_id: meetup.host.id, profiles: meetup.host }, ...rawSignups]
                        : rawSignups
                    }

                    // Determine if event is currently live (started but not ended)
                    const isLive = isEventLive(meetup.date, meetup.time, meetup.timezone, parseInt(meetup.duration || '60'))

                    // Parse date for mobile card — timezone-aware
                    let cardParsedDate
                    try {
                      const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
                      if (meetup.timezone && meetup.time) {
                        const utc = eventDateTimeToUTC(meetup.date, meetup.time, meetup.timezone)
                        const parts = new Intl.DateTimeFormat('en-US', { timeZone: viewerTz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc)
                        const y = parseInt(parts.find(p => p.type === 'year').value)
                        const m = parseInt(parts.find(p => p.type === 'month').value)
                        const d = parseInt(parts.find(p => p.type === 'day').value)
                        cardParsedDate = new Date(y, m - 1, d)
                      } else if (meetup.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [y, m, d] = meetup.date.split('-').map(Number)
                        cardParsedDate = new Date(y, m - 1, d)
                      } else {
                        const cleanStr = meetup.date.replace(/^[A-Za-z]+,\s*/, '')
                        cardParsedDate = new Date(`${cleanStr} ${new Date().getFullYear()}`)
                      }
                    } catch { cardParsedDate = new Date() }
                    const cardMonth = cardParsedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                    const cardDay = cardParsedDate.getDate()
                    const cardToday = new Date(); cardToday.setHours(0,0,0,0)
                    const cardEventDay = new Date(cardParsedDate); cardEventDay.setHours(0,0,0,0)
                    const cardDiffDays = Math.round((cardEventDay - cardToday) / (1000 * 60 * 60 * 24))
                    const cardWeekday = cardDiffDays === 0 ? 'Today' : cardDiffDays === 1 ? 'Tomor' : cardParsedDate.toLocaleDateString('en-US', { weekday: 'short' })

                    // --- MOBILE: card layout matching UX reference ---
                    if (isMobile) return (
                      <div
                        key={meetup.id}
                        onClick={() => !meetup._isCoffeeChat && handleNavigate('eventDetail', { meetupId: meetup.id })}
                        style={{
                          background: 'transparent',
                          borderRadius: '16px',
                          boxShadow: '0 1px 3px rgba(59,35,20,0.06)',
                          border: '1px solid rgba(59,35,20,0.05)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                          {/* Date block - left column */}
                          <div style={{
                            minWidth: '68px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px 0',
                            background: '#F3EAE0',
                            borderRight: '1px solid rgba(59,35,20,0.06)',
                            flexShrink: 0,
                          }}>
                            <span style={{
                              fontFamily: '"DM Sans", sans-serif',
                              fontSize: '11px', fontWeight: '600',
                              textTransform: 'uppercase', letterSpacing: '1.2px',
                              color: '#8B6347', marginBottom: '2px',
                            }}>{cardMonth}</span>
                            <span style={{
                              fontFamily: '"Lora", serif',
                              fontSize: '26px', fontWeight: '600',
                              color: '#3B2314', lineHeight: 1,
                            }}>{cardDay}</span>
                            <span style={{
                              fontFamily: '"DM Sans", sans-serif',
                              fontSize: '11px', fontWeight: '500',
                              color: '#9B8A7E', marginTop: '3px',
                            }}>{cardWeekday}</span>
                          </div>

                          {/* Content area */}
                          <div style={{ flex: 1, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                            <h4 style={{
                              fontFamily: '"Lora", serif', fontSize: '16px', fontWeight: '600',
                              color: '#2C1810', margin: 0, lineHeight: 1.3, letterSpacing: '-0.2px',
                            }}>
                              {meetup.topic || 'Community Event'}
                            </h4>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#6B5B50' }}>
                              <svg width="14" height="14" fill="none" stroke="#C4A07C" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                              <span style={{ fontWeight: '600', color: '#5C3A24' }}>{formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false })}</span>
                            </div>

                            {(() => {
                              // Hide attendee count for 1:1 coffee chats (always 2, not useful)
                              if (meetup._isCoffeeChat) {
                                // Show partner avatar only
                                const partner = meetupSignups.find(s => s.user_id !== currentUser.id)
                                if (!partner) return null
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {partner.profiles?.profile_picture ? (
                                      <img src={partner.profiles.profile_picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFFCF8' }} />
                                    ) : (
                                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Sans", sans-serif', fontSize: '9px', fontWeight: '600', color: 'white', background: '#8B6347' }}>
                                        {(partner.profiles?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                      </div>
                                    )}
                                    <span style={{ fontSize: '12px', color: '#6B5B50', fontWeight: '500' }}>with {partner.profiles?.name?.split(' ')[0] || 'Partner'}</span>
                                  </div>
                                )
                              }
                              const meetupSignupsList = meetupSignups
                              const attendeeCount = meetupSignupsList.length
                              if (attendeeCount === 0) return null
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {meetupSignupsList.slice(0, 3).map((signup, i) => (
                                      signup.profiles?.profile_picture ? (
                                        <img key={signup.user_id || i} src={signup.profiles.profile_picture} alt="" style={{
                                          width: '24px', height: '24px', borderRadius: '50%',
                                          border: '2px solid #FFFCF8', marginLeft: i === 0 ? 0 : '-7px',
                                          objectFit: 'cover',
                                        }} />
                                      ) : (
                                        <div key={signup.user_id || i} style={{
                                          width: '24px', height: '24px', borderRadius: '50%',
                                          border: '2px solid #FFFCF8', marginLeft: i === 0 ? 0 : '-7px',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontFamily: '"DM Sans", sans-serif', fontSize: '9px', fontWeight: '600',
                                          color: 'white',
                                          background: ['#8B6347', '#A67B5B', '#C4A07C'][i % 3],
                                        }}>
                                          {(signup.profiles?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </div>
                                      )
                                    ))}
                                    {attendeeCount > 3 && (
                                      <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        border: '2px solid #FFFCF8', marginLeft: '-7px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: '"DM Sans", sans-serif', fontSize: '9px', fontWeight: '600',
                                        color: '#6B4632', background: '#E8D5BE',
                                      }}>
                                        +{attendeeCount - 3}
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#9B8A7E' }}>
                                    <span style={{ fontWeight: '600', color: '#6B5B50' }}>{attendeeCount}</span> attendees
                                  </span>
                                </div>
                              )
                            })()}
                          </div>

                          {/* Action button - right column */}
                          <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 0', flexShrink: 0 }}>
                            {isSignedUp ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleJoinVideoCall(meetup) }}
                                style={{
                                  background: '#3B2314', color: 'white', border: 'none',
                                  padding: '9px 16px', borderRadius: '10px',
                                  fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '600',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                  gap: '6px', whiteSpace: 'nowrap',
                                }}
                              >
                                <Video style={{ width: '15px', height: '15px' }} />
                                Join
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSignUp(meetup.id) }}
                                style={{
                                  background: '#3B2314', color: 'white', border: 'none',
                                  padding: '9px 14px', borderRadius: '10px',
                                  fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '600',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                  gap: '5px', whiteSpace: 'nowrap',
                                }}
                              >
                                Reserve spot
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )

                    // --- DESKTOP: original flat row layout ---
                    return (
                      <React.Fragment key={meetup.id}>
                        {idx > 0 && (
                          <div style={{ height: '1px', background: 'rgba(139, 111, 92, 0.25)', margin: '0 8px' }} />
                        )}
                      <div
                        onClick={() => !meetup._isCoffeeChat && handleNavigate('eventDetail', { meetupId: meetup.id })}
                        style={{
                          display: 'flex',
                          gap: '16px',
                          padding: '14px 8px',
                          transition: 'background-color 0.2s ease',
                          cursor: 'pointer',
                          position: 'relative',
                          borderRadius: '12px',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF5EF'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <EventDateBadge date={meetup.date} time={meetup.time} timezone={meetup.timezone} />

                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                              letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px', flexShrink: 0,
                              ...(meetup._isCoffeeChat ? { background: '#F0E4D8', color: '#6B4632' } : meetup.circle_id ? { background: '#F0E4D8', color: '#6B4632' } : { background: '#E8D5BE', color: '#5C3A24' }),
                            }}>
                              {meetup._isCoffeeChat ? '1:1' : meetup.circle_id ? 'Circle' : 'Event'}
                            </span>
                            {meetup._isCoffeeChat && meetup._coffeeChatData?.status === 'pending' && (
                              <span style={{
                                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                                letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px', flexShrink: 0,
                                background: '#FFF3E0', color: '#B8860B',
                              }}>
                                Pending
                              </span>
                            )}
                            {isLive && (
                              <span style={{
                                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                                letterSpacing: '0.8px', padding: '3px 8px', borderRadius: '5px',
                                background: '#FEF0EC', color: '#D45B3E',
                                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D45B3E', animation: 'pulse-live 1.5s infinite' }} />
                                Live
                              </span>
                            )}
                          </div>

                          <h4 style={{
                            fontFamily: '"Lora", serif', fontSize: '20px', fontWeight: '600',
                            color: '#523C2E', margin: 0, lineHeight: '20px', letterSpacing: '0.15px',
                          }}>
                            {meetup.topic || 'Community Event'}
                          </h4>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: '"Lora", serif', fontSize: '15px', color: '#523C2E' }}>
                              <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                              <span style={{ fontWeight: '600' }}>{formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false })}</span>
                            </div>
                            {meetup.location && (
                              <>
                                <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#D4B896', flexShrink: 0 }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: '"Lora", serif', fontSize: '15px', color: '#523C2E' }}>
                                  <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  <span>{meetup.location}</span>
                                </div>
                              </>
                            )}
                            {!meetup.location && (
                              <>
                                <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#D4B896', flexShrink: 0 }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: '"Lora", serif', fontSize: '15px', color: '#523C2E' }}>
                                  <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  <span>Virtual · Video Call</span>
                                </div>
                              </>
                            )}
                          </div>

                          {(() => {
                            const meetupSignupsList = meetupSignups
                            const attendeeCount = meetupSignupsList.length
                            const limit = meetup.participant_limit
                            const spotsLeft = limit ? Math.max(0, limit - attendeeCount) : null
                            if (attendeeCount === 0) return null
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {meetupSignupsList.slice(0, 3).map((signup, i) => (
                                    signup.profiles?.profile_picture ? (
                                      <img key={signup.user_id || i} src={signup.profiles.profile_picture} alt="" style={{
                                        width: '34px', height: '34px', borderRadius: '50%',
                                        border: '2px solid #FFFCF8', marginLeft: i === 0 ? 0 : '-8px',
                                        objectFit: 'cover',
                                      }} />
                                    ) : (
                                      <div key={signup.user_id || i} style={{
                                        width: '34px', height: '34px', borderRadius: '50%',
                                        border: '2px solid #FFFCF8', marginLeft: i === 0 ? 0 : '-8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: '"Lora", serif', fontSize: '10px', fontWeight: '700',
                                        color: '#523C2E',
                                        background: 'linear-gradient(180deg, rgba(158, 120, 104, 0.2) 0%, rgba(241, 225, 213, 0.2) 100%)',
                                        boxShadow: '0px 1px 4px #9E7868', letterSpacing: '0.15px',
                                      }}>
                                        {(signup.profiles?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                      </div>
                                    )
                                  ))}
                                  {attendeeCount > 3 && (
                                    <div style={{
                                      width: '34px', height: '34px', borderRadius: '50%',
                                      border: '2px solid #FFFCF8', marginLeft: '-8px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontFamily: '"Lora", serif', fontSize: '10px', fontWeight: '700',
                                      color: '#764D31',
                                      background: 'linear-gradient(180deg, rgba(158, 120, 104, 0.2) 99.99%, rgba(241, 225, 213, 0.2) 100%)',
                                      boxShadow: '0px 1px 4px #9E7868',
                                    }}>
                                      +{attendeeCount - 3}
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontFamily: '"Lora", serif', fontSize: '15px', fontWeight: '600', color: '#523C2E', opacity: 0.82, letterSpacing: '0.15px' }}>
                                  {attendeeCount} attendees
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isSignedUp ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleJoinVideoCall(meetup) }}
                              style={{
                                background: 'rgba(88, 66, 51, 0.9)', color: '#F5EDE9', border: 'none',
                                padding: '10px 20px', borderRadius: '18px',
                                fontFamily: '"Lora", serif', fontStyle: 'italic', fontSize: '16px', fontWeight: '700',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                gap: '6px', whiteSpace: 'nowrap', letterSpacing: '0.15px',
                              }}
                            >
                              <Video style={{ width: '18px', height: '18px', color: 'rgba(255, 246, 238, 0.85)' }} />
                              Join
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSignUp(meetup.id) }}
                              style={{
                                background: 'rgba(88, 66, 51, 0.9)', color: '#F5EDE9', border: 'none',
                                padding: '10px 20px', borderRadius: '18px',
                                fontFamily: '"Lora", serif', fontStyle: 'italic', fontSize: '16px', fontWeight: '700',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                gap: '6px', whiteSpace: 'nowrap', letterSpacing: '0.15px',
                              }}
                            >
                              Reserve spot
                            </button>
                          )}
                        </div>
                      </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>


          {/* === Recommendation Sections === */}
          {!homeRecsLoaded ? null : (<>

          {/* Section 1: People to Meet */}
          {(() => {
            const filteredPeopleRecs = homePeopleRecs
            return filteredPeopleRecs.length > 0 && (
            <div style={{ marginBottom: isMobile ? '28px' : '36px' }}>
              <div style={sectionHeaderStyle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Heart style={{ width: '18px', height: '18px', color: '#8B6F5C' }} />
                  People to Meet
                </span>
                <span
                  onClick={() => handleNavigate('allPeople')}
                  style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  See all <ChevronRight style={{ width: '14px', height: '14px' }} />
                </span>
              </div>
              <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '4px',
                ...(isMobile ? {} : { display: 'grid', gridTemplateColumns: `repeat(${Math.min(filteredPeopleRecs.length, 3)}, 1fr)` }),
              }}>
                {filteredPeopleRecs.map((rec) => {
                  return (
                  <div
                    key={rec.id}
                    className="card-hover"
                    onClick={() => handleNavigate('userProfile', { userId: rec.recommended_user_id })}
                    style={{
                      background: 'rgba(255, 255, 255, 0.75)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      padding: isMobile ? '16px' : '20px',
                      cursor: 'pointer',
                      border: '1px solid rgba(139, 111, 92, 0.1)',
                      boxShadow: '0 2px 12px rgba(139, 111, 92, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '10px',
                      ...(isMobile ? { minWidth: '140px', scrollSnapAlign: 'start', flex: '0 0 auto' } : {}),
                    }}
                  >
                    {rec.profile?.profile_picture ? (
                      <img
                        src={rec.profile.profile_picture}
                        alt={rec.profile.name}
                        style={{ width: isMobile ? '52px' : '64px', height: isMobile ? '52px' : '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(139, 111, 92, 0.15)', background: 'linear-gradient(135deg, #E8DDD0, #D4C4B0)', opacity: 0, transition: 'opacity 0.3s ease' }}
                        onLoad={(e) => { e.currentTarget.style.opacity = '1' }}
                      />
                    ) : (
                      <div style={{ width: isMobile ? '52px' : '64px', height: isMobile ? '52px' : '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #E8DDD0, #D4C4B0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', color: '#8B6F5C' }} />
                      </div>
                    )}
                    <div>
                      <p style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '14px' : '16px', fontWeight: '600', color: '#3F1906', margin: '0 0 2px 0', lineHeight: isMobile ? '18px' : '22px' }}>
                        {rec.profile?.name || 'Someone'}
                      </p>
                      <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '11px' : '13px', color: '#6B5344', margin: 0, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '120px' : '160px' }}>
                        {rec.profile?.career || 'Community member'}
                      </p>
                      {rec.profile?.city && (
                        <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '10px' : '11px', color: '#A89080', margin: '2px 0 0 0', lineHeight: '14px' }}>
                          {rec.profile.city}{rec.profile.state ? `, ${rec.profile.state}` : ''}
                        </p>
                      )}
                    </div>
                    {rec.match_reasons?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
                        {rec.match_reasons.slice(0, isMobile ? 2 : 3).map((r, i) => (
                          <span key={i} style={{
                            fontFamily: '"DM Sans", sans-serif',
                            fontSize: isMobile ? '8px' : '10px', fontWeight: 500,
                            backgroundColor: 'rgba(139, 111, 92, 0.1)', color: '#5C4033',
                            padding: isMobile ? '1px 6px' : '2px 8px', borderRadius: '100px',
                          }}>
                            {r.reason}
                          </span>
                        ))}
                      </div>
                    ) : rec.match_score > 0 ? (
                      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '8px' : '11px', backgroundColor: 'rgba(139, 111, 92, 0.08)', color: '#8B7355', padding: isMobile ? '1px 6px' : '3px 10px', borderRadius: '100px' }}>
                        {Math.round(rec.match_score * 100)}% match
                      </span>
                    ) : null}
                    {rec.sharedMeetups > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <Users style={{ width: isMobile ? '10px' : '12px', height: isMobile ? '10px' : '12px', color: '#A89080' }} />
                        <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '8px' : '10px', color: '#A89080' }}>
                          {rec.sharedMeetups} shared {rec.sharedMeetups === 1 ? 'meetup' : 'meetups'}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNavigate('userProfile', { userId: rec.recommended_user_id }) }}
                      style={{
                        marginTop: '2px',
                        padding: isMobile ? '8px 16px' : '8px 20px',
                        minHeight: '36px',
                        background: '#5C4033', color: '#FAF5EF',
                        border: 'none', borderRadius: '20px',
                        fontFamily: '"DM Sans", sans-serif',
                        fontSize: isMobile ? '12px' : '13px', fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#4A3228' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#5C4033' }}
                    >
                      Say hi
                    </button>
                  </div>
                  )
                })}
              </div>
            </div>
          )
          })()}

          {/* Section 2: Circle to Join */}
          {homeCircleRecs.length > 0 && (() => {
            const match = homeCircleRecs[0];
            const circle = match.circle;
            if (!circle) return null;
            const circleName = circle.name || 'Community Circle';
            const memberCount = circle.connection_group_members?.[0]?.count || 0;
            const maxMembers = 10;
            const spotsLeft = maxMembers - memberCount;
            const description = circle.description || 'Connect & grow together';

            // Generate tags from name
            const text = `${circleName} ${description}`.toLowerCase();
            const tagKeywords = [
              { keywords: ['founder', 'startup'], tag: 'Founders' },
              { keywords: ['early-stage', 'early stage'], tag: 'Early-stage' },
              { keywords: ['ai', 'machine learning'], tag: 'AI' },
              { keywords: ['product', 'build'], tag: 'Product' },
              { keywords: ['book', 'reading'], tag: 'Reading' },
              { keywords: ['side project'], tag: 'Side Projects' },
              { keywords: ['career', 'job'], tag: 'Career' },
              { keywords: ['design', 'ux'], tag: 'Design' },
              { keywords: ['leader', 'manage'], tag: 'Leadership' },
            ];
            const tags = [];
            tagKeywords.forEach(({ keywords, tag }) => {
              if (!tags.includes(tag) && keywords.some(kw => text.includes(kw))) tags.push(tag);
            });
            const displayTags = tags.slice(0, 3);

            return (
            <div style={{ marginBottom: isMobile ? '28px' : '36px' }}>
              <div style={sectionHeaderStyle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users style={{ width: '18px', height: '18px', color: '#8B6F5C' }} />
                  Circle to Join
                </span>
                <span
                  onClick={() => handleNavigate('allCircles')}
                  style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  See all <ChevronRight style={{ width: '14px', height: '14px' }} />
                </span>
              </div>
              <div
                className="card-hover"
                onClick={() => handleNavigate('circleDetail', { circleId: match.circle_id || circle.id })}
                style={{
                  background: '#FAF7F4', borderRadius: isMobile ? '14px' : '22px',
                  border: '1px solid #E8DDD6',
                  boxShadow: '0 4px 24px rgba(61,46,34,0.11)',
                  overflow: 'hidden', display: 'flex', alignItems: 'stretch',
                  cursor: 'pointer',
                }}
              >
                {/* Left: SVG illustration */}
                <div style={{
                  width: isMobile ? '100px' : '160px', flexShrink: 0,
                  position: 'relative', overflow: 'hidden',
                }}>
                  {circle.image_url ? (
                    <img src={circle.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg viewBox="0 0 110 190" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
                      <rect width="110" height="190" fill="#2C1F15"/>
                      <circle cx="55" cy="95" r="60" fill="#E8C070" opacity="0.06"/>
                      <circle cx="55" cy="95" r="38" fill="#E8C070" opacity="0.07"/>
                      <circle cx="55" cy="95" r="50" fill="none" stroke="#5C3D20" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6"/>
                      <ellipse cx="55" cy="98" rx="34" ry="22" fill="#5C3D20"/>
                      <ellipse cx="55" cy="50" rx="7" ry="7" fill="#C4956A"/>
                      <rect x="48" y="55" width="14" height="10" rx="5" fill="#C4956A"/>
                      <ellipse cx="88" cy="77" rx="6" ry="6" fill="#A0724A"/>
                      <rect x="82" y="82" width="12" height="9" rx="4" fill="#A0724A"/>
                      <ellipse cx="23" cy="77" rx="6" ry="6" fill="#D4A878"/>
                      <rect x="17" y="82" width="12" height="9" rx="4" fill="#D4A878"/>
                      <circle cx="55" cy="33" r="3" fill="#E8C070" opacity="0.9"/>
                    </svg>
                  )}
                </div>

                {/* Right: content */}
                <div style={{
                  flex: 1, padding: isMobile ? '10px 12px' : '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', minWidth: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                      background: '#E8F5E9', border: '1px solid #B8DFC0',
                      fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#2E6B40',
                    }}>
                      <span style={{ width: isMobile ? 5 : 6, height: isMobile ? 5 : 6, borderRadius: '50%', background: '#22c55e' }} />
                      Open
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      padding: isMobile ? '2px 7px' : '3px 9px', borderRadius: '20px',
                      background: '#F0E8DF', border: '1px solid #E0D0BE',
                      fontSize: isMobile ? '9px' : '10.5px', fontWeight: '600', color: '#6B4F35',
                    }}>
                      <Users style={{ width: isMobile ? '9px' : '11px', height: isMobile ? '9px' : '11px' }} /> {memberCount}/{maxMembers}
                    </span>
                  </div>

                  <h4 style={{
                    fontSize: isMobile ? '16px' : '18px', fontWeight: '700',
                    color: '#2C1F15', margin: 0, fontFamily: '"Lora", serif',
                    lineHeight: '1.3',
                  }}>
                    {circleName}
                  </h4>

                  <p style={{
                    fontSize: isMobile ? '11px' : '12px', color: '#8B7355', margin: 0, lineHeight: '1.5',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {description}
                  </p>

                  {displayTags.length > 0 && (
                    <div style={{ display: 'flex', gap: isMobile ? '4px' : '5px', flexWrap: 'wrap' }}>
                      {displayTags.map((tag, i) => (
                        <span key={i} style={{
                          fontSize: isMobile ? '9px' : '10.5px', fontWeight: '500', color: '#6B4F35',
                          background: '#F0E8DF', border: '1px solid #E0D0BE',
                          padding: isMobile ? '1px 7px' : '2px 9px', borderRadius: '10px',
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Member avatars + spots */}
                  {circle.members?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px' }}>
                      <div style={{ display: 'flex' }}>
                        {circle.members.slice(0, isMobile ? 3 : 4).map((member, idx) => {
                          const avatarBgs = ['#E8D5C0', '#D4C4A8', '#C4956A', '#A0724A'];
                          const avSize = isMobile ? '18px' : '22px';
                          return (
                            <div key={member.user_id || idx} style={{
                              width: avSize, height: avSize, borderRadius: '50%',
                              background: avatarBgs[idx % avatarBgs.length],
                              border: '1.5px solid #FAF7F4',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: isMobile ? '7px' : '9px', fontWeight: '600', color: '#5C3318',
                              marginLeft: idx > 0 ? (isMobile ? '-5px' : '-6px') : 0, flexShrink: 0,
                              overflow: 'hidden',
                            }}>
                              {member.user?.profile_picture ? (
                                <img src={member.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                member.user?.name?.charAt(0) || '?'
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#A07850' }}>{spotsLeft} left</span>
                    </div>
                  )}

                  <div style={{ height: '1px', background: '#EDE6DF' }} />

                  {/* Host + Join */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px' }}>
                    {(() => {
                      const creator = circle.members?.find(m => m.user_id === circle.creator_id);
                      const creatorName = creator?.user?.name || 'Host';
                      return (
                        <>
                          <div style={{
                            width: isMobile ? '18px' : '22px', height: isMobile ? '18px' : '22px', borderRadius: '50%',
                            background: '#E8D5C0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isMobile ? '8px' : '9.5px', fontWeight: '600', color: '#5C3318', flexShrink: 0,
                            overflow: 'hidden',
                          }}>
                            {creator?.user?.profile_picture ? (
                              <img src={creator.user.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : creatorName.charAt(0)}
                          </div>
                          <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '500', color: '#6B4F35' }}>{creatorName.split(' ')[0]}</span>
                          <span style={{ fontSize: isMobile ? '9px' : '10px', color: '#B09A8A' }}>{'\u00b7'} host</span>
                        </>
                      );
                    })()}
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNavigate('circleDetail', { circleId: match.circle_id || circle.id }); }}
                      style={{
                        padding: isMobile ? '5px 12px' : '6px 14px', borderRadius: '14px',
                        fontSize: isMobile ? '10px' : '11.5px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
                        background: '#3D2E22', color: '#FAF7F4',
                        border: 'none', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#2C1F15' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#3D2E22' }}
                    >Join</button>
                  </div>
                </div>
              </div>
            </div>
            )
          })()}

          {/* Empty state when no recommendations exist yet */}
          {homePeopleRecs.length === 0 && homeCircleRecs.length === 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(232, 221, 208, 0.4), rgba(212, 196, 176, 0.25))',
              borderRadius: '16px',
              padding: isMobile ? '24px 20px' : '32px',
              textAlign: 'center',
              marginBottom: '24px',
            }}>
              <Sparkles style={{ width: '28px', height: '28px', color: '#B8A089', marginBottom: '12px' }} />
              <p style={{ fontFamily: '"Lora", serif', fontSize: '16px', fontWeight: '600', color: '#5E4530', margin: '0 0 6px 0' }}>
                Your recommendations are brewing
              </p>
              <p style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '14px', color: '#8B7355', margin: '0 0 16px 0' }}>
                Attend a meetup or join a circle to unlock personalized suggestions
              </p>
              <span
                onClick={() => setCurrentView('discover')}
                style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '14px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Explore Circles <ChevronRight style={{ width: '16px', height: '16px' }} />
              </span>
            </div>
          )}

          </>)}


        </div>
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
                        {person.open_to_coffee_chat && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: '#FDF3EB', color: '#6B4F3A' }}>
                            <Coffee className="w-3 h-3" /> Open to Coffee Chat
                          </span>
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


  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#F4EEE6] to-[#E8DDD0] rounded-lg p-6 border border-[#D4A574]">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Dashboard</h3>
        <p className="text-sm text-gray-600">Manage meetups and view signups</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <button
          onClick={() => setCurrentView('adminAnalytics')}
          className="bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Users className="w-5 h-5 mr-2" />
          View Analytics
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
                    {meetup.status !== 'completed' && (
                      <button
                        onClick={() => handleEditMeetup(meetup)}
                        className="text-[#6B4F3F] hover:text-[#5A4235] text-sm font-medium"
                      >
                        Edit
                      </button>
                    )}
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
    <div className="min-h-screen pb-28" style={{ background: '#FDF8F3' }}>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
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
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: 'rgba(250, 245, 239, 0.85)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          borderBottom: '1px solid rgba(184, 160, 137, 0.12)'
        }}
      >
        {/* Line 1: Logo + Search + Profile */}
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-2 md:px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <h1 className="text-xl md:text-2xl font-bold flex items-center text-[#5E4530]" style={{ fontFamily: '"Lora", serif', letterSpacing: '-0.3px' }}>
              <svg width="44" height="44" viewBox="0 0 100 100" className="mr-2 md:mr-3 md:w-12 md:h-12">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray="189 63"
                  strokeLinecap="round"
                  transform="rotate(-30 50 50)"
                />
                <path
                  d="M 28 42 L 36 66 L 50 48 L 64 66 L 72 42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ letterSpacing: '0.5px', transform: 'scaleY(0.92)', transformOrigin: 'bottom', display: 'inline-block' }}>CircleW</span>
              </div>
            </h1>

            {/* Right side: Search + Profile */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative" style={{ zIndex: 50 }}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8A089]" style={{ zIndex: 1 }} />
                <input
                  type="text"
                  placeholder="Search meetups, people, circles..."
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-36 md:w-[200px] text-[13px] rounded-full border border-[#E8DDD0] bg-white text-[#5E4530] placeholder-[#B8A089] focus:outline-none md:focus:w-[260px] focus:border-[#B8A089] transition-all duration-300"
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(122,92,66,0.08)'; }}
                  onBlur={(e) => { setTimeout(() => { e.target.style.boxShadow = 'none'; setHomeSearchQuery(''); }, 400); }}
                />
                {homeSearchResults && homeSearchQuery && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                    width: '320px', maxHeight: '400px', overflowY: 'auto',
                    background: 'white', borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(59,35,20,0.15)', border: '1px solid #E8DDD0',
                    padding: '8px 0',
                  }}>
                    {homeSearchResults.total === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9B8A7E', fontSize: '13px', fontFamily: '"DM Sans", sans-serif' }}>
                        No results for "{homeSearchQuery}"
                      </div>
                    ) : (
                      <>
                        {homeSearchResults.meetups.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: '"DM Sans", sans-serif' }}>Meetups</div>
                            {homeSearchResults.meetups.map(m => (
                              <div key={m.id} onClick={() => { setHomeSearchQuery(''); handleNavigate('eventDetail', { meetupId: m.id }); }}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F3EAE0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Calendar style={{ width: '16px', height: '16px', color: '#8B6347' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: '"DM Sans", sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.topic}</div>
                                  <div style={{ fontSize: '11px', color: '#9B8A7E', fontFamily: '"DM Sans", sans-serif' }}>{formatEventTime(m.date, m.time, m.timezone)}{m.connection_groups?.name ? ` · ${m.connection_groups.name}` : ''}</div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                        {homeSearchResults.circles.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: '"DM Sans", sans-serif' }}>Circles</div>
                            {homeSearchResults.circles.map(c => (
                              <div key={c.id} onClick={() => { setHomeSearchQuery(''); handleNavigate('circleDetail', { circleId: c.id }); }}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Users style={{ width: '16px', height: '16px', color: '#7A5C42' }} />
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: '"DM Sans", sans-serif' }}>{c.name}</div>
                              </div>
                            ))}
                          </>
                        )}
                        {homeSearchResults.people.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: '"DM Sans", sans-serif' }}>People</div>
                            {homeSearchResults.people.map(p => (
                              <div key={p.id} onClick={() => { setHomeSearchQuery(''); handleNavigate('userProfile', { userId: p.id }); }}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {p.profile_picture ? (
                                  <img src={p.profile_picture} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E6D5C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: '600', color: '#6B4632', fontFamily: '"DM Sans", sans-serif' }}>
                                    {(p.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: '"DM Sans", sans-serif' }}>{p.name}</div>
                                  {p.career && <div style={{ fontSize: '11px', color: '#9B8A7E', fontFamily: '"DM Sans", sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.career}</div>}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Avatar */}
              <button
                onClick={() => setCurrentView('profile')}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:ring-2 hover:ring-[#8B6F5C] focus:outline-none focus:ring-2 focus:ring-[#8B6F5C]"
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
                  <span className="text-[#5C4033]">
                    {(currentUser.name || currentUser.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Line 2: Navigation Bar */}
        <div>
          <div className="max-w-4xl mx-auto px-2 md:px-6">
            <div className="flex items-center gap-1 py-1.5">
              <button
                onClick={() => setCurrentView('home')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-[5px] md:gap-[7px] px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap rounded-full transition-all duration-[250ms] min-h-[44px] ${
                  currentView === 'home'
                    ? 'bg-[#5E4530] text-[#FAF5EF]'
                    : 'text-[#9C8068] hover:text-[#5E4530] hover:bg-[#E8DDD0]'
                }`}
              >
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Home</span>
              </button>
              <button
                onClick={() => handleNavigate('discover')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-[5px] md:gap-[7px] px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap rounded-full transition-all duration-[250ms] min-h-[44px] ${
                  currentView === 'discover'
                    ? 'bg-[#5E4530] text-[#FAF5EF]'
                    : 'text-[#9C8068] hover:text-[#5E4530] hover:bg-[#E8DDD0]'
                }`}
              >
                <Compass className="w-4 h-4 flex-shrink-0" />
                <span>Discover</span>
              </button>
              <button
                onClick={() => handleNavigate('meetups')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-[5px] md:gap-[7px] px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap rounded-full transition-all duration-[250ms] min-h-[44px] ${
                  currentView === 'meetups'
                    ? 'bg-[#5E4530] text-[#FAF5EF]'
                    : 'text-[#9C8068] hover:text-[#5E4530] hover:bg-[#E8DDD0]'
                }`}
              >
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Coffee</span>
              </button>
              <button
                onClick={() => handleNavigate('connectionGroups')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-[5px] md:gap-[7px] px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap rounded-full transition-all duration-[250ms] min-h-[44px] ${
                  currentView === 'connectionGroups'
                    ? 'bg-[#5E4530] text-[#FAF5EF]'
                    : 'text-[#9C8068] hover:text-[#5E4530] hover:bg-[#E8DDD0]'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>Circles</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div
        className={`max-w-4xl mx-auto p-4 md:p-6`}
      >
        {currentView === 'home' && <HomeView />}
        {/* LiveFeed rendered outside HomeView so it doesn't remount on every MainApp state change */}
        {currentView === 'home' && (
          <div style={{ maxWidth: '880px', margin: '0 auto', marginTop: '8px', paddingTop: '24px', borderTop: '1px solid rgba(139, 111, 92, 0.1)' }}>
            <LiveFeed
              currentUserId={currentUser.id}
              onCtaClick={(event) => {
                if (event.event_type === 'coffee_available' || event.event_type === 'member_joined') {
                  handleNavigate('userProfile', { userId: event.actor?.id })
                } else if (event.event_type === 'circle_join' || event.event_type === 'circle_schedule') {
                  handleNavigate('circleDetail', { circleId: event.circle_id || event.circle?.id })
                } else if (event.event_type === 'community_event') {
                  handleNavigate('eventDetail', { meetupId: event.metadata?.meetup_id })
                }
              }}
            />
          </div>
        )}
        {currentView === 'meetups' && <MeetupsView currentUser={currentUser} connections={connections} supabase={supabase} meetups={meetups} userSignups={userSignups} onNavigate={handleNavigate} initialView={meetupsInitialView} />}
        {currentView === 'pastMeetings' && <MeetupsView currentUser={currentUser} connections={connections} supabase={supabase} meetups={meetups} userSignups={userSignups} onNavigate={handleNavigate} pastOnly />}
        {currentView === 'connectionGroups' && <ConnectionGroupsView currentUser={currentUser} supabase={supabase} connections={connections} onNavigate={handleNavigate} />}
        {currentView === 'connections' && <ConnectionsView />}
        {currentView === 'discover' && <NetworkDiscoverView currentUser={currentUser} supabase={supabase} connections={connections} meetups={meetups} onNavigate={handleNavigate} toast={toast} onHostMeetup={(requestData) => {
            setScheduleMeetupContext({
              type: 'community',
              topic: requestData?.topic || '',
              description: requestData?.description || '',
            });
            setCurrentView('scheduleMeetup');
          }} />}
        {currentView === 'messages' && <MessagesPageView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} initialChatId={selectedChatId} initialChatType={selectedChatType} previousView={previousView} />}
        {currentView === 'callHistory' && <CallHistoryView currentUser={currentUser} supabase={supabase} />}
        {currentView === 'meetupProposals' && <MeetupProposalsView currentUser={currentUser} supabase={supabase} isAdmin={currentUser.role === 'admin'} />}
        {currentView === 'profile' && (
          <UserProfileView
            currentUser={currentUser}
            supabase={supabase}
            userId={currentUser.id}
            onNavigate={handleNavigate}
            previousView={previousView}
            onEditProfile={openEditProfile}
            onShowTutorial={() => setShowOnboarding(true)}
            onSignOut={handleSignOut}
            onAdminDashboard={() => setCurrentView('admin')}
            refreshKey={profileRefreshKey}
          />
        )}
        {currentView === 'admin' && currentUser.role === 'admin' && <AdminDashboard />}
        {currentView === 'adminFeedback' && currentUser.role === 'admin' && <AdminFeedbackView currentUser={currentUser} supabase={supabase} />}
        {currentView === 'adminAnalytics' && currentUser.role === 'admin' && <AdminAnalyticsView currentUser={currentUser} supabase={supabase} />}
        {currentView === 'allEvents' && <AllEventsView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} />}
        {currentView === 'eventDetail' && (
          <CoffeeChatDetailView
            currentUser={currentUser}
            supabase={supabase}
            onNavigate={handleNavigate}
            meetupId={selectedMeetupId}
            meetupCategory={selectedMeetupCategory}
            previousView={previousView}
            onMeetupChanged={loadMeetupsFromDatabase}
            toast={toast}
          />
        )}
        {currentView === 'allPeople' && <AllPeopleView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} previousView={previousView} />}
        {currentView === 'allCircles' && <AllCirclesView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} />}
        {currentView === 'createCircle' && <CreateCircleView currentUser={currentUser} supabase={supabase} onNavigate={setCurrentView} />}
        {currentView === 'circleDetail' && <CircleDetailView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} circleId={selectedCircleId} previousView={previousView} />}
        {currentView === 'coffeeChats' && <ScheduleMeetupView currentUser={currentUser} supabase={supabase} connections={connections} onNavigate={handleNavigate} previousView={previousView} initialType="coffee" />}
        {currentView === 'userProfile' && <UserProfileView currentUser={currentUser} supabase={supabase} userId={selectedUserId} onNavigate={handleNavigate} previousView={previousView} onConnectionRemoved={(userId) => {
          setConnections(prev => prev.filter(c => (c.connected_user?.id || c.id) !== userId));
        }} />}
        {currentView === 'coffeeChatRecap' && (
          <CoffeeChatRecapView
            recapId={selectedRecapId}
            onNavigate={handleNavigate}
            previousView={previousView}
          />
        )}
        {currentView === 'scheduleMeetup' && (
          <ScheduleMeetupView
            currentUser={currentUser}
            supabase={supabase}
            connections={connections}
            onNavigate={handleNavigate}
            previousView={previousView}
            initialType={scheduleMeetupContext.type}
            initialCircleId={scheduleMeetupContext.circleId}
            initialCircleName={scheduleMeetupContext.circleName}
            initialConnectionId={scheduleMeetupContext.connectionId}
            initialConnectionName={scheduleMeetupContext.connectionName}
            initialTopic={scheduleMeetupContext.topic}
            initialDescription={scheduleMeetupContext.description}
          />
        )}
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full h-[90vh] md:h-[600px] flex flex-col border border-[#E6D5C3]" style={{ boxShadow: '0 4px 16px rgba(107, 79, 63, 0.15)' }}>
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
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#6B4F3F]"
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
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#E6D5C3]"
                  />
                ) : (
                  <div className="w-24 h-24 bg-[#F4EEE6] rounded-full flex items-center justify-center text-3xl text-[#6B4F3F] font-bold border-4 border-[#E6D5C3]">
                    {(editedProfile.name || editedProfile.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-[#6B4F3F] hover:bg-[#5A4235] text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) => { setEditedProfile({ ...editedProfile, name: e.target.value }); setProfileErrors(prev => ({ ...prev, name: false })) }}
                  className={`w-full border rounded p-2 focus:outline-none ${profileErrors.name ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                />
                {profileErrors.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editedProfile.career}
                  onChange={(e) => { setEditedProfile({ ...editedProfile, career: e.target.value }); setProfileErrors(prev => ({ ...prev, career: false })) }}
                  className={`w-full border rounded p-2 focus:outline-none ${profileErrors.career ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                  placeholder="e.g. Product Manager"
                />
                {profileErrors.career && <p className="text-xs text-red-500 mt-1">Role is required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={editedProfile.industry || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, industry: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
                >
                  <option value="">Select industry</option>
                  <option value="Fintech">Fintech</option>
                  <option value="AI / Machine Learning">AI / Machine Learning</option>
                  <option value="HealthTech">HealthTech</option>
                  <option value="SaaS">SaaS</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="EdTech">EdTech</option>
                  <option value="Media & Entertainment">Media & Entertainment</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Finance & Banking">Finance & Banking</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Non-profit">Non-profit</option>
                  <option value="Government">Government</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Career Stage</label>
                <select
                  value={editedProfile.career_stage || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, career_stage: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
                >
                  <option value="">Select stage</option>
                  <option value="emerging">Emerging (Early Career)</option>
                  <option value="scaling">Scaling (Mid-Career)</option>
                  <option value="leading">Leading (Manager/Director)</option>
                  <option value="legacy">Legacy (Executive/Founder)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What's your vibe?</label>
                <select
                  value={editedProfile.vibe_category || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, vibe_category: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
                >
                  <option value="">Select vibe</option>
                  <option value="advice">I need advice</option>
                  <option value="vent">I want to vent</option>
                  <option value="grow">I want to grow</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <p className="text-xs text-gray-400 mb-2">Describe yourself. What makes you special? Don't think too hard, just have fun with it.</p>
                <input
                  type="text"
                  value={editedProfile.hook || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, hook: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
                  placeholder="e.g. PM by day, plant mom by night. Let's talk career pivots over coffee."
                  maxLength={160}
                />
                <p className="text-xs text-gray-400 mt-1">{(editedProfile.hook || '').length}/160</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <p className="text-xs text-gray-400 mb-2">Helps us connect you with people at a similar life stage. Only used for matching, never shown publicly.</p>
                <input
                  type="number"
                  value={editedProfile.age || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, age: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#6B4F3F]"
                  placeholder="e.g. 32"
                />
              </div>

              {/* Location with auto-detect */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Location <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="flex items-center text-xs text-[#6B4F3F] hover:text-[#5A4235] font-medium disabled:opacity-50"
                  >
                    {detectingLocation ? (
                      <><div className="w-3 h-3 border-2 border-[#6B4F3F] border-t-transparent rounded-full animate-spin mr-1" /> Detecting...</>
                    ) : (
                      <><Compass className="w-3 h-3 mr-1" /> Auto-detect</>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={editedProfile.city}
                      onChange={(e) => { setEditedProfile({ ...editedProfile, city: e.target.value }); setProfileErrors(prev => ({ ...prev, city: false })) }}
                      placeholder="City"
                      className={`w-full border rounded p-2 focus:outline-none ${profileErrors.city ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                    />
                    {profileErrors.city && <p className="text-xs text-red-500 mt-1">City is required</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={editedProfile.state}
                      onChange={(e) => { setEditedProfile({ ...editedProfile, state: e.target.value.toUpperCase() }); setProfileErrors(prev => ({ ...prev, state: false })) }}
                      maxLength="2"
                      placeholder="State"
                      className={`w-full border rounded p-2 focus:outline-none uppercase ${profileErrors.state ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-[#6B4F3F]'}`}
                    />
                    {profileErrors.state && <p className="text-xs text-red-500 mt-1">State is required</p>}
                  </div>
                </div>
                {(editedProfile.country || editedProfile.timezone) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {[editedProfile.country, editedProfile.timezone].filter(Boolean).join(' · ')}
                  </p>
                )}
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
                className="flex-1 bg-[#6B4F3F] hover:bg-[#5A4235] text-white font-medium py-2 rounded transition-colors"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
