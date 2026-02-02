'use client';

import { memo, useRef, useEffect, useState } from 'react';

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
  const initial = displayName.charAt(0).toUpperCase();

  // Size-based classes
  const sizeClasses = {
    full: 'w-full h-full',
    grid: 'w-full h-full min-h-0',
    thumbnail: 'w-48 h-36 flex-shrink-0',
  };

  const avatarSizes = {
    full: 'w-32 h-32 text-5xl',
    grid: 'w-20 h-20 text-2xl',
    thumbnail: 'w-10 h-10 text-sm',
  };

  const labelSizes = {
    full: 'bottom-4 left-4 px-3 py-2',
    grid: 'bottom-2 left-2 px-2 py-1 text-xs',
    thumbnail: 'bottom-1 left-1 px-2 py-1 text-xs',
  };

  return (
    <div
      className={`bg-stone-800 rounded-lg overflow-hidden relative ${sizeClasses[size]}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Hidden audio element */}
      {providerType === 'livekit' && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      {/* Video layer */}
      <div
        ref={videoRef}
        className="absolute inset-0"
        style={{
          backgroundColor: '#292524',
          zIndex: hasVideo ? 10 : 1
        }}
      />

      {/* Placeholder when no video */}
      <div
        className="absolute inset-0 bg-stone-700 flex items-center justify-center"
        style={{ zIndex: hasVideo ? 1 : 10 }}
      >
        <div className="text-center">
          <div className={`bg-amber-700 rounded-full flex items-center justify-center mx-auto mb-2 ${avatarSizes[size]}`}>
            <span className="text-white">{initial}</span>
          </div>
          {size !== 'thumbnail' && (
            <>
              <p className="text-white text-sm">{displayName}</p>
              <p className="text-white text-xs opacity-70">Camera off</p>
            </>
          )}
        </div>
      </div>

      {/* Connection quality indicator */}
      {participant.connectionQuality && participant.connectionQuality !== 'excellent' && (
        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs z-20 ${
          participant.connectionQuality === 'poor' ? 'bg-red-600 text-white' :
          participant.connectionQuality === 'fair' ? 'bg-amber-500 text-black' : 'bg-amber-600 text-white'
        }`}>
          {participant.connectionQuality === 'poor' ? '📶 Poor' :
           participant.connectionQuality === 'fair' ? '📶 Fair' : '📶 Good'}
        </div>
      )}

      {/* Name label */}
      <div className={`absolute bg-black bg-opacity-60 text-white rounded z-20 ${labelSizes[size]}`}>
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
    prevProps.participant.hasVideo === nextProps.participant.hasVideo &&
    prevProps.participant.hasAudio === nextProps.participant.hasAudio &&
    prevProps.participant.hasScreen === nextProps.participant.hasScreen &&
    prevProps.participant._videoEnabled === nextProps.participant._videoEnabled &&
    prevProps.participant.videoTrack === nextProps.participant.videoTrack &&
    prevProps.participant.audioTrack === nextProps.participant.audioTrack &&
    prevProps.participant.connectionQuality === nextProps.participant.connectionQuality &&
    prevProps.size === nextProps.size &&
    prevProps.providerType === nextProps.providerType
  );
});

/**
 * Attach track to element based on provider type
 */
function attachTrack(track, element, providerType, trackType) {
  switch (providerType) {
    case 'agora':
      // Agora uses .play()
      if (trackType === 'video') {
        track.play(element, { fit: 'contain' });
      } else {
        track.play();
      }
      break;

    case 'livekit':
      // LiveKit uses .attach()
      track.attach(element);
      // Safari needs explicit play()
      if (element.play) {
        element.play().catch(() => {
          element.muted = true;
          element.play().catch(() => {});
        });
      }
      break;

    case 'webrtc':
      // WebRTC - set srcObject
      if (track instanceof MediaStreamTrack) {
        element.srcObject = new MediaStream([track]);
      } else if (track.mediaStreamTrack) {
        element.srcObject = new MediaStream([track.mediaStreamTrack]);
      }
      element.play().catch(() => {});
      break;

    default:
      console.warn('[RemoteVideo] Unknown provider type:', providerType);
  }
}

/**
 * Detach track from element based on provider type
 */
function detachTrack(track, element, providerType) {
  switch (providerType) {
    case 'agora':
      if (track.stop) track.stop();
      break;

    case 'livekit':
      if (track.detach) track.detach(element);
      break;

    case 'webrtc':
      element.srcObject = null;
      break;
  }
}

export default RemoteVideo;
