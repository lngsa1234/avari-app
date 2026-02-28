'use client';

import { useState, useRef, useEffect } from 'react';

/* ─── SVG Icons ─── */
const MicIcon = ({ muted }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {muted ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    )}
  </svg>
);

const CameraIcon = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const ScreenShareIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    {active ? (
      <polyline points="16 10 12 14 8 10" />
    ) : (
      <polyline points="8 10 12 6 16 10" />
    )}
    <line x1="12" y1={active ? "14" : "6"} x2="12" y2={active ? "6" : "14"} />
  </svg>
);

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const RecordIcon = ({ recording }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={recording ? "#ef4444" : "none"} stroke={recording ? "#ef4444" : "currentColor"} strokeWidth="2">
    <circle cx="12" cy="12" r="8" />
    {recording && <circle cx="12" cy="12" r="4" fill="#fff" />}
  </svg>
);

const CaptionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <path d="M7 12h2m4 0h4M7 16h10" />
  </svg>
);

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

const TopicsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const BlurIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const LanguageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const LeaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ─── Tooltip Component ─── */
const Tooltip = ({ text, children, show = true }) => {
  const [visible, setVisible] = useState(false);

  if (!show || !text) return children;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-stone-900 text-stone-100 text-xs font-medium rounded-md z-50 shadow-lg animate-fade-in text-center max-w-[200px] w-max">
          {text}
        </div>
      )}
    </div>
  );
};

/* ─── Control Button ─── */
const ControlBtn = ({
  icon,
  label,
  active,
  danger,
  onClick,
  disabled,
  badge,
  tooltip,
  dropdown,
  className = '',
}) => {
  return (
    <Tooltip text={tooltip}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          flex items-center justify-center gap-1.5 border-none cursor-pointer
          transition-all duration-200 ease-out font-medium text-sm rounded-xl
          ${label ? 'px-3 py-2 sm:px-4 sm:py-2.5' : 'p-2 sm:p-2.5'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${danger
            ? 'text-white hover:brightness-90'
            : active
              ? 'bg-stone-100 text-stone-800 hover:bg-stone-200'
              : 'bg-stone-700/50 text-stone-100 hover:bg-stone-600/70'
          }
          hover:scale-105 active:scale-95
          ${className}
        `}
        style={danger ? { background: '#E85D4A' } : undefined}
      >
        <span className="relative">
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {label && <span>{label}</span>}
        {dropdown && <ChevronDown />}
      </button>
    </Tooltip>
  );
};

/* ─── Dropdown Menu ─── */
const DropdownMenu = ({ items, onClose, anchorRef }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-3 bg-stone-800/95 backdrop-blur-xl rounded-xl p-1.5 min-w-[200px] shadow-2xl border border-stone-700/50 animate-slide-up z-50"
    >
      {items.map((item, i) => (
        <MenuItem
          key={i}
          {...item}
          onClick={() => {
            item.onClick?.();
            if (!item.keepOpen) onClose();
          }}
        />
      ))}
    </div>
  );
};

const MenuItem = ({ icon, label, onClick, active, danger, rightLabel }) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full px-3 py-2.5 border-none cursor-pointer
        rounded-lg font-medium text-sm transition-all duration-150
        ${danger ? 'text-red-400 hover:bg-red-500/10' : active ? 'text-amber-400' : 'text-stone-100'}
        hover:bg-stone-700/50
      `}
    >
      <span className="opacity-80">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {active && <span className="text-xs opacity-60">ON</span>}
      {rightLabel && <span className="text-xs opacity-60">{rightLabel}</span>}
    </button>
  );
};

/* ─── Divider ─── */
const Divider = () => (
  <div className="w-px h-7 bg-stone-600/50 mx-1 flex-shrink-0" />
);

/* ─── Device Selector Dropdown ─── */
const DeviceSelector = ({ devices, selectedDevice, onChange, disabled, type }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (devices.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1 rounded-lg bg-stone-700/30 hover:bg-stone-600/50 text-stone-300 transition-all disabled:opacity-50"
      >
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-stone-800/95 backdrop-blur-xl rounded-xl p-1.5 min-w-[180px] shadow-2xl border border-stone-700/50 animate-slide-up z-50">
          <div className="px-3 py-1.5 text-xs text-stone-400 font-medium uppercase tracking-wide">
            {type === 'audio' ? 'Microphone' : 'Camera'}
          </div>
          {devices.map((device, i) => (
            <button
              key={device.deviceId}
              onClick={() => {
                onChange(device.deviceId);
                setOpen(false);
              }}
              className={`
                flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-all
                ${selectedDevice === device.deviceId ? 'bg-amber-600/20 text-amber-400' : 'text-stone-100 hover:bg-stone-700/50'}
              `}
            >
              <span className="truncate">{device.label || `${type === 'audio' ? 'Mic' : 'Camera'} ${i + 1}`}</span>
              {selectedDevice === device.deviceId && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-auto flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Main Control Bar ─── */
export default function ControlBar({
  // State
  isMuted,
  isVideoOff,
  isBlurEnabled,
  isBlurSupported,
  isBlurLoading,
  isScreenSharing,
  isOtherSharing = false,
  isScreenShareSupported = true,
  screenSharerName = '',
  isRecording,
  recordingTime,
  isTranscribing,
  isSpeechSupported,
  isSafari,
  showChat,
  showTopics,
  showParticipants,
  messagesCount = 0,
  participantCount = 0,
  transcriptionLanguage = 'en-US',

  // Device selection
  videoDevices = [],
  audioDevices = [],
  selectedVideoDevice = '',
  selectedAudioDevice = '',
  onVideoDeviceChange,
  onAudioDeviceChange,
  isVideoDeviceSwitching = false,
  isAudioDeviceSwitching = false,

  // Feature flags
  features = {},

  // Handlers
  onToggleMute,
  onToggleVideo,
  onToggleBlur,
  onToggleScreenShare,
  onToggleRecording,
  onToggleTranscription,
  onToggleChat,
  onToggleTopics,
  onToggleParticipants,
  onLanguageChange,
  onLeave,

  // Utilities
  formatTime,
}) {
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  // Build "More" menu items
  const moreMenuItems = [];

  if (features.recording) {
    moreMenuItems.push({
      icon: <RecordIcon recording={isRecording} />,
      label: isRecording ? 'Stop Recording' : 'Record Meeting',
      active: isRecording,
      danger: isRecording,
      onClick: onToggleRecording,
    });
  }

  if (features.transcription && isSpeechSupported) {
    moreMenuItems.push({
      icon: <CaptionIcon />,
      label: 'Captions',
      active: isTranscribing,
      onClick: onToggleTranscription,
    });
  }

  if (features.transcription && isSpeechSupported) {
    moreMenuItems.push({
      icon: <LanguageIcon />,
      label: 'Language',
      rightLabel: transcriptionLanguage === 'zh-CN' ? '中文' : 'EN',
      onClick: () => onLanguageChange?.(transcriptionLanguage === 'en-US' ? 'zh-CN' : 'en-US'),
      keepOpen: true,
    });
  }

  if (features.topics || features.icebreakers) {
    moreMenuItems.push({
      icon: <TopicsIcon />,
      label: 'Icebreaker Topics',
      active: showTopics,
      onClick: onToggleTopics,
    });
  }

  // Background blur is shown as a direct button next to video, not in More menu

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4 relative z-50">
      {/* Status indicators row */}
      <div className="flex items-center gap-3">
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-red-500/15 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-semibold">
              REC {formatTime ? formatTime(recordingTime) : ''}
            </span>
          </div>
        )}
        {isTranscribing && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-stone-400 text-[11px]">Select your language for better recognition:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onLanguageChange?.('en-US')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  transcriptionLanguage === 'en-US'
                    ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                    : 'bg-stone-700/60 text-stone-300 border-stone-600/40 hover:bg-stone-600/70'
                }`}
              >
                English
              </button>
              <button
                onClick={() => onLanguageChange?.('zh-CN')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  transcriptionLanguage === 'zh-CN'
                    ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                    : 'bg-stone-700/60 text-stone-300 border-stone-600/40 hover:bg-stone-600/70'
                }`}
              >
                中文
              </button>
            </div>
          </div>
        )}
        {!isTranscribing && features.transcription && isSpeechSupported && (
          <div className="flex items-center gap-1.5 text-stone-500 text-xs">
            <CaptionIcon />
            <span>Captions off</span>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center gap-1 sm:gap-1.5 bg-stone-800/80 backdrop-blur-xl rounded-2xl p-1.5 sm:p-2 shadow-2xl border border-stone-700/30 max-w-full flex-wrap justify-center">
        {/* Primary: Audio with device selector */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <ControlBtn
            icon={isAudioDeviceSwitching ? <span className="animate-spin">⏳</span> : <MicIcon muted={isMuted} />}
            active={!isMuted}
            onClick={onToggleMute}
            disabled={isAudioDeviceSwitching}
            tooltip={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          />
          <DeviceSelector
            devices={audioDevices}
            selectedDevice={selectedAudioDevice}
            onChange={onAudioDeviceChange}
            disabled={isAudioDeviceSwitching}
            type="audio"
          />
        </div>

        {/* Primary: Video with device selector */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <ControlBtn
            icon={isVideoDeviceSwitching ? <span className="animate-spin">⏳</span> : <CameraIcon off={isVideoOff} />}
            active={!isVideoOff}
            onClick={onToggleVideo}
            disabled={isVideoDeviceSwitching}
            tooltip={isVideoOff ? 'Turn on camera (V)' : 'Turn off camera (V)'}
          />
          <DeviceSelector
            devices={videoDevices}
            selectedDevice={selectedVideoDevice}
            onChange={onVideoDeviceChange}
            disabled={isVideoDeviceSwitching}
            type="video"
          />
        </div>

        <Divider />

        {/* Secondary: Collaboration */}
        {features.screenShare && (
          <ControlBtn
            icon={<ScreenShareIcon active={isScreenSharing} />}
            active={isScreenSharing}
            onClick={onToggleScreenShare}
            disabled={!isScreenShareSupported || isOtherSharing}
            tooltip={
              !isScreenShareSupported ? 'Screen sharing is not supported on this device'
              : isScreenSharing ? 'Stop sharing'
              : isOtherSharing ? `${screenSharerName || 'Someone'} is sharing`
              : 'Share screen'
            }
          />
        )}

        {features.chat && (
          <ControlBtn
            icon={<ChatIcon />}
            active={showChat}
            onClick={onToggleChat}
            badge={!showChat ? messagesCount : undefined}
            tooltip="Chat (C)"
          />
        )}

        {features.participants && (
          <span className="hidden sm:inline-flex">
            <ControlBtn
              icon={<PeopleIcon />}
              active={showParticipants}
              onClick={onToggleParticipants}
              label={participantCount > 0 ? String(participantCount) : undefined}
              tooltip="Participants (P)"
            />
          </span>
        )}

        {/* More menu */}
        {moreMenuItems.length > 0 && (
          <>
            <Divider />
            <div ref={moreRef} className="relative flex-shrink-0">
              <ControlBtn
                icon={<MoreIcon />}
                onClick={() => setShowMore(!showMore)}
                tooltip="More options"
              />
              {showMore && (
                <DropdownMenu
                  items={moreMenuItems}
                  onClose={() => setShowMore(false)}
                  anchorRef={moreRef}
                />
              )}
            </div>
          </>
        )}

        <Divider />

        {/* Leave — label hidden on mobile to save space */}
        <span className="flex-shrink-0">
          <span className="hidden sm:contents">
            <ControlBtn
              icon={<LeaveIcon />}
              label="Leave"
              danger
              onClick={onLeave}
              tooltip="Leave call (L)"
            />
          </span>
          <span className="sm:hidden">
            <ControlBtn
              icon={<LeaveIcon />}
              danger
              onClick={onLeave}
              tooltip="Leave call (L)"
            />
          </span>
        </span>
      </div>
    </div>
  );
}
