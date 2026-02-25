'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { VIDEO_SIZE_CLASSES, LABEL_SIZE_CLASSES } from '@/lib/video/videoConstants';
import { attachTrack, detachTrack } from '@/lib/video/trackManager';
import VideoAvatar from './VideoAvatar';

/**
 * Unified Remote Video Player
 * Handles different provider APIs: Agora, LiveKit, and WebRTC
 *
 * @param {Object} props
 * @param {Object} props.participant - Participant data with tracks
 * @param {string} props.providerType - Provider type: 'agora', 'livekit', 'webrtc'
 * @param {string} props.size - Size variant: 'full', 'grid', 'thumbnail'
 * @param {Function} props.onClick - Optional click handler
 */
const RemoteVideo = memo(function RemoteVideo({
  participant,
  providerType,
  size = 'grid',
  onClick,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const attachedVideoRef = useRef(null);
  const attachedAudioRef = useRef(null);
  const lastEnabledRef = useRef(true);
  const [hasVideo, setHasVideo] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);

  // Get track based on provider type
  const getTrack = (trackType) => {
    if (providerType === 'livekit') {
      return trackType === 'video' ? participant.videoTrack : participant.audioTrack;
    } else if (providerType === 'agora') {
      return trackType === 'video' ? participant.videoTrack : participant.audioTrack;
    } else {
      // WebRTC - participant might have track directly or in a stream
      return trackType === 'video' ? participant.videoTrack : participant.audioTrack;
    }
  };

  const videoTrack = getTrack('video');
  const audioTrack = getTrack('audio');

  // Check video enabled state
  const isVideoEnabled = participant._videoEnabled !== false &&
    (participant.hasVideo !== false) &&
    !!videoTrack;

  // Handle video track attachment
  useEffect(() => {
    const videoElement = videoRef.current;
    const track = videoTrack;
    const wasEnabled = lastEnabledRef.current;
    const justUnmuted = !wasEnabled && isVideoEnabled;

    lastEnabledRef.current = isVideoEnabled;
    setHasVideo(!!track && isVideoEnabled);

    if (!track || !videoElement || !isVideoEnabled) {
      // Cleanup if no track or disabled
      if (attachedVideoRef.current) {
        try {
          detachTrack(attachedVideoRef.current, videoElement, providerType);
        } catch (e) { /* ignore */ }
        attachedVideoRef.current = null;
      }
      return;
    }

    // Skip if same track already attached (unless just unmuted)
    if (attachedVideoRef.current === track && !justUnmuted) {
      return;
    }

    // Detach old track if different
    if (attachedVideoRef.current && (justUnmuted || attachedVideoRef.current !== track)) {
      try {
        detachTrack(attachedVideoRef.current, videoElement, providerType);
      } catch (e) { /* ignore */ }
      attachedVideoRef.current = null;
    }

    // Attach new track
    try {
      attachTrack(track, videoElement, providerType, 'video');
      attachedVideoRef.current = track;
      // Ensure remote video is never mirrored
      const videoEl = videoElement.querySelector('video');
      if (videoEl) {
        videoEl.style.setProperty('transform', 'none', 'important');
        // Try to autoplay with retries — the stream may not be ready immediately
        const tryPlay = (attempts = 0) => {
          if (!videoEl.paused) { setNeedsPlay(false); return; }
          videoEl.play()
            .then(() => setNeedsPlay(false))
            .catch(() => {
              if (attempts < 3) {
                setTimeout(() => tryPlay(attempts + 1), 500);
              } else {
                setNeedsPlay(true);
              }
            });
        };
        // Defer first attempt to let the stream settle
        setTimeout(() => tryPlay(), 200);
      } else {
        setNeedsPlay(false);
      }
    } catch (e) {
      console.error('[RemoteVideo] Error attaching video track:', e);
    }

    return () => {
      if (attachedVideoRef.current && videoElement) {
        try {
          detachTrack(attachedVideoRef.current, videoElement, providerType);
        } catch (e) { /* ignore */ }
        attachedVideoRef.current = null;
      }
    };
  }, [videoTrack, isVideoEnabled, providerType, participant.uid, participant._lastUpdate]);

  // Handle audio track attachment
  // All providers (including WebRTC) attach audio to hidden <audio> element
  useEffect(() => {
    const audioElement = audioRef.current;
    const track = audioTrack;

    if (!track || !audioElement) return;
    if (attachedAudioRef.current === track) return;

    // Detach old track
    if (attachedAudioRef.current) {
      try {
        detachTrack(attachedAudioRef.current, audioElement, providerType);
      } catch (e) { /* ignore */ }
      attachedAudioRef.current = null;
    }

    // Attach new track
    try {
      attachTrack(track, audioElement, providerType, 'audio');
      attachedAudioRef.current = track;
    } catch (e) {
      console.error('[RemoteVideo] Error attaching audio track:', e);
    }

    return () => {
      if (attachedAudioRef.current && audioElement) {
        try {
          detachTrack(attachedAudioRef.current, audioElement, providerType);
        } catch (e) { /* ignore */ }
        attachedAudioRef.current = null;
      }
    };
  }, [audioTrack, providerType]);

  // Get display name
  const displayName = participant.name || participant.identity || `User ${participant.uid || participant.id}`;

  // Use shared constants
  const containerClass = VIDEO_SIZE_CLASSES[size] || VIDEO_SIZE_CLASSES.grid;
  const labelClass = LABEL_SIZE_CLASSES[size] || LABEL_SIZE_CLASSES.grid;

  // Tap-to-play handler for mobile Safari autoplay restrictions
  const handleTapToPlay = () => {
    if (onClick) onClick();
    const videoEl = videoRef.current?.querySelector('video');
    if (videoEl && videoEl.paused) {
      videoEl.play().then(() => setNeedsPlay(false)).catch(() => {});
    }
    const audioEl = audioRef.current;
    if (audioEl && audioEl.paused) {
      audioEl.play().catch(() => {});
    }
  };

  return (
    <div
      className={`bg-stone-800 rounded-lg relative ${containerClass}`}
      onClick={handleTapToPlay}
      style={{ cursor: needsPlay ? 'pointer' : (onClick ? 'pointer' : undefined) }}
    >
      {/* Hidden audio element - needed for all providers */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Video layer */}
      <div
        ref={videoRef}
        className={`absolute inset-0 overflow-hidden rounded-lg remote-video-container ${providerType === 'agora' ? 'agora-video-player' : ''}`}
        style={{
          backgroundColor: '#292524',
          zIndex: hasVideo && !participant.isDisconnected ? 10 : 1
        }}
      />

      {/* Placeholder when no video or disconnected */}
      <div
        className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg ${participant.isDisconnected ? 'bg-stone-900' : 'bg-stone-700'}`}
        style={{ zIndex: hasVideo && !participant.isDisconnected ? 1 : 10 }}
      >
        <VideoAvatar
          name={displayName}
          size={size}
          accentColor="mocha"
          showName={size !== 'thumbnail'}
          subtitle={size !== 'thumbnail' ? (participant.isDisconnected ? 'Disconnected' : 'Camera off') : undefined}
        />
      </div>

      {/* Connection quality indicator */}
      {participant.connectionQuality && participant.connectionQuality !== 'excellent' && participant.connectionQuality !== 'good' && (
        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs z-30 ${
          participant.connectionQuality === 'poor' ? 'bg-red-600 text-white' :
          participant.connectionQuality === 'fair' ? 'bg-amber-500 text-black' : 'bg-amber-600 text-white'
        }`}>
          {participant.connectionQuality === 'poor' ? '📶 Poor' : '📶 Fair'}
        </div>
      )}

      {/* Tap to play overlay for mobile autoplay restrictions */}
      {needsPlay && hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/30 rounded-lg">
          <div className="text-white text-sm bg-black/60 px-4 py-2 rounded-full">
            Tap to play video
          </div>
        </div>
      )}

      {/* Name label */}
      <div className={`absolute bg-black/60 text-white rounded z-50 ${labelClass}`}>
        {displayName}
        {participant.isSpeaking && ' 🔊'}
        {participant.hasScreen && ' 🖥️'}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.participant.id === nextProps.participant.id &&
    prevProps.participant.uid === nextProps.participant.uid &&
    prevProps.participant.name === nextProps.participant.name &&
    prevProps.participant.hasVideo === nextProps.participant.hasVideo &&
    prevProps.participant.hasAudio === nextProps.participant.hasAudio &&
    prevProps.participant.hasScreen === nextProps.participant.hasScreen &&
    prevProps.participant._videoEnabled === nextProps.participant._videoEnabled &&
    prevProps.participant.videoTrack === nextProps.participant.videoTrack &&
    prevProps.participant.audioTrack === nextProps.participant.audioTrack &&
    prevProps.participant.connectionQuality === nextProps.participant.connectionQuality &&
    prevProps.participant.isDisconnected === nextProps.participant.isDisconnected &&
    prevProps.participant._lastUpdate === nextProps.participant._lastUpdate &&
    prevProps.size === nextProps.size &&
    prevProps.providerType === nextProps.providerType
  );
});

export default RemoteVideo;
