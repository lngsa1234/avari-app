'use client';

/**
 * Video Call Header
 * Displays call title, status, and controls
 */
export default function VideoHeader({
  title,
  subtitle,
  brandName,
  emoji,
  gradient = 'from-stone-600 to-stone-700',
  participantCount = 0,
  providerBadge,
  isConnecting = false,
  isTranscribing = false,
  isRecording = false,
  showGridToggle = true,
  gridView = true,
  onToggleView,
  onLeave,
}) {
  return (
    <div className={`bg-gradient-to-r ${gradient} p-4 flex-shrink-0`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left - Logo and Info */}
        <div className="flex items-center gap-3">
          {/* CircleW Logo */}
          <svg width="32" height="32" viewBox="0 0 100 100" className="text-white">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="220 60"/>
            <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="currentColor">W</text>
          </svg>
          <div>
            <h1 className="text-white font-bold text-xl flex items-center gap-2">
              {emoji && <span>{emoji}</span>}
              {brandName || title}
            </h1>
            {subtitle && (
              <p className="text-white/80 text-sm">{subtitle}</p>
            )}
            <p className="text-white/70 text-xs flex items-center gap-2">
              {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
              {providerBadge && (
                <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {providerBadge}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right - Status and Controls */}
        <div className="flex items-center gap-3">
          {/* Status indicators */}
          {isConnecting && (
            <span className="text-white text-sm animate-pulse">Connecting...</span>
          )}
          {isTranscribing && (
            <span className="text-white text-sm flex items-center">
              <span className="animate-pulse mr-2">📝</span>
              Transcribing
            </span>
          )}
          {isRecording && (
            <span className="text-white text-sm flex items-center">
              <span className="animate-pulse mr-2 text-red-400">⏺</span>
              Recording
            </span>
          )}

          {/* View toggle */}
          {showGridToggle && onToggleView && (
            <button
              onClick={onToggleView}
              className="bg-amber-700 bg-opacity-80 hover:bg-opacity-100 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              {gridView ? '👤 Speaker' : '📱 Grid'}
            </button>
          )}

          {/* Leave button */}
          {onLeave && (
            <button
              onClick={onLeave}
              className="bg-red-700 hover:bg-red-800 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
