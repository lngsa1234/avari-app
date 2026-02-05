'use client';

/* ─── Icons ─── */
const MicIcon = ({ muted }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={muted ? 'rgba(245,237,228,0.3)' : '#F5EDE4'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {muted ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      </>
    )}
  </svg>
);

const CamIcon = ({ off }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={off ? 'rgba(245,237,228,0.3)' : '#F5EDE4'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {off ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      </>
    ) : (
      <>
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    )}
  </svg>
);

const ScreenIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#D4A574"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

/* ─── Color tokens ─── */
const C = {
  bg: '#1E1410',
  text: '#F5EDE4',
  textMuted: 'rgba(245, 237, 228, 0.5)',
  textFaint: 'rgba(245, 237, 228, 0.3)',
  accent: '#D4A574',
  accentSoft: 'rgba(212, 165, 116, 0.15)',
  green: '#6BBF6A',
  greenSoft: 'rgba(107, 191, 106, 0.12)',
  red: '#E85D4A',
  redSoft: 'rgba(232, 93, 74, 0.1)',
  surfaceHover: 'rgba(245, 237, 228, 0.06)',
};

/**
 * Avatar Component
 */
const Avatar = ({ name, color, size = 40, online }) => {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="relative flex-shrink-0">
      <div
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          background: color,
          fontSize: size * 0.38,
          letterSpacing: '-0.02em',
        }}
      >
        {initial}
      </div>
      {online !== undefined && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: online ? C.green : C.textFaint,
            border: `2.5px solid ${C.bg}`,
          }}
        />
      )}
    </div>
  );
};

/**
 * Participant Row Component
 */
const ParticipantRow = ({ name, role, isHost, mic, cam, screen, color, online, index }) => {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5 animate-slide-up"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Avatar */}
      <Avatar name={name} color={color} size={40} online={online} />

      {/* Name & role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: C.text, letterSpacing: '-0.01em' }}
          >
            {name}
          </span>
          {role && (
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: C.accentSoft,
                color: C.accent,
                letterSpacing: '0.5px',
              }}
            >
              {role}
            </span>
          )}
        </div>
        {isHost && (
          <span className="text-xs font-medium" style={{ color: C.textFaint }}>
            You
          </span>
        )}
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {screen && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: C.accentSoft }}
          >
            <ScreenIcon />
          </div>
        )}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: mic ? C.greenSoft : C.redSoft }}
        >
          <MicIcon muted={!mic} />
        </div>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: cam ? C.greenSoft : 'rgba(245,237,228,0.04)' }}
        >
          <CamIcon off={!cam} />
        </div>
      </div>
    </div>
  );
};

/**
 * Participants Panel - Redesigned
 * Shows list of participants with styled avatars and status icons
 */
export default function ParticipantsPanel({
  currentUser,
  remoteParticipants = [],
  isMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  participantCount = 0,
}) {
  const allConnected = remoteParticipants.every((p) => p.connectionQuality !== 'poor');

  return (
    <div className="flex-1 overflow-y-auto p-3.5 scrollbar-thin">
      {/* Header with count and status */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: C.textMuted }}
        >
          {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
        </span>
        {remoteParticipants.length > 0 && allConnected && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold"
            style={{ background: C.greenSoft, color: C.green }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: C.green }}
            />
            All Connected
          </div>
        )}
      </div>

      {/* Participants list */}
      <div className="flex flex-col gap-1">
        {/* Current User */}
        <ParticipantRow
          name={currentUser?.name || currentUser?.email?.split('@')[0] || 'You'}
          role="Host"
          isHost={true}
          mic={!isMuted}
          cam={!isVideoOff}
          screen={isScreenSharing}
          color="linear-gradient(135deg, #D4A574, #8B5E3C)"
          online={true}
          index={0}
        />

        {/* Remote Participants */}
        {remoteParticipants.map((participant, i) => (
          <ParticipantRow
            key={participant.id || participant.uid}
            name={participant.name || participant.identity || 'Anonymous'}
            role={null}
            isHost={false}
            mic={participant.hasAudio}
            cam={participant.hasVideo}
            screen={participant.hasScreen}
            color="linear-gradient(135deg, #C49A6C, #7B5E3C)"
            online={participant.connectionQuality !== 'poor'}
            index={i + 1}
          />
        ))}
      </div>

      {/* Empty state */}
      {remoteParticipants.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-8 gap-2">
          <span className="text-sm font-medium" style={{ color: C.textMuted }}>
            Waiting for others to join...
          </span>
          <span className="text-xs" style={{ color: C.textFaint }}>
            Share the meeting link to invite people
          </span>
        </div>
      )}
    </div>
  );
}
