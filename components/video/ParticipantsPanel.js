'use client';

/**
 * Participants Panel
 * Shows list of participants in the call with their status
 */
export default function ParticipantsPanel({
  currentUser,
  remoteParticipants = [],
  isMuted = false,
  isVideoOff = false,
  participantCount = 0,
  accentColor = 'rose',
  onClose,
}) {
  const accentColors = {
    rose: 'bg-amber-700',
    purple: 'bg-amber-700',
    mocha: 'bg-amber-700',
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Header with count */}
      <p className="text-stone-400 text-xs uppercase tracking-wide mb-2">
        {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
      </p>

      {/* Current User */}
      <div className="flex items-center gap-3 p-3 bg-stone-700/50 rounded-lg">
        <div className={`w-10 h-10 ${accentColors[accentColor] || accentColors.mocha} rounded-full flex items-center justify-center`}>
          <span className="text-white font-medium">
            {currentUser?.name?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">
            {currentUser?.name || currentUser?.email?.split('@')[0] || 'You'}
          </p>
          <p className="text-stone-400 text-xs">You (Host)</p>
        </div>
        <div className="flex items-center gap-1">
          {!isMuted && <span className="text-amber-400 text-sm">🎤</span>}
          {!isVideoOff && <span className="text-amber-400 text-sm">📹</span>}
        </div>
      </div>

      {/* Remote Participants */}
      {remoteParticipants.map((participant) => (
        <div
          key={participant.id || participant.uid}
          className="flex items-center gap-3 p-3 bg-stone-700/50 rounded-lg"
        >
          <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium">
              {(participant.name || participant.identity || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">
              {participant.name || participant.identity || 'Anonymous'}
            </p>
            {participant.connectionQuality && participant.connectionQuality !== 'excellent' && (
              <p className={`text-xs ${
                participant.connectionQuality === 'poor' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {participant.connectionQuality === 'poor' ? '⚠️ Poor connection' : '📶 Fair connection'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {participant.hasAudio && <span className="text-amber-400 text-sm">🎤</span>}
            {participant.hasVideo && <span className="text-amber-400 text-sm">📹</span>}
            {participant.hasScreen && <span className="text-amber-500 text-sm">🖥️</span>}
            {participant.isSpeaking && <span className="text-amber-300 text-sm animate-pulse">🔊</span>}
          </div>
        </div>
      ))}

      {remoteParticipants.length === 0 && (
        <p className="text-stone-400 text-sm text-center mt-4">
          Waiting for others to join...
        </p>
      )}
    </div>
  );
}
