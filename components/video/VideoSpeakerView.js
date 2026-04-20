'use client';

import { useMemo } from 'react';
import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';
import ScreenShareView from './ScreenShareView';

/**
 * Speaker View Layout
 * Shows main speaker with thumbnails of other participants.
 * All switching is user-controlled: tap a thumbnail to promote, tap the
 * main tile to return to grid.
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

  // Active speaker (remote id/uid string, or null if local is featured)
  activeSpeakerId = null,

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

  // Main-speaker selection
  isLocalMain = false,
  onSwap,                 // used by the 2-person PiP layout
  onSelectSpeaker,        // used by 3+ thumbnails — receives 'local' or remote id
  onReturnToGrid,         // tap the large tile → back to grid
}) {
  const hasScreenShare = localScreenTrack || remoteScreenTrack;
  const isLocalSharing = !!localScreenTrack;

  // Computed unconditionally (rules-of-hooks) — only consumed by the 3+ branch
  // below; the callback handles empty remoteParticipants gracefully.
  const { mainIsLocal, mainRemote, thumbnailRemotes } = useMemo(() => {
    if (isLocalMain) {
      return {
        mainIsLocal: true,
        mainRemote: null,
        thumbnailRemotes: remoteParticipants,
      };
    }
    const speakerIdx = activeSpeakerId
      ? remoteParticipants.findIndex(p =>
          String(p.id) === activeSpeakerId || String(p.uid) === activeSpeakerId
        )
      : -1;
    const idx = speakerIdx >= 0 ? speakerIdx : 0;
    return {
      mainIsLocal: false,
      mainRemote: remoteParticipants[idx],
      thumbnailRemotes: remoteParticipants.filter((_, i) => i !== idx),
    };
  }, [remoteParticipants, activeSpeakerId, isLocalMain]);

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
        {/* Main video — tap returns to grid */}
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
            onClick={onReturnToGrid}
          />
        ) : (
          <RemoteVideo
            participant={remoteParticipants[0]}
            providerType={providerType}
            size="full"
            onClick={onReturnToGrid}
          />
        )}

        {/* PiP thumbnail — tap swaps who is enlarged */}
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

  // 3+ participants — main speaker + thumbnail strip.
  // mainIsLocal / mainRemote / thumbnailRemotes were computed above.
  return (
    <div className="w-full h-full flex flex-col">
      {/* Thumbnails strip at top */}
      <div className="flex gap-2 h-20 sm:h-24 flex-shrink-0 overflow-x-auto pb-2 px-1">
        {/* Local thumbnail — shown when a remote is the main speaker */}
        {!mainIsLocal && (
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
              onClick={onSelectSpeaker ? () => onSelectSpeaker('local') : undefined}
            />
          </div>
        )}

        {/* Remote thumbnails — video unsubscribed at SDK level to save bandwidth */}
        {thumbnailRemotes.map((participant) => {
          const pid = String(participant.id || participant.uid);
          return (
            <div
              key={participant.id || participant.uid}
              className="h-full aspect-video flex-shrink-0"
            >
              <RemoteVideo
                participant={participant}
                providerType={providerType}
                size="thumbnail"
                onClick={onSelectSpeaker ? () => onSelectSpeaker(pid) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Main speaker — tap returns to grid */}
      <div className="flex-1 min-h-0">
        {mainIsLocal ? (
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
            onClick={onReturnToGrid}
          />
        ) : (
          mainRemote && (
            <RemoteVideo
              participant={mainRemote}
              providerType={providerType}
              size="full"
              onClick={onReturnToGrid}
            />
          )
        )}
      </div>
    </div>
  );
}
