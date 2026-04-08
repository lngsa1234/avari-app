'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { createOnNavigate } from '@/lib/navigationAdapter'
import { parseLocalDate, formatEventTime, isEventPast, isEventLive, eventDateTimeToUTC, SESSION_GRACE_MINUTES, isCoffeeChatUpcoming } from '@/lib/dateUtils'
import { useToast } from '@/components/Toast'
import useHomeData from '@/hooks/useHomeData'
import useMeetups from '@/hooks/useMeetups'
import useCoffeeChats from '@/hooks/useCoffeeChats'
import useConnections from '@/hooks/useConnections'
import useJourney from '@/hooks/useJourney'
import HomeView from '@/components/HomeView'
import LiveFeed from '@/components/LiveFeed'

export default function HomePage() {
  const { profile: currentUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const handleNavigate = createOnNavigate(router, pathname)
  const hasLoadedRef = useRef(false)

  // Search state (lives here since search bar is in nav, results in HomeView)
  const [homeSearchQuery, setHomeSearchQuery] = useState('')

  // Initialize hooks
  const homeData = useHomeData(currentUser)
  const journey = useJourney(currentUser)
  const connectionsHook = useConnections(currentUser, {
    refreshConnectionRequests: homeData.loadConnectionRequests, toast
  })
  const coffeeChats = useCoffeeChats(currentUser, {
    refreshCoffeeChats: homeData.refreshCoffeeChats
  })
  const meetupsHook = useMeetups(currentUser, {
    refreshMeetups: homeData.loadMeetupsFromDatabase,
    refreshUserSignups: homeData.loadUserSignups,
    refreshSignups: homeData.loadSignupsForMeetups,
    meetups: homeData.meetups,
    userSignups: homeData.userSignups,
    toast
  })

  // Destructure
  const {
    meetups, loadingMeetups, signups, userSignups, upcomingCoffeeChats,
    groupsCount, coffeeChatsCount, unreadMessageCount,
    connectionRequests, circleJoinRequests, circleInvitations,
    homeEventRecs, homeCircleRecs, homePeopleRecs, homeRecsLoaded,
    handleAcceptCircleJoin, handleDeclineCircleJoin,
    handleAcceptCircleInvitation, handleDeclineCircleInvitation,
  } = homeData

  const { pendingRecaps, setPendingRecaps } = journey
  const { connections } = connectionsHook
  const { coffeeChatRequests, handleAcceptCoffeeChat, handleDeclineCoffeeChat } = coffeeChats
  const {
    handleSignUp, handleCancelSignup, handleJoinVideoCall,
  } = meetupsHook

  // Load data on mount
  useEffect(() => {
    if (hasLoadedRef.current || !currentUser?.id) return
    hasLoadedRef.current = true

    homeData.loadHomePageData()
    coffeeChats.loadCoffeeChatRequests()
    journey.loadPendingRecaps()
    connectionsHook.lazyLoadAll()
  }, [currentUser?.id])

  // Compute upcoming meetups (same logic as MainApp)
  const upcomingMeetups = useMemo(() => {
    const filteredMeetups = meetups.filter(m =>
      m.status !== 'cancelled' &&
      !isEventPast(m.date, m.time, m.timezone, parseInt(m.duration || '60'), SESSION_GRACE_MINUTES)
    )
    const coffeeMeetups = upcomingCoffeeChats.filter(chat => isCoffeeChatUpcoming(chat)).map(chat => {
      const otherPerson = chat._otherPerson
      const scheduledDate = chat.scheduled_time ? new Date(chat.scheduled_time) : new Date()
      const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`
      const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`
      return {
        id: `coffee-${chat.id}`,
        _isCoffeeChat: true,
        _coffeeChatId: chat.id,
        _coffeeChatData: chat,
        topic: chat.topic || 'Coffee Chat',
        date: dateStr,
        time: timeStr,
        duration: '30',
        format: 'virtual',
        status: chat.status,
        created_by: chat.requester_id,
        _otherPerson: otherPerson,
      }
    })
    return [...filteredMeetups, ...coffeeMeetups].sort((a, b) => {
      const dateA = a.date && a.time ? eventDateTimeToUTC(a.date, a.time, a.timezone) : parseLocalDate(a.date)
      const dateB = b.date && b.time ? eventDateTimeToUTC(b.date, b.time, b.timezone) : parseLocalDate(b.date)
      return dateA - dateB
    })
  }, [meetups, upcomingCoffeeChats])

  // Search results
  const homeSearchResults = useMemo(() => {
    const q = homeSearchQuery.toLowerCase().trim()
    if (!q) return null
    const matchedMeetups = upcomingMeetups.slice(0, 50).filter(m =>
      (m.topic || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    ).slice(0, 5)
    const matchedCircles = (connections || []).length > 0
      ? []
      : []
    const matchedPeople = (connections || []).filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.career || '').toLowerCase().includes(q)
    ).slice(0, 5)
    // Search circles from meetups that have circle data
    const circleSet = new Map()
    meetups.forEach(m => {
      if (m.connection_groups && (m.connection_groups.name || '').toLowerCase().includes(q)) {
        circleSet.set(m.connection_groups.id, m.connection_groups)
      }
    })
    return {
      meetups: matchedMeetups,
      circles: [...circleSet.values()].slice(0, 5),
      people: matchedPeople,
      total: matchedMeetups.length + circleSet.size + matchedPeople.length,
    }
  }, [homeSearchQuery, upcomingMeetups, connections, meetups])

  if (!currentUser) return <div style={{ minHeight: "50vh" }} />

  return (
    <>
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
        handleShowInterest={connectionsHook.handleShowInterest}
        handleRemoveInterest={connectionsHook.handleRemoveInterest}
        connections={connections}
        supabase={supabase}
        toast={toast}
      />
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
    </>
  )
}
