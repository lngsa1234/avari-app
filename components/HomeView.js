'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Coffee, Users, User, Heart, Video, Sparkles, ChevronRight } from 'lucide-react'
import { parseLocalDate, formatEventTime, isEventLive, eventDateTimeToUTC } from '@/lib/dateUtils'
import { fonts } from '@/lib/designTokens'
import NudgeBanner from './NudgeBanner'

// --- Helper functions ---

function getTimeBasedGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { greeting: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { greeting: 'Good afternoon', emoji: '🌤️' }
  return { greeting: 'Good evening', emoji: '🌙' }
}

function getNextUpcomingMeeting(meetupsList, userSignupsList) {
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
        const minutesUntil = Math.round((meetupDate - now) / (1000 * 60))
        return { ...meetup, minutesUntil }
      }
    } catch (err) {
      console.error('Error parsing meetup date:', err)
    }
  }
  return null
}

function getUpcomingMeetingCount(meetupsList, userSignupsList) {
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
}

function formatTime(time24) {
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

function formatDate(dateStr) {
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

// --- Main component ---

export default function HomeView({
  currentUser,
  // Data from useHomeData
  meetups, userSignups, signups, upcomingCoffeeChats,
  loadingMeetups,
  groupsCount, coffeeChatsCount,
  unreadMessageCount,
  connectionRequests, circleJoinRequests, circleInvitations,
  coffeeChatRequests,
  homeEventRecs, homeCircleRecs, homePeopleRecs, homeRecsLoaded,
  pendingRecaps, setPendingRecaps,
  // Derived data (computed in MainApp)
  upcomingMeetups,
  homeSearchQuery, setHomeSearchQuery,
  homeSearchResults,
  // Extra data
  connections,
  // Handlers
  handleNavigate,
  handleSignUp, handleCancelSignup, handleJoinVideoCall,
  handleAcceptCircleJoin, handleDeclineCircleJoin,
  handleAcceptCircleInvitation, handleDeclineCircleInvitation,
  handleAcceptCoffeeChat, handleDeclineCoffeeChat,
  handleShowInterest, handleRemoveInterest,
  // Other
  supabase,
  toast,
}) {
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
    fontFamily: fonts.serif,
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
          fontFamily: fonts.serif,
          fontSize: isMobile ? '9px' : '11px',
          fontWeight: '600',
          color: isHighlight ? '#FFF' : '#605045',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>{dayLabel}</span>
        <span style={{
          fontFamily: fonts.serif,
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: '500',
          color: isHighlight ? '#FFF' : '#605045',
          lineHeight: isMobile ? '26px' : '33px',
          letterSpacing: '0.15px',
        }}>{day}</span>
        <span style={{
          fontFamily: fonts.serif,
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
      fontFamily: fonts.serif,
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
      fontFamily: fonts.serif,
      fontSize: isMobile ? '24px' : '32px',
      fontWeight: '500',
      color: '#584233',
      letterSpacing: '0.15px',
      margin: 0,
      lineHeight: 1.28,
    },
    tagline: {
      fontFamily: fonts.serif,
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: '500',
      margin: 0,
      marginTop: '6px',
      background: 'linear-gradient(89.8deg, #7E654D 27.14%, #9C8068 72.64%, #B8A089 100%)',
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
      fontFamily: fonts.serif,
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: '500',
      color: '#3F1906',
      margin: 0,
      letterSpacing: '0.15px',
    },
    seeAllBtn: {
      fontFamily: fonts.serif,
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
          fontFamily: fonts.serif,
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
                fontFamily: fonts.serif,
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
                fontFamily: fonts.serif,
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
              fontFamily: fonts.serif,
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
                fontFamily: fonts.serif,
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
                            fontFamily: fonts.serif, fontSize: isMobile ? '15px' : '24px', fontWeight: '700', color: '#523C2E',
                            marginRight: '10px', flexShrink: 0,
                          }}>
                            {(user.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontFamily: fonts.serif, fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '20px' }}>{user.name}</h4>
                          {isCoffeeChatRequest ? (
                            <>
                              <p style={{ fontFamily: fonts.serif, fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
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
                            <p style={{ fontFamily: fonts.serif, fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
                              wants to join <strong>{request.circleName}</strong>
                            </p>
                          ) : isCircleInvitation ? (
                            <p style={{ fontFamily: fonts.serif, fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>
                              invited you to <strong>{request.circleName}</strong>
                            </p>
                          ) : (
                            <p style={{ fontFamily: fonts.serif, fontSize: isMobile ? '12px' : '14px', color: '#523C2E', margin: 0, letterSpacing: '0.15px', lineHeight: '18px' }}>{user.career || 'Professional'}</p>
                          )}
                          {!isCircleJoin && !isCircleInvitation && !isCoffeeChatRequest && user.city && (
                            <p style={{ fontSize: '11px', color: '#B8A089', margin: 0 }}>{user.city}{user.state ? `, ${user.state}` : ''}</p>
                          )}
                          {(isCircleJoin || isCircleInvitation) && user.career && (
                            <p style={{ fontSize: '11px', color: '#B8A089', margin: 0 }}>{user.career}</p>
                          )}
                        </div>
                        {!isMobile && (
                          <span style={{ fontFamily: fonts.serif, fontSize: '14px', fontWeight: '600', color: 'rgba(107, 86, 71, 0.77)', letterSpacing: '0.15px', marginLeft: '8px', flexShrink: 0 }}>· {timeAgo === 'Today' ? 'new' : timeAgo}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: '12px' }}>
                        {isMobile && (
                          <span style={{ fontFamily: fonts.serif, fontSize: '12px', fontWeight: '600', color: 'rgba(107, 86, 71, 0.77)', letterSpacing: '0.15px' }}>· {timeAgo === 'Today' ? 'new' : timeAgo}</span>
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
                                fontFamily: fonts.serif,
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
                                fontFamily: fonts.serif,
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
                                fontFamily: fonts.serif,
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
                                fontFamily: fonts.serif,
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
                                fontFamily: fonts.serif,
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
                                fontFamily: fonts.serif,
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
                              fontFamily: fonts.serif,
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
                  onClick={() => handleNavigate('discover')}
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
                onClick={() => handleNavigate('meetups')}
                style={homeStyles.seeAllBtn}
              >
                View all <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {loadingMeetups ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                {[0, 1].map(i => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: isMobile ? '12px 14px' : '16px 20px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(139,111,92,0.06)',
                  }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EDE6DF', flexShrink: 0, animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ width: '60%', height: '14px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '6px', animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.2}s` }} />
                      <div style={{ width: '40%', height: '10px', borderRadius: '4px', background: '#F5EDE4', animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.2 + 0.1}s` }} />
                    </div>
                  </div>
                ))}
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
                            fontFamily: fonts.sans,
                            fontSize: '11px', fontWeight: '600',
                            textTransform: 'uppercase', letterSpacing: '1.2px',
                            color: '#8B6347', marginBottom: '2px',
                          }}>{cardMonth}</span>
                          <span style={{
                            fontFamily: fonts.serif,
                            fontSize: '26px', fontWeight: '600',
                            color: '#3B2314', lineHeight: 1,
                          }}>{cardDay}</span>
                          <span style={{
                            fontFamily: fonts.sans,
                            fontSize: '11px', fontWeight: '500',
                            color: '#9B8A7E', marginTop: '3px',
                          }}>{cardWeekday}</span>
                        </div>

                        {/* Content area */}
                        <div style={{ flex: 1, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                          <h4 style={{
                            fontFamily: fonts.serif, fontSize: '16px', fontWeight: '600',
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
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.sans, fontSize: '9px', fontWeight: '600', color: 'white', background: '#8B6347' }}>
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
                                        fontFamily: fonts.sans, fontSize: '9px', fontWeight: '600',
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
                                      fontFamily: fonts.sans, fontSize: '9px', fontWeight: '600',
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
                                fontFamily: fonts.sans, fontSize: '13px', fontWeight: '600',
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
                                fontFamily: fonts.sans, fontSize: '13px', fontWeight: '600',
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
                          fontFamily: fonts.serif, fontSize: '20px', fontWeight: '600',
                          color: '#523C2E', margin: 0, lineHeight: '20px', letterSpacing: '0.15px',
                        }}>
                          {meetup.topic || 'Community Event'}
                        </h4>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: fonts.serif, fontSize: '15px', color: '#523C2E' }}>
                            <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            <span style={{ fontWeight: '600' }}>{formatEventTime(meetup.date, meetup.time, meetup.timezone, { showTimezone: false })}</span>
                          </div>
                          {meetup.location && (
                            <>
                              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#D4B896', flexShrink: 0 }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: fonts.serif, fontSize: '15px', color: '#523C2E' }}>
                                <svg width="18" height="18" fill="none" stroke="#605045" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <span>{meetup.location}</span>
                              </div>
                            </>
                          )}
                          {!meetup.location && (
                            <>
                              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#D4B896', flexShrink: 0 }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: fonts.serif, fontSize: '15px', color: '#523C2E' }}>
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
                                      fontFamily: fonts.serif, fontSize: '10px', fontWeight: '700',
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
                                    fontFamily: fonts.serif, fontSize: '10px', fontWeight: '700',
                                    color: '#764D31',
                                    background: 'linear-gradient(180deg, rgba(158, 120, 104, 0.2) 99.99%, rgba(241, 225, 213, 0.2) 100%)',
                                    boxShadow: '0px 1px 4px #9E7868',
                                  }}>
                                    +{attendeeCount - 3}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontFamily: fonts.serif, fontSize: '15px', fontWeight: '600', color: '#523C2E', opacity: 0.82, letterSpacing: '0.15px' }}>
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
                              fontFamily: fonts.serif, fontStyle: 'italic', fontSize: '16px', fontWeight: '700',
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
                              fontFamily: fonts.serif, fontStyle: 'italic', fontSize: '16px', fontWeight: '700',
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
                style={{ fontFamily: fonts.sans, fontSize: '13px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
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
              position: 'relative',
              ...(isMobile ? { maskImage: 'linear-gradient(to right, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)' } : { display: 'grid', gridTemplateColumns: `repeat(${Math.min(filteredPeopleRecs.length, 3)}, 1fr)` }),
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
                    <p style={{ fontFamily: fonts.serif, fontSize: isMobile ? '14px' : '16px', fontWeight: '600', color: '#3F1906', margin: '0 0 2px 0', lineHeight: isMobile ? '18px' : '22px' }}>
                      {rec.profile?.name || 'Someone'}
                    </p>
                    <p style={{ fontFamily: fonts.sans, fontSize: isMobile ? '11px' : '13px', color: '#6B5344', margin: 0, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '120px' : '160px' }}>
                      {rec.profile?.career || 'Community member'}
                    </p>
                    {rec.profile?.city && (
                      <p style={{ fontFamily: fonts.sans, fontSize: isMobile ? '10px' : '11px', color: '#A89080', margin: '2px 0 0 0', lineHeight: '14px' }}>
                        {rec.profile.city}{rec.profile.state ? `, ${rec.profile.state}` : ''}
                      </p>
                    )}
                  </div>
                  {rec.match_reasons?.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
                      {rec.match_reasons.slice(0, isMobile ? 2 : 3).map((r, i) => (
                        <span key={i} style={{
                          fontFamily: fonts.sans,
                          fontSize: isMobile ? '8px' : '10px', fontWeight: 500,
                          backgroundColor: 'rgba(139, 111, 92, 0.1)', color: '#5C4033',
                          padding: isMobile ? '1px 6px' : '2px 8px', borderRadius: '100px',
                        }}>
                          {r.reason}
                        </span>
                      ))}
                    </div>
                  ) : rec.match_score > 0 ? (
                    <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '8px' : '11px', backgroundColor: 'rgba(139, 111, 92, 0.08)', color: '#8B7355', padding: isMobile ? '1px 6px' : '3px 10px', borderRadius: '100px' }}>
                      {Math.round(rec.match_score * 100)}% match
                    </span>
                  ) : null}
                  {rec.sharedMeetups > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      <Users style={{ width: isMobile ? '10px' : '12px', height: isMobile ? '10px' : '12px', color: '#A89080' }} />
                      <span style={{ fontFamily: fonts.sans, fontSize: isMobile ? '8px' : '10px', color: '#A89080' }}>
                        {rec.sharedMeetups} shared {rec.sharedMeetups === 1 ? 'meetup' : 'meetups'}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNavigate('userProfile', { userId: rec.recommended_user_id }) }}
                    style={{
                      marginTop: '2px',
                      padding: isMobile ? '10px 16px' : '10px 20px',
                      minHeight: '44px',
                      background: '#5C4033', color: '#FAF5EF',
                      border: 'none', borderRadius: '20px',
                      fontFamily: fonts.sans,
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
                style={{ fontFamily: fonts.sans, fontSize: '13px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
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
                  color: '#2C1F15', margin: 0, fontFamily: fonts.serif,
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
                      padding: isMobile ? '8px 14px' : '9px 16px', borderRadius: '14px',
                      fontSize: isMobile ? '11px' : '12px', fontWeight: '600',
                      cursor: 'pointer', fontFamily: fonts.sans,
                      background: '#3D2E22', color: '#FAF7F4',
                      border: 'none', transition: 'background 0.15s',
                      minHeight: '44px',
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
            <p style={{ fontFamily: fonts.serif, fontSize: '16px', fontWeight: '600', color: '#5E4530', margin: '0 0 6px 0' }}>
              Your recommendations are brewing
            </p>
            <p style={{ fontFamily: fonts.sans, fontSize: '14px', color: '#8B7355', margin: '0 0 16px 0' }}>
              Attend a meetup or join a circle to unlock personalized suggestions
            </p>
            <span
              onClick={() => handleNavigate('discover')}
              style={{ fontFamily: fonts.sans, fontSize: '14px', fontWeight: '600', color: '#8B6F5C', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
