'use client';

/**
 * Video Call Control Bar
 * Renders control buttons based on feature configuration
 */
export default function ControlBar({
  // State
  isMuted,
  isVideoOff,
  isBlurEnabled,
  isBlurSupported,
  isBlurLoading,
  isScreenSharing,
  isRecording,
  recordingTime,
  isTranscribing,
  isSpeechSupported,
  isSafari,
  showChat,
  showTopics,
  showParticipants,
  messagesCount = 0,
  transcriptionLanguage = 'en-US',

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
  return (
    <div className="bg-stone-800 py-3 px-4 flex-shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left side - Recording/Transcription indicator */}
        <div className="w-40">
          {isRecording && (
            <div className="flex items-center text-red-500 text-sm">
              <span className="animate-pulse mr-2">⏺</span>
              {formatTime ? formatTime(recordingTime) : recordingTime}
            </div>
          )}
          {isTranscribing && !isRecording && (
            <div className="flex items-center text-green-400 text-sm">
              <span className="animate-pulse mr-2">📝</span>
              Transcribing...
            </div>
          )}
          {isTranscribing && isRecording && (
            <div className="flex items-center text-green-400 text-xs mt-1">
              <span className="mr-1">📝</span>
              + Transcribing
            </div>
          )}
        </div>

        {/* Center - Main controls */}
        <div className="flex items-center gap-3">
          {/* Mute */}
          <ControlButton
            active={isMuted}
            activeColor="red"
            icon={isMuted ? '🔇' : '🎤'}
            title={isMuted ? 'Unmute' : 'Mute'}
            onClick={onToggleMute}
          />

          {/* Video */}
          <ControlButton
            active={isVideoOff}
            activeColor="red"
            icon="📹"
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            onClick={onToggleVideo}
          />

          {/* Background Blur */}
          {features.backgroundBlur && isBlurSupported && (
            <ControlButton
              active={isBlurEnabled}
              activeColor="blue"
              icon={isBlurLoading ? '⏳' : '🌫️'}
              title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
              onClick={onToggleBlur}
              disabled={isBlurLoading || isVideoOff}
            />
          )}

          {/* Screen Share */}
          {features.screenShare && (
            <ControlButton
              active={isScreenSharing}
              activeColor="blue"
              icon="🖥️"
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              onClick={onToggleScreenShare}
            />
          )}

          {/* Recording */}
          {features.recording && (
            <ControlButton
              active={isRecording}
              activeColor="red"
              icon="⏺"
              title={isRecording ? 'Stop recording' : 'Start recording'}
              onClick={onToggleRecording}
            />
          )}

          {/* Transcription */}
          {features.transcription && isSpeechSupported && (
            <div className="flex items-center gap-1">
              <ControlButton
                active={isTranscribing}
                activeColor={isSafari ? 'yellow' : 'green'}
                icon="📝"
                title={isSafari ? 'Transcription (limited on Safari)' : isTranscribing ? 'Stop transcription' : 'Start transcription'}
                onClick={onToggleTranscription}
                badge={isTranscribing}
                badgeColor="green"
                warningBadge={isSafari && !isTranscribing}
              />
              <select
                value={transcriptionLanguage}
                onChange={(e) => onLanguageChange?.(e.target.value)}
                className="bg-stone-700 text-white text-xs rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                title="Transcription language"
              >
                <option value="en-US">EN</option>
                <option value="zh-CN">中文</option>
              </select>
            </div>
          )}

          {/* Topics */}
          {features.topics && (
            <ControlButton
              active={showTopics}
              activeColor="amber"
              icon="💡"
              title="Toggle topics"
              onClick={onToggleTopics}
            />
          )}

          {/* Chat */}
          {features.chat && (
            <ControlButton
              active={showChat}
              activeColor="purple"
              icon="💬"
              title="Toggle chat"
              onClick={onToggleChat}
              count={!showChat && messagesCount > 0 ? messagesCount : undefined}
            />
          )}

          {/* Participants */}
          {features.participants && (
            <ControlButton
              active={showParticipants}
              activeColor="green"
              icon="👥"
              title="Toggle participants"
              onClick={onToggleParticipants}
            />
          )}

          {/* Leave */}
          <button
            onClick={onLeave}
            className="bg-red-700 hover:bg-red-800 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Leave
          </button>
        </div>

        {/* Right side - Spacer */}
        <div className="w-32"></div>
      </div>
    </div>
  );
}

/**
 * Individual Control Button
 */
function ControlButton({
  active,
  activeColor = 'gray',
  icon,
  title,
  onClick,
  disabled = false,
  count,
  badge,
  badgeColor = 'green',
  warningBadge,
}) {
  const colorClasses = {
    red: 'bg-red-600',
    blue: 'bg-amber-700',
    green: 'bg-emerald-600',
    yellow: 'bg-yellow-600',
    purple: 'bg-amber-600',
    amber: 'bg-amber-600',
    mocha: 'bg-amber-700',
    gray: 'bg-stone-700',
  };

  const badgeColors = {
    green: 'bg-emerald-400',
    red: 'bg-red-500',
    yellow: 'bg-amber-400',
    mocha: 'bg-amber-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${active ? colorClasses[activeColor] : colorClasses.gray} hover:bg-stone-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center relative disabled:opacity-50 disabled:cursor-not-allowed`}
      title={title}
    >
      {icon}
      {/* Count badge */}
      {count !== undefined && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-full min-w-[1.25rem] h-5 flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {/* Pulse badge */}
      {badge && (
        <span className={`absolute -top-1 -right-1 w-3 h-3 ${badgeColors[badgeColor]} rounded-full animate-pulse`}></span>
      )}
      {/* Warning badge */}
      {warningBadge && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" title="Limited support"></span>
      )}
    </button>
  );
}
