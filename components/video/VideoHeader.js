'use client';

import { useState, useRef, useEffect } from 'react';

/* ─────────────────── SVG Icons ─────────────────── */
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const SpeakerViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <rect x="15" y="14" width="5" height="4" rx="1" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SignalIcon = ({ quality }) => {
  const getColor = () => {
    switch (quality) {
      case 'excellent':
      case 'good':
        return '#6BBF6A';
      case 'fair':
        return '#D4A574';
      case 'poor':
        return '#E85D4A';
      default:
        return '#888';
    }
  };

  const color = getColor();
  const isGood = quality === 'excellent' || quality === 'good';
  const isFair = quality === 'fair';

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <rect x="2" y="16" width="4" height="6" rx="1" />
      <rect x="8" y="11" width="4" height="11" rx="1" opacity={quality === 'poor' ? 0.25 : 1} />
      <rect x="14" y="6" width="4" height="16" rx="1" opacity={!isGood ? 0.25 : 1} />
      <rect x="20" y="2" width="4" height="20" rx="1" opacity={quality !== 'excellent' ? 0.25 : 1} />
    </svg>
  );
};

/* ─── Tooltip ─── */
const Tooltip = ({ text, children, position = 'bottom' }) => {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none animate-fade-in ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            background: 'rgba(30, 20, 15, 0.92)',
            color: '#F5EDE4',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

/* ─── Dropdown Menu ─── */
const DropdownMenu = ({ items, onClose, anchorRef }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={ref}
      className="absolute top-full mt-2 right-0 min-w-[180px] rounded-xl p-1.5 z-50 animate-slide-up"
      style={{
        background: 'rgba(45, 30, 20, 0.96)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,237,228,0.08)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
          className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            item.active
              ? 'text-amber-400'
              : 'text-stone-200 hover:bg-white/10'
          }`}
        >
          <span className="opacity-80">{item.icon}</span>
          <span>{item.label}</span>
          {item.active && (
            <span className="ml-auto text-xs opacity-60">ON</span>
          )}
        </button>
      ))}
    </div>
  );
};

/* ─── Format Duration ─── */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/* ─── Get Connection Label ─── */
function getConnectionLabel(quality) {
  switch (quality) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Poor';
    default:
      return '';
  }
}

/**
 * Video Call Header - Redesigned
 * Glass-morphism header with inline metadata pills
 */
export default function VideoHeader({
  title,
  subtitle,
  brandName,
  callType,
  participantCount = 0,
  providerBadge,
  isConnecting = false,
  isTranscribing = false,
  isRecording = false,
  showGridToggle = true,
  gridView = true,
  onToggleView,
  // Meeting info props
  meetingId,
  callDuration = 0,
  connectionQuality = 'good',
}) {
  const [copied, setCopied] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const viewRef = useRef(null);

  const handleCopyMeetingId = async () => {
    if (meetingId) {
      try {
        await navigator.clipboard.writeText(meetingId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
    }
  };

  const truncatedMeetingId = meetingId
    ? meetingId.length > 14
      ? `${meetingId.slice(0, 14)}...`
      : meetingId
    : null;

  return (
    <div
      className="flex items-center justify-between px-5 py-3 relative z-50 animate-slide-up"
      style={{
        background: 'rgba(45, 30, 20, 0.6)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderBottom: '1px solid rgba(245,237,228,0.06)',
      }}
    >
      {/* Left: Logo + Room info + Metadata pills */}
      <div className="flex items-center gap-3.5">
        {/* CircleW Logo - W in a circle */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #D4A574 0%, #8B5E3C 100%)',
            boxShadow: '0 2px 8px rgba(212,165,116,0.25)',
          }}
        >
          W
        </div>

        {/* Room details */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {/* Event type badge */}
            <span
              className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md"
              style={{
                letterSpacing: '0.6px',
                background: callType === 'coffee' ? 'rgba(212,165,116,0.2)' : callType === 'circle' ? 'rgba(212,165,116,0.2)' : 'rgba(212,165,116,0.2)',
                color: '#D4A574',
              }}
            >
              {callType === 'coffee' ? '1:1' : callType === 'circle' ? 'Circle' : 'Event'}
            </span>
          </div>
          {/* Topic / title */}
          <span
            className="text-sm font-semibold"
            style={{ color: '#F5EDE4', letterSpacing: '-0.01em' }}
          >
            {title || brandName || 'Video Call'}
          </span>
          {subtitle && (
            <span
              className="text-xs"
              style={{ color: 'rgba(245,237,228,0.45)' }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Separator */}
        <div
          className="w-px h-8 mx-1.5 hidden sm:block"
          style={{ background: 'rgba(245,237,228,0.08)' }}
        />

        {/* Metadata pills */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Duration */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums"
            style={{
              background: 'rgba(245,237,228,0.06)',
              color: 'rgba(245,237,228,0.5)',
            }}
          >
            <ClockIcon />
            {formatDuration(callDuration)}
          </div>

          {/* Participants */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              background: 'rgba(245,237,228,0.06)',
              color: 'rgba(245,237,228,0.5)',
            }}
          >
            <PeopleIcon />
            {participantCount}
          </div>

          {/* Connection quality */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              background: 'rgba(245,237,228,0.06)',
              color:
                connectionQuality === 'excellent' || connectionQuality === 'good'
                  ? '#6BBF6A'
                  : connectionQuality === 'fair'
                  ? '#D4A574'
                  : connectionQuality === 'poor'
                  ? '#E85D4A'
                  : 'rgba(245,237,228,0.5)',
            }}
          >
            <SignalIcon quality={connectionQuality} />
            {getConnectionLabel(connectionQuality)}
          </div>

          {/* Provider badge */}
          {providerBadge && (
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(212,165,116,0.15)',
                color: '#D4A574',
              }}
            >
              {providerBadge}
            </div>
          )}
        </div>

        {/* Status indicators - mobile visible */}
        <div className="flex items-center gap-2 sm:hidden">
          {isConnecting && (
            <span className="text-white/70 text-xs animate-pulse">
              Connecting...
            </span>
          )}
        </div>
      </div>

      {/* Right: Status indicators + View toggle */}
      <div className="flex items-center gap-3">
        {/* Status indicators - desktop */}
        <div className="hidden sm:flex items-center gap-3">
          {isConnecting && (
            <span
              className="text-xs font-medium animate-pulse"
              style={{ color: 'rgba(245,237,228,0.7)' }}
            >
              Connecting...
            </span>
          )}
          {isTranscribing && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(107,191,106,0.15)',
                color: '#6BBF6A',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              CC
            </div>
          )}
          {isRecording && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                background: 'rgba(232,93,74,0.15)',
                color: '#E85D4A',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </div>
          )}
        </div>

        {/* View mode selector */}
        {showGridToggle && onToggleView && (
          <div ref={viewRef} className="relative">
            <button
              onClick={() => setShowViewMenu(!showViewMenu)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
              style={{
                background: 'rgba(245,237,228,0.08)',
                border: '1px solid rgba(245,237,228,0.08)',
                color: '#F5EDE4',
              }}
            >
              {gridView ? <GridIcon /> : <SpeakerViewIcon />}
              <span className="hidden sm:inline">
                {gridView ? 'Grid' : 'Speaker'}
              </span>
              <ChevronDown />
            </button>
            {showViewMenu && (
              <DropdownMenu
                anchorRef={viewRef}
                onClose={() => setShowViewMenu(false)}
                items={[
                  {
                    icon: <SpeakerViewIcon />,
                    label: 'Speaker View',
                    active: !gridView,
                    onClick: () => {
                      if (gridView) onToggleView();
                    },
                  },
                  {
                    icon: <GridIcon />,
                    label: 'Grid View',
                    active: gridView,
                    onClick: () => {
                      if (!gridView) onToggleView();
                    },
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
