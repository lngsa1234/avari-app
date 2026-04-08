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
import NudgeBanner from './NudgeBanner'
import { ToastContainer, useToast } from './Toast'
import { parseLocalDate, formatEventTime, isEventPast, isEventLive, eventDateTimeToUTC, SESSION_GRACE_MINUTES, isCoffeeChatUpcoming } from '@/lib/dateUtils'
import LiveFeed from './LiveFeed'
import { colors as tokens, fonts } from '@/lib/designTokens'
import useHomeData from '@/hooks/useHomeData'
import useMeetups from '@/hooks/useMeetups'
import useCoffeeChats from '@/hooks/useCoffeeChats'
import useConnections from '@/hooks/useConnections'
import useJourney from '@/hooks/useJourney'
import usePrefetchPages from '@/hooks/usePrefetchPages'
import HomeView from './HomeView'

// Helper functions used by AdminDashboard and meetup modals (still inline in MainApp)
const formatTime = (time24) => {
  if (!time24) return ''
  try {
    const [hours, minutes] = time24.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  } catch {
    return time24
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    let date
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      const cleanDateStr = dateStr
        .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '')
        .trim()
      date = new Date(`${cleanDateStr} ${new Date().getFullYear()}`)
    }
    if (isNaN(date.getTime())) return dateStr
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
  const [editedProfile, setEditedProfile] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
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

  // === HOOKS ===
  const homeData = useHomeData(currentUser)
  const journey = useJourney(currentUser)
  const connectionsHook = useConnections(currentUser, {
    refreshConnectionRequests: homeData.loadConnectionRequests, toast
  })
  const coffeeChats = useCoffeeChats(currentUser, {
    refreshCoffeeChats: homeData.refreshCoffeeChats
  })
  const meetupsHook = useMeetups(currentUser, {
    refreshMeetups: homeData.refreshMeetups,
    refreshUserSignups: homeData.refreshUserSignups,
    refreshSignups: homeData.refreshSignups,
    meetups: homeData.meetups,
    userSignups: homeData.userSignups,
    toast,
  })

  // Prefetch Discover, Coffee, Circles data while user is on Home
  usePrefetchPages(currentUser, supabase)

  // Destructure from hooks
  const {
    meetups, loadingMeetups, signups, userSignups, upcomingCoffeeChats,
    groupsCount, coffeeChatsCount, unreadMessageCount,
    connectionRequests, circleJoinRequests, circleInvitations,
    homeEventRecs, homeCircleRecs, homePeopleRecs, homeRecsLoaded,
    handleAcceptCircleJoin, handleDeclineCircleJoin,
    handleAcceptCircleInvitation, handleDeclineCircleInvitation,
    loadMeetupsFromDatabase,
  } = homeData

  const { pendingRecaps, setPendingRecaps, loadPendingRecaps, updateAttendedCount } = journey

  const { connections, setConnections, myInterests, meetupPeople, loadConnections, lazyLoadAll, handleShowInterest, handleRemoveInterest } = connectionsHook

  const { coffeeChatRequests, loadCoffeeChatRequests, handleAcceptCoffeeChat, handleDeclineCoffeeChat } = coffeeChats

  const {
    newMeetup, setNewMeetup,
    selectedDate, setSelectedDate,
    editingMeetup, setEditingMeetup,
    showCreateMeetup, setShowCreateMeetup,
    showEditMeetup, setShowEditMeetup,
    nextStepPrompt, setNextStepPrompt,
    handleSignUp, handleCancelSignup,
    handleCreateMeetup, handleEditMeetup, handleUpdateMeetup, handleDeleteMeetup, handleSetLocation,
    handleJoinVideoCall,
  } = meetupsHook

  // Navigation handler that supports passing extra data like circleId, chatId
  const hasLoadedConnectionsRef = useRef(false)

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
    // Refresh home page coffee chats & meetups when navigating back to home
    if (view === 'home' && hasLoadedRef.current) {
      homeData.refreshCoffeeChats()
    }
    // Lazy-load connections data on first navigate to a view that needs it
    const viewsNeedingConnections = ['meetups', 'connectionGroups', 'discover', 'coffeeChats', 'scheduleMeetup', 'people', 'allPeople', 'profile']
    if (viewsNeedingConnections.includes(view) && !hasLoadedConnectionsRef.current) {
      hasLoadedConnectionsRef.current = true
      connectionsHook.lazyLoadAll()
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

  // DEBUGGING: Detect mount/unmount cycles
  useEffect(() => {
    console.log(`🧨 MainApp MOUNTED (Component ID: ${componentIdRef.current})`)
    return () => {
      console.log(`🧹 MainApp UNMOUNTED (Component ID: ${componentIdRef.current})`)
      console.log(`⚠️ This component lived for ${Date.now() - mountTimeRef.current}ms`)
    }
  }, [])

  // Check if user needs onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)
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

  // Track user activity (update last_active timestamp) — passive only, no polling
  useEffect(() => {
    if (!currentUser?.id) return

    // Update on initial load
    updateLastActiveThrottled(currentUser.id)

    // Update only on actual user interactions
    const handleActivity = () => {
      updateLastActiveThrottled(currentUser.id)
    }

    window.addEventListener('click', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
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
    homeData.loadHomePageData()

    // Phase 1 deferred: only data NOT already in loadHomePageData
    coffeeChats.loadCoffeeChatRequests()

    // Phase 2 deferred: data needed for other views (connections, discover)
    // These are lazy-loaded when the user navigates to those views.
    // loadConnections, loadMyInterests, loadMeetupPeople, loadPotentialConnections
    // are now called on-demand via handleNavigate instead of eagerly on mount.
    journey.loadPendingRecaps()
  }, []) // Empty array - run once on mount

  // Re-fetch on navigation removed: SWR handles stale-while-revalidate
  // Data shows instantly from cache when returning to home/discover
  const previousViewRef = useRef(currentView)

  // Realtime subscriptions — functions are now stable (useCallback in hooks)
  useEffect(() => {
    if (!currentUser?.id) return

    const meetupsChannel = supabase
      .channel('meetups_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meetups' },
        () => { homeData.loadMeetupsFromDatabase() }
      )
      .subscribe()

    const signupsChannel = supabase
      .channel('signups_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meetup_signups' },
        () => { homeData.loadSignupsForMeetups(homeData.meetups) }
      )
      .subscribe()

    const interestsChannel = supabase
      .channel('interests_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_interests',
          filter: `interested_in_user_id=eq.${currentUser.id}` },
        () => { homeData.loadConnectionRequests() }
      )
      .subscribe()

    const messagesChannel = supabase
      .channel('messages_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}` },
        () => { homeData.loadUnreadMessageCount() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(meetupsChannel)
      supabase.removeChannel(signupsChannel)
      supabase.removeChannel(interestsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [currentUser?.id])

  // Safety check - if currentUser is not loaded yet, show skeleton
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#FDF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 111, 92, 0.15)', borderTopColor: '#8B6F5C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#A89080', fontSize: '14px', fontFamily: fonts.sans }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Show events that haven't ended yet, with 30-min grace for meetings running over
  const upcomingMeetups = (() => {
    const filteredMeetups = meetups.filter(m =>
      m.status !== 'cancelled' &&
      !isEventPast(m.date, m.time, m.timezone, parseInt(m.duration || '60'), SESSION_GRACE_MINUTES)
    )
    // Merge upcoming coffee chats as pseudo-meetup objects (filter out past ones)
    const coffeeMeetups = upcomingCoffeeChats.filter(chat => isCoffeeChatUpcoming(chat)).map(chat => {
      const otherPerson = chat._otherPerson
      const scheduledDate = chat.scheduled_time ? new Date(chat.scheduled_time) : new Date()
      const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`
      const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`
      return {
        id: chat.id,
        topic: chat.topic
          ? `${chat.topic} — with ${otherPerson?.name || 'Someone'}`
          : `Coffee chat with ${otherPerson?.name || 'Someone'}`,
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
            <div className="text-xl md:text-2xl font-bold flex items-center text-[#5E4530]" style={{ fontFamily: fonts.serif, letterSpacing: '-0.3px' }} role="banner" aria-label="CircleW">
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
            </div>

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
                  className="pl-10 pr-4 py-2.5 w-36 md:w-[200px] text-[13px] rounded-full border border-[#E8DDD0] bg-white text-[#5E4530] placeholder-[#B8A089] focus:outline-none md:focus:w-[260px] focus:border-[#B8A089] transition-all duration-300"
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
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9B8A7E', fontSize: '13px', fontFamily: fonts.sans }}>
                        No results for "{homeSearchQuery}"
                      </div>
                    ) : (
                      <>
                        {homeSearchResults.meetups.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>Meetups</div>
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
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.topic}</div>
                                  <div style={{ fontSize: '11px', color: '#9B8A7E', fontFamily: fonts.sans }}>{formatEventTime(m.date, m.time, m.timezone)}{m.connection_groups?.name ? ` · ${m.connection_groups.name}` : ''}</div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                        {homeSearchResults.circles.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>Circles</div>
                            {homeSearchResults.circles.map(c => (
                              <div key={c.id} onClick={() => { setHomeSearchQuery(''); handleNavigate('circleDetail', { circleId: c.id }); }}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Users style={{ width: '16px', height: '16px', color: '#7A5C42' }} />
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans }}>{c.name}</div>
                              </div>
                            ))}
                          </>
                        )}
                        {homeSearchResults.people.length > 0 && (
                          <>
                            <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>People</div>
                            {homeSearchResults.people.map(p => (
                              <div key={p.id} onClick={() => { setHomeSearchQuery(''); handleNavigate('userProfile', { userId: p.id }); }}
                                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {p.profile_picture ? (
                                  <img loading="lazy" src={p.profile_picture} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E6D5C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: '600', color: '#6B4632', fontFamily: fonts.sans }}>
                                    {(p.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans }}>{p.name}</div>
                                  {p.career && <div style={{ fontSize: '11px', color: '#9B8A7E', fontFamily: fonts.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.career}</div>}
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
                onClick={() => handleNavigate('home')}
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
        {currentView === 'home' && (
          <HomeView
            currentUser={currentUser}
            meetups={meetups}
            userSignups={userSignups}
            signups={signups}
            upcomingCoffeeChats={upcomingCoffeeChats}
            loadingMeetups={loadingMeetups}
            groupsCount={groupsCount}
            coffeeChatsCount={coffeeChatsCount}
            unreadMessageCount={unreadMessageCount}
            connectionRequests={connectionRequests}
            circleJoinRequests={circleJoinRequests}
            circleInvitations={circleInvitations}
            coffeeChatRequests={coffeeChatRequests}
            homeEventRecs={homeEventRecs}
            homeCircleRecs={homeCircleRecs}
            homePeopleRecs={homePeopleRecs}
            homeRecsLoaded={homeRecsLoaded}
            pendingRecaps={pendingRecaps}
            setPendingRecaps={setPendingRecaps}
            upcomingMeetups={upcomingMeetups}
            homeSearchQuery={homeSearchQuery}
            setHomeSearchQuery={setHomeSearchQuery}
            homeSearchResults={homeSearchResults}
            handleNavigate={handleNavigate}
            handleSignUp={handleSignUp}
            handleCancelSignup={handleCancelSignup}
            handleJoinVideoCall={handleJoinVideoCall}
            handleAcceptCircleJoin={handleAcceptCircleJoin}
            handleDeclineCircleJoin={handleDeclineCircleJoin}
            handleAcceptCircleInvitation={handleAcceptCircleInvitation}
            handleDeclineCircleInvitation={handleDeclineCircleInvitation}
            handleAcceptCoffeeChat={handleAcceptCoffeeChat}
            handleDeclineCoffeeChat={handleDeclineCoffeeChat}
            handleShowInterest={handleShowInterest}
            handleRemoveInterest={handleRemoveInterest}
            connections={connections}
            supabase={supabase}
            toast={toast}
          />
        )}
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
        {currentView === 'meetups' && <MeetupsView currentUser={currentUser} connections={connections} supabase={supabase} meetups={meetups} userSignups={userSignups} onNavigate={handleNavigate} initialView={meetupsInitialView} toast={toast} />}
        {currentView === 'pastMeetings' && <MeetupsView currentUser={currentUser} connections={connections} supabase={supabase} meetups={meetups} userSignups={userSignups} onNavigate={handleNavigate} pastOnly toast={toast} />}
        {currentView === 'connectionGroups' && <ConnectionGroupsView currentUser={currentUser} supabase={supabase} connections={connections} onNavigate={handleNavigate} toast={toast} />}
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
            onMeetupChanged={homeData.loadMeetupsFromDatabase}
            toast={toast}
          />
        )}
        {currentView === 'allPeople' && <AllPeopleView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} previousView={previousView} />}
        {currentView === 'allCircles' && <AllCirclesView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} />}
        {currentView === 'createCircle' && <CreateCircleView currentUser={currentUser} supabase={supabase} onNavigate={setCurrentView} />}
        {currentView === 'circleDetail' && <CircleDetailView currentUser={currentUser} supabase={supabase} onNavigate={handleNavigate} circleId={selectedCircleId} previousView={previousView} toast={toast} />}
        {currentView === 'coffeeChats' && <ScheduleMeetupView currentUser={currentUser} supabase={supabase} connections={connections} onNavigate={handleNavigate} previousView={previousView} initialType="coffee" />}
        {currentView === 'userProfile' && <UserProfileView currentUser={currentUser} supabase={supabase} userId={selectedUserId} onNavigate={handleNavigate} previousView={previousView} toast={toast} onConnectionRemoved={(userId) => {
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
