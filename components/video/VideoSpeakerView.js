'use client';

import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';
import ScreenShareView from './ScreenShareView';

/**
 * Speaker View Layout
 * Shows main speaker with thumbnails of other participants
 * Shows screen share as main area when active
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

  // Screen share
  localScreenTrack = null,
  remoteScreenTrack = null,
  screenSharerName = '',
  onStopScreenShare,

  // Blur
  isBlurEnabled = false,
  isBlurSupported = false,
  isBlurLoading = false,
  onToggleBlur,
  blurCanvas = null,

  // For 2-person PiP swap
  isLocalMain = false,
  onSwap,
}) {
  const participantCount = remoteParticipants.length + 1;
  const hasScreenShare = localScreenTrack || remoteScreenTrack;
  const isLocalSharing = !!localScreenTrack;

  // Screen share layout: screen as main, cameras on the side
  if (hasScreenShare) {
    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-2">
        {/* Main area: Screen share (large) */}
        <div className="flex-1 min-w-0">
          <ScreenShareView
            screenTrack={localScreenTrack || remoteScreenTrack}
            isLocal={isLocalSharing}
            providerType={providerType}
            sharerName={isLocalSharing ? userName : screenSharerName}
            onStopSharing={isLocalSharing ? onStopScreenShare : undefined}
          />
        </div>

        {/* Side panel: Camera views stacked vertically */}
        <div className="flex md:flex-col gap-2 md:w-48 lg:w-56 flex-shrink-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden">
          {/* Local Video */}
          <div className="h-24 md:h-auto md:w-full aspect-video flex-shrink-0">
            <LocalVideo
              ref={localVideoRef}
              track={localVideoTrack}
              providerType={providerType}
              isVideoOff={isVideoOff}
              isMuted={isMuted}
              userName={userName}
              size="thumbnail"
              accentColor={accentColor}
              isBlurEnabled={isBlurEnabled}
              isBlurSupported={isBlurSupported}
              isBlurLoading={isBlurLoading}
              onToggleBlur={onToggleBlur}
              blurCanvas={blurCanvas}
            />
          </div>

          {/* Remote Videos */}
          {remoteParticipants.map((participant) => (
            <div
              key={participant.id || participant.uid}
              className="h-24 md:h-auto md:w-full aspect-video flex-shrink-0"
            >
              <RemoteVideo
                participant={participant}
                providerType={providerType}
                size="thumbnail"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          isBlurEnabled={isBlurEnabled}
          isBlurSupported={isBlurSupported}
          isBlurLoading={isBlurLoading}
          onToggleBlur={onToggleBlur}
          blurCanvas={blurCanvas}
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
            isBlurEnabled={isBlurEnabled}
            isBlurSupported={isBlurSupported}
            isBlurLoading={isBlurLoading}
            onToggleBlur={onToggleBlur}
            blurCanvas={blurCanvas}
          />
        ) : (
          <RemoteVideo
            participant={remoteParticipants[0]}
            providerType={providerType}
            size="full"
          />
        )}

        {/* PiP thumbnail - uses aspect-video for correct 16:9 ratio */}
        <div
          className="absolute top-4 right-4 w-32 sm:w-40 md:w-48 aspect-video shadow-xl z-10 cursor-pointer hover:ring-2 hover:ring-amber-500 rounded-lg overflow-hidden transition-all"
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
              blurCanvas={blurCanvas}
            />
          )}
        </div>
      </div>
    );
  }

  // 3+ participants - Main speaker with thumbnails strip
  return (
    <div className="w-full h-full flex flex-col">
      {/* Thumbnails strip at top - responsive height */}
      <div className="flex gap-2 h-20 sm:h-24 flex-shrink-0 overflow-x-auto pb-2 px-1">
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
            blurCanvas={blurCanvas}
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
