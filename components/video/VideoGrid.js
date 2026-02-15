'use client';

import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';
import ScreenShareView from './ScreenShareView';

/**
 * Video Grid Layout
 * Displays all participants in a responsive grid
 * Shows screen share as main area when active (or side panel if local user is sharing)
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

  // UI
  showSidebar = false,
}) {
  const participantCount = remoteParticipants.length + 1; // +1 for local
  const hasScreenShare = localScreenTrack || remoteScreenTrack;
  const isLocalSharing = !!localScreenTrack;

  // Calculate grid columns based on participant count (mobile-first responsive)
  const getGridClasses = () => {
    // When viewing someone else's screen share, use smaller grid
    if (remoteScreenTrack && !localScreenTrack) {
      if (participantCount <= 2) return 'grid-cols-2';
      return 'grid-cols-2 md:grid-cols-4';
    }
    // Normal grid layout
    if (participantCount === 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

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

  // For odd participant counts in a 2-col grid, use flex layout for the last row
  // so the last item is centered at the same size as others
  const isOdd = participantCount % 2 !== 0 && participantCount >= 3;
  const gridCols = getGridClasses();
  const usesTwoCols = gridCols.includes('grid-cols-2');
  const centerLast = isOdd && usesTwoCols;

  // Split participants: paired rows go in grid, last odd one is centered below
  const pairedRemote = centerLast ? remoteParticipants.slice(0, -1) : remoteParticipants;
  const lastParticipant = centerLast ? remoteParticipants[remoteParticipants.length - 1] : null;

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Grid for paired participants */}
      <div
        className={`flex-1 grid gap-2 auto-rows-fr ${gridCols}`}
        style={centerLast ? { minHeight: 0 } : undefined}
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
          isBlurEnabled={isBlurEnabled}
          isBlurSupported={isBlurSupported}
          isBlurLoading={isBlurLoading}
          onToggleBlur={onToggleBlur}
          blurCanvas={blurCanvas}
        />

        {/* Paired Remote Videos */}
        {pairedRemote.map((participant) => (
          <RemoteVideo
            key={participant.id || participant.uid}
            participant={participant}
            providerType={providerType}
            size="grid"
          />
        ))}
      </div>

      {/* Centered last participant for odd count */}
      {lastParticipant && (
        <div className="flex-1 flex justify-center min-h-0">
          <div className="h-full" style={{ aspectRatio: '16/9', maxWidth: '50%' }}>
            <RemoteVideo
              participant={lastParticipant}
              providerType={providerType}
              size="grid"
            />
          </div>
        </div>
      )}
    </div>
  );
}
