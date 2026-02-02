'use client';

import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';

/**
 * Video Grid Layout
 * Displays all participants in a responsive grid
 */
export default function VideoGrid({
  // Local user
  localVideoRef,
  localVideoTrack,
  isVideoOff,
  isMuted,
  userName,
  accentColor = 'rose',

  // Remote participants
  remoteParticipants = [],
  providerType,

  // UI
  showSidebar = false,
}) {
  const participantCount = remoteParticipants.length + 1; // +1 for local

  // Calculate grid columns based on participant count
  const getGridClasses = () => {
    if (participantCount === 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <div
      className={`w-full h-full grid gap-2 auto-rows-fr ${getGridClasses()}`}
    >
      {/* Local Video */}
      <LocalVideo
        ref={localVideoRef}
        track={localVideoTrack}
        providerType={providerType}
        isVideoOff={isVideoOff}
        isMuted={isMuted}
        userName={userName}
        size="grid"
        accentColor={accentColor}
      />

      {/* Remote Videos */}
      {remoteParticipants.map((participant) => (
        <RemoteVideo
          key={participant.id || participant.uid}
          participant={participant}
          providerType={providerType}
          size="grid"
        />
      ))}
    </div>
  );
}
