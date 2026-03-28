// components/LiveFeed.jsx
// Live Feed component — mocha v2 design matching UX reference

'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useLiveFeed } from '@/hooks/useLiveFeed'

// ─── Config ──────────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  coffee_live: {
    typeLabel: 'Coffee chat',
    getHeadline: (e) => `${firstName(e.actor)} & ${firstName(e.target)} are chatting`,
    getSubline: () => '1:1 coffee chat',
    isPrivate: true,
  },
  coffee_scheduled: {
    typeLabel: 'Coffee chat',
    getHeadline: (e) => {
      const accepted = e.metadata?.status === 'accepted'
      return accepted
        ? `${firstName(e.actor)} & ${firstName(e.target)} have a coffee chat`
        : `${firstName(e.actor)} scheduled a chat with ${firstName(e.target)}`
    },
    getSubline: (e) => {
      const accepted = e.metadata?.status === 'accepted'
      return accepted
        ? 'Confirmed ✓ · 1:1 coffee chat'
        : 'Pending · 1:1 coffee chat'
    },
    isPrivate: true,
    badgeEmoji: '☕',
  },
  member_joined: {
    typeLabel: 'New member',
    getHeadline: (e) => `${firstName(e.actor)} joined CircleW`,
    getSubline: (e) => {
      const parts = []
      if (e.metadata?.career) parts.push(e.metadata.career)
      if (e.metadata?.location) parts.push(e.metadata.location)
      if (parts.length > 0) return parts.join(' · ')
      return 'Welcome to the community!'
    },
    getTags: (e) => {
      const tags = []
      if (e.metadata?.industry) tags.push(e.metadata.industry)
      if (e.metadata?.hook) tags.push(e.metadata.hook)
      return tags
    },
    cta: 'Say hi',
    ctaStyle: 'solid',
    ctaAction: 'profile',
    badgeEmoji: '👋',
  },
  coffee_available: {
    typeLabel: 'Available',
    getHeadline: (e) => `${firstName(e.actor)} is free to chat`,
    getSubline: (e) => {
      const career = e.metadata?.career
      return career ? `${career} · Connect and schedule a coffee chat right now` : 'Connect and schedule a coffee chat right now'
    },
    cta: 'Connect',
    ctaStyle: 'solid',
    ctaAction: 'profile',
    badgeEmoji: '☕',
  },
  connection: {
    typeLabel: 'New connection',
    getHeadline: (e) => `${firstName(e.actor)} & ${firstName(e.target)} connected`,
    getSubline: () => 'They matched and made a new connection',
  },
  circle_join: {
    typeLabel: 'Circle activity',
    getHeadline: (e) => `${firstName(e.actor)} joined ${e.circle?.name || 'a circle'}`,
    getSubline: (e) => {
      const members = e.circle?.member_count;
      const max = e.circle?.max_members || 10;
      if (members != null) {
        const spots = max - members;
        return spots > 0 ? `${members}/${max} members · ${spots} spot${spots !== 1 ? 's' : ''} left` : `${members}/${max} members · Full`;
      }
      return e.circle?.name || 'Joined a circle';
    },
    cta: 'Join',
    ctaStyle: 'solid',
    badgeEmoji: '⭕',
  },
  circle_schedule: {
    typeLabel: 'Session scheduled',
    getHeadline: (e) => e.circle?.name || 'Circle Session',
    getSubline: (e) => {
      const d = e.metadata?.date
      const t = e.metadata?.time
      if (d && t) {
        try {
          const date = new Date(d + 'T00:00:00')
          const month = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const [h, m] = t.split(':').map(Number)
          const period = h >= 12 ? 'PM' : 'AM'
          const hour12 = h % 12 || 12
          return `New session · ${month} · ${hour12}:${String(m).padStart(2, '0')} ${period}`
        } catch { return 'New session scheduled' }
      }
      return 'New session scheduled'
    },
    cta: 'RSVP',
    ctaStyle: 'solid',
    badgeEmoji: '📅',
  },
  community_event: {
    typeLabel: 'Community event',
    getHeadline: (e) => `${firstName(e.actor)} hosts ${e.metadata?.title || 'a community event'}`,
    getSubline: (e) => {
      const parts = []
      const d = e.metadata?.date
      const t = e.metadata?.time
      if (d && t) {
        try {
          const date = new Date(d + 'T00:00:00')
          const month = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const [h, m] = t.split(':').map(Number)
          const period = h >= 12 ? 'PM' : 'AM'
          const hour12 = h % 12 || 12
          parts.push(`${month} · ${hour12}:${String(m).padStart(2, '0')} ${period}`)
        } catch { /* skip */ }
      }
      if (e.metadata?.location) parts.push(e.metadata.location)
      if (parts.length > 0) return parts.join(' · ') + ' · Save your spot'
      return 'Upcoming event'
    },
    cta: 'RSVP',
    ctaStyle: 'solid',
    badgeEmoji: '🎉',
  },
}

// Warm mocha avatar tones
const AVATAR_TONES = [
  { bg: '#f0e4d4', color: '#6b3d1e' },
  { bg: '#e8d5c0', color: '#5c3318' },
  { bg: '#dfd0b8', color: '#4a2912' },
  { bg: '#f5ebe0', color: '#7a4a28' },
  { bg: '#ecddc8', color: '#634020' },
  { bg: '#e2cdb4', color: '#55341a' },
  { bg: '#d8c4a4', color: '#4a2d14' },
]

function getAvatarTone(name) {
  return AVATAR_TONES[(name?.charCodeAt(0) ?? 65) % AVATAR_TONES.length]
}

function firstName(profile) {
  if (!profile?.name) return 'Someone'
  return profile.name.split(' ')[0]
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarCircle({ profile, size = 62, badgeEmoji, isLive }) {
  const tone = getAvatarTone(profile?.name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500, color: tone.color,
      background: tone.bg,
      border: '2.5px solid #fff',
      boxShadow: '0 2px 10px rgba(61,46,34,0.15)',
      overflow: 'hidden', position: 'relative',
    }}>
      {profile?.profile_picture
        ? <img src={profile.profile_picture} alt={profile.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(profile?.name)
      }
      {(badgeEmoji || isLive) && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 16, height: 16, borderRadius: '50%',
          border: '2px solid #faf7f4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9,
          background: isLive ? '#d97706' : '#f0e4d4',
        }}>
          {isLive ? '☕' : badgeEmoji}
        </span>
      )}
    </div>
  )
}

function DualAvatars({ actor, target, isLive, isMobile }) {
  const t1 = getAvatarTone(actor?.name)
  const t2 = getAvatarTone(target?.name)
  const size = isMobile ? 38 : 50
  const offset = isMobile ? 22 : 28
  return (
    <div style={{ position: 'relative', width: size + offset, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isMobile ? 14 : 17, fontWeight: 500, color: t1.color, background: t1.bg,
        border: '2px solid #fff', boxShadow: '0 2px 8px rgba(61,46,34,0.12)',
        overflow: 'hidden', position: 'absolute', left: 0, bottom: 0, zIndex: 2,
      }}>
        {actor?.profile_picture
          ? <img src={actor.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(actor?.name)
        }
        {isLive && (
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, borderRadius: '50%',
            border: '2px solid #fdf6ee', background: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 8 : 10,
          }}>☕</span>
        )}
      </div>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isMobile ? 14 : 17, fontWeight: 500, color: t2.color, background: t2.bg,
        border: '2px solid #fff', boxShadow: '0 2px 8px rgba(61,46,34,0.12)',
        overflow: 'hidden', position: 'absolute', left: offset, bottom: 0, zIndex: 1,
      }}>
        {target?.profile_picture
          ? <img src={target.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(target?.name)
        }
      </div>
    </div>
  )
}

function FeedItem({ event, onCta, isMobile, currentUserId }) {
  const config = EVENT_CONFIG[event.event_type]
  if (!config) return null

  const hasDualAvatar = event.target && (event.event_type === 'coffee_live' || event.event_type === 'coffee_scheduled' || event.event_type === 'connection')
  const headline = config.getHeadline(event)
  const subline = config.getSubline(event)

  // Names under avatars
  const namesBlock = hasDualAvatar ? (
    <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '10px' : '11px', color: '#8B7355', background: '#f0e8df', padding: '2px 8px', borderRadius: 12 }}>
        {firstName(event.actor)}
      </span>
      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '10px' : '11px', color: '#8B7355', background: '#f0e8df', padding: '2px 8px', borderRadius: 12 }}>
        {firstName(event.target)}
      </span>
    </div>
  ) : (
    <div style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '10px' : '11px', color: '#A08060', marginTop: 6 }}>
      {firstName(event.actor)}
    </div>
  )

  // Time or Live indicator
  const timePart = event.is_live ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: '#b45309',
        animation: 'feedPulse 1.6s ease-out infinite', display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '11px' : '12px', color: '#92400e', fontWeight: 600 }}>Live now</span>
    </span>
  ) : event._synthetic ? null : (
    <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: isMobile ? '11px' : '12px', color: '#A89080' }}>{timeAgo(event.created_at)}</span>
  )

  // CTA or Private badge
  let actionPart = null
  if (config.isPrivate) {
    actionPart = (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20,
        background: '#f0e8df', color: '#8b6a4a',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: isMobile ? '11px' : '11.5px', fontWeight: 500,
        border: '1px solid #e0d0be',
      }}>
        <span style={{ fontSize: 12 }}>🔒</span> Private
      </span>
    )
  } else if (config.cta && event.actor_id !== currentUserId) {
    const isOutline = config.ctaStyle === 'outline'
    actionPart = (
      <button
        onClick={(e) => { e.stopPropagation(); onCta?.(event) }}
        style={{
          padding: isMobile ? '7px 14px' : '8px 18px', borderRadius: 22,
          fontSize: isMobile ? '12px' : '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: '"DM Sans", sans-serif', whiteSpace: 'nowrap', letterSpacing: '0.15px',
          transition: 'all 0.15s ease',
          border: isOutline ? '1px solid #C4A882' : 'none',
          background: isOutline ? 'transparent' : '#5C4033',
          color: isOutline ? '#5C4033' : '#FAF5EF',
        }}
        onMouseEnter={e => {
          if (isOutline) { e.currentTarget.style.background = '#F0E8DF' }
          else { e.currentTarget.style.background = '#4A3228' }
        }}
        onMouseLeave={e => {
          if (isOutline) { e.currentTarget.style.background = 'transparent' }
          else { e.currentTarget.style.background = '#5C4033' }
        }}
      >
        {config.cta}
      </button>
    )
  }

  return (
    <div
      className="card-hover"
      style={{
        borderRadius: isMobile ? 16 : 22, padding: isMobile ? '14px' : '18px',
        border: event.is_live ? '1px solid #d4a574' : '1px solid #e8ddd6',
        background: event.is_live ? '#fdf6ee' : '#faf7f4',
        position: 'relative', overflow: 'hidden',
        cursor: config.cta ? 'pointer' : 'default',
        animation: 'feedSlideDown 0.38s cubic-bezier(0.34,1.4,0.64,1) both',
      }}
      onClick={() => config.cta && onCta?.(event)}
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: isMobile ? -20 : -30, right: isMobile ? -20 : -30,
        width: isMobile ? 70 : 100, height: isMobile ? 70 : 100, borderRadius: '50%',
        background: '#3d2e22', opacity: 0.04, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', gap: isMobile ? 12 : 16, alignItems: 'flex-start' }}>
        {/* Left: Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: isMobile ? 48 : 62 }}>
          {hasDualAvatar
            ? <DualAvatars actor={event.actor} target={event.target} isLive={event.is_live} isMobile={isMobile} />
            : <AvatarCircle profile={event.actor} size={isMobile ? 48 : 62} badgeEmoji={config.badgeEmoji} isLive={event.is_live} />
          }
          {namesBlock}
        </div>

        {/* Right: Content */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: isMobile ? '10px' : '10.5px', fontWeight: 600, letterSpacing: 0.6,
            textTransform: 'uppercase', color: '#a07850',
          }}>
            {config.typeLabel}
          </div>
          <div style={{
            fontFamily: '"Lora", serif',
            fontSize: isMobile ? '14px' : '15px', fontWeight: 600, color: '#523C2E',
            lineHeight: 1.3, marginTop: 3, letterSpacing: '0.15px',
          }}>
            {headline}
          </div>
          <div style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: isMobile ? '12px' : '13px', color: '#8B7355', marginTop: 4, lineHeight: 1.4,
          }}>
            {subline}
          </div>

          {/* Interest tags */}
          {config.getTags && (() => {
            const tags = config.getTags(event)
            return tags.length > 0 ? (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                {tags.map((tag, i) => (
                  <span key={i} style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: isMobile ? '10px' : '11px', fontWeight: 500,
                    color: '#5C4033', background: 'rgba(139,111,92,0.1)',
                    padding: '2px 8px', borderRadius: 100,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null
          })()}

          {/* Time row + action */}
          <div style={{
            marginTop: isMobile ? 8 : 10, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
          }}>
            {timePart || <span />}
            {actionPart}
          </div>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 14, borderRadius: 16,
      background: '#faf7f4', border: '1px solid #e8ddd6',
      animation: 'feedShimmer 1.5s ease-in-out infinite',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8ddd6', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        <div style={{ height: 10, width: '30%', background: '#ede6df', borderRadius: 6 }} />
        <div style={{ height: 14, width: '70%', background: '#e8ddd6', borderRadius: 6 }} />
        <div style={{ height: 12, width: '50%', background: '#ede6df', borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveFeed({ currentUserId, onCtaClick, maxHeight = null, maxItems = 5 }) {
  const { events, loading, hasMore, loadMore, liveCount } = useLiveFeed(currentUserId)
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sentinelRef = useCallback(node => {
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) loadMore()
    }, { threshold: 0.1 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <>
      <style>{`
        @keyframes feedPulse {
          0%   { box-shadow: 0 0 0 0 rgba(180,120,80,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(180,120,80,0); }
          100% { box-shadow: 0 0 0 0 rgba(180,120,80,0); }
        }
        @keyframes feedSlideDown {
          from { opacity: 0; transform: translateY(-14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes feedShimmer {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
      `}</style>

      <div style={{ fontFamily: '"DM Sans", sans-serif' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: '"Lora", serif', fontSize: isMobile ? '18px' : '20px', fontWeight: 600, color: '#3F1906', letterSpacing: '0.15px' }}>
              Live Feed
            </span>
            {liveCount > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: '"DM Sans", sans-serif',
                fontSize: 11, fontWeight: 600, color: '#92400e',
                background: '#fde8c8', padding: '3px 10px', borderRadius: 20,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#b45309',
                  animation: 'feedPulse 1.6s ease-out infinite', display: 'inline-block', flexShrink: 0,
                }} />
                {liveCount} live
              </span>
            )}
          </div>
        </div>

        {/* Feed list */}
        <div
          style={{
            ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingRight: 2,
            scrollbarWidth: 'thin',
            scrollbarColor: '#e8ddd6 transparent',
          }}
        >
          {loading && events.length === 0
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)
            : events.length === 0
              ? (
                <div style={{
                  textAlign: 'center', padding: '32px 16px',
                  color: '#A89080', fontFamily: '"DM Sans", sans-serif', fontSize: 14,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>☕</div>
                  No activity yet — be the first to connect!
                </div>
              )
              : (expanded ? events : events.slice(0, maxItems)).map((event, i) => (
                  <FeedItem
                    key={event.id}
                    event={event}
                    onCta={onCtaClick}
                    isMobile={isMobile}
                    currentUserId={currentUserId}
                  />
                ))
          }

          {!expanded && !loading && events.length > maxItems && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif', fontSize: 14, color: '#8B6F5C',
                padding: '12px 0', textAlign: 'center', width: '100%',
              }}
            >
              See all activity ({events.length}) &gt;
            </button>
          )}

          {expanded && !loading && hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}

          {loading && events.length > 0 && (
            <div style={{ textAlign: 'center', padding: '8px 0', color: '#b09a8a', fontSize: 13 }}>
              Loading...
            </div>
          )}
        </div>
      </div>
    </>
  )
}
