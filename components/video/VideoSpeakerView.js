'use client';

import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';

/**
 * Speaker View Layout
 * Shows main speaker with thumbnails of other participants
 *
 * For 2 participants: PiP layout with swappable main/thumbnail
 * For 3+: Main speaker with thumbnails strip
 * For 1: Full screen local video
 */
export default function VideoSpeakerView({
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

  // For 2-person PiP swap
  isLocalMain = false,
  onSwap,
}) {
  const participantCount = remoteParticipants.length + 1;

  // Alone - full screen local
  if (remoteParticipants.length === 0) {
    return (
      <div className="w-full h-full">
        <LocalVideo
          ref={localVideoRef}
          track={localVideoTrack}
          providerType={providerType}
          isVideoOff={isVideoOff}
          isMuted={isMuted}
          userName={userName}
          size="full"
          accentColor={accentColor}
        />
      </div>
    );
  }

  // 2 participants - PiP with swap
  if (remoteParticipants.length === 1) {
    return (
      <div className="w-full h-full relative">
        {/* Main video */}
        {isLocalMain ? (
          <LocalVideo
            ref={localVideoRef}
            track={localVideoTrack}
            providerType={providerType}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            userName={userName}
            size="full"
            accentColor={accentColor}
          />
        ) : (
          <RemoteVideo
            participant={remoteParticipants[0]}
            providerType={providerType}
            size="full"
          />
        )}

        {/* PiP thumbnail */}
        <div
          className="absolute top-4 right-4 w-36 h-28 md:w-48 md:h-36 shadow-xl z-10 cursor-pointer hover:ring-2 hover:ring-amber-500 rounded-lg overflow-hidden"
          onClick={onSwap}
        >
          {isLocalMain ? (
            <RemoteVideo
              participant={remoteParticipants[0]}
              providerType={providerType}
              size="thumbnail"
            />
          ) : (
            <LocalVideo
              ref={isLocalMain ? undefined : localVideoRef}
              track={localVideoTrack}
              providerType={providerType}
              isVideoOff={isVideoOff}
              isMuted={isMuted}
              userName={userName}
              size="thumbnail"
              accentColor={accentColor}
            />
          )}
        </div>
      </div>
    );
  }

  // 3+ participants - Main speaker with thumbnails strip
  return (
    <div className="w-full h-full flex flex-col">
      {/* Thumbnails strip at top */}
      <div className="flex gap-2 h-24 flex-shrink-0 overflow-x-auto pb-2">
        {/* Local thumbnail */}
        <div className="h-full aspect-video flex-shrink-0">
          <LocalVideo
            ref={localVideoRef}
            track={localVideoTrack}
            providerType={providerType}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            userName={userName}
            size="thumbnail"
            accentColor={accentColor}
          />
        </div>

        {/* Other remote participant thumbnails (skip first which is main speaker) */}
        {remoteParticipants.slice(1).map((participant) => (
          <div
            key={participant.id || participant.uid}
            className="h-full aspect-video flex-shrink-0"
          >
            <RemoteVideo
              participant={participant}
              providerType={providerType}
              size="thumbnail"
            />
          </div>
        ))}
      </div>

      {/* Main speaker */}
      <div className="flex-1 min-h-0">
        <RemoteVideo
          participant={remoteParticipants[0]}
          providerType={providerType}
          size="full"
        />
      </div>
    </div>
  );
}
