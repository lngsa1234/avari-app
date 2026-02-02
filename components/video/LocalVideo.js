'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

/**
 * Local Video Component
 * Renders the local user's video with optional placeholder when camera is off
 *
 * @param {Object} props
 * @param {Object} props.track - Local video track (provider-specific)
 * @param {string} props.providerType - Provider type: 'agora', 'livekit', 'webrtc'
 * @param {boolean} props.isVideoOff - Whether camera is off
 * @param {boolean} props.isMuted - Whether microphone is muted
 * @param {string} props.userName - User's display name
 * @param {string} props.size - Size variant: 'full', 'grid', 'thumbnail'
 * @param {string} props.accentColor - Accent color for avatar
 * @param {Function} props.onClick - Optional click handler
 */
const LocalVideo = forwardRef(function LocalVideo({
  track,
  providerType,
  isVideoOff = false,
  isMuted = false,
  userName = 'You',
  size = 'grid',
  accentColor = 'rose',
  onClick,
}, ref) {
  const videoRef = useRef(null);
  const attachedTrackRef = useRef(null);

  // Expose video ref via forwardRef
  useImperativeHandle(ref, () => videoRef.current, []);

  // Attach/detach track
  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || isVideoOff) {
      // Detach if video is off
      if (attachedTrackRef.current) {
        try {
          detachLocalTrack(attachedTrackRef.current, videoElement, providerType);
        } catch (e) { /* ignore */ }
        attachedTrackRef.current = null;
      }
      return;
    }

    if (!track) return;

    // Skip if same track already attached
    if (attachedTrackRef.current === track) return;

    // Detach old track
    if (attachedTrackRef.current) {
      try {
        detachLocalTrack(attachedTrackRef.current, videoElement, providerType);
      } catch (e) { /* ignore */ }
      attachedTrackRef.current = null;
    }

    // Attach new track
    try {
      attachLocalTrack(track, videoElement, providerType);
      attachedTrackRef.current = track;
    } catch (e) {
      console.error('[LocalVideo] Error attaching track:', e);
    }

    return () => {
      if (attachedTrackRef.current && videoElement) {
        try {
          detachLocalTrack(attachedTrackRef.current, videoElement, providerType);
        } catch (e) { /* ignore */ }
        attachedTrackRef.current = null;
      }
    };
  }, [track, isVideoOff, providerType]);

  const initial = userName.charAt(0).toUpperCase();

  // Size-based classes
  const sizeClasses = {
    full: 'w-full h-full',
    grid: 'w-full h-full min-h-0',
    thumbnail: 'w-48 h-36 flex-shrink-0',
  };

  const avatarSizes = {
    full: 'w-32 h-32 text-5xl',
    grid: 'w-20 h-20 text-2xl',
    thumbnail: 'w-12 h-12 text-lg',
  };

  const labelSizes = {
    full: 'bottom-4 left-4 px-3 py-2',
    grid: 'bottom-2 left-2 px-2 py-1 text-xs',
    thumbnail: 'bottom-1 left-1 px-2 py-1 text-xs',
  };

  // Accent color variants - mocha theme
  const accentColors = {
    rose: 'bg-amber-700',
    purple: 'bg-amber-700',
    blue: 'bg-amber-600',
    green: 'bg-amber-600',
    mocha: 'bg-amber-700',
  };

  return (
    <div
      className={`bg-stone-800 rounded-lg overflow-hidden relative ${sizeClasses[size]}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Video element - always rendered for ref stability */}
      {!isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      ) : (
        // Placeholder when video is off
        <div className="absolute inset-0 bg-stone-700 flex items-center justify-center">
          <div className="text-center">
            <div className={`${accentColors[accentColor] || accentColors.mocha} rounded-full flex items-center justify-center mx-auto mb-2 ${avatarSizes[size]}`}>
              <span className="text-white">{initial}</span>
            </div>
            {size !== 'thumbnail' && (
              <p className="text-white text-sm">You (Camera off)</p>
            )}
          </div>
        </div>
      )}

      {/* Name label */}
      <div className={`absolute bg-black bg-opacity-60 text-white rounded z-20 ${labelSizes[size]}`}>
        You {isMuted && '🔇'}
      </div>
    </div>
  );
});

/**
 * Attach local track to video element
 */
function attachLocalTrack(track, element, providerType) {
  switch (providerType) {
    case 'agora':
      track.play(element);
      break;

    case 'livekit':
      track.attach(element);
      element.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.log('[LocalVideo] Autoplay prevented:', e.name);
        }
      });
      break;

    case 'webrtc':
      if (track instanceof MediaStream) {
        element.srcObject = track;
      } else if (track instanceof MediaStreamTrack) {
        element.srcObject = new MediaStream([track]);
      } else if (track.mediaStreamTrack) {
        element.srcObject = new MediaStream([track.mediaStreamTrack]);
      }
      element.play().catch(() => {});
      break;
  }
}

/**
 * Detach local track from video element
 */
function detachLocalTrack(track, element, providerType) {
  switch (providerType) {
    case 'agora':
      // Agora tracks don't need explicit detachment
      break;

    case 'livekit':
      if (track.detach) track.detach(element);
      break;

    case 'webrtc':
      element.srcObject = null;
      break;
  }
}

export default LocalVideo;
