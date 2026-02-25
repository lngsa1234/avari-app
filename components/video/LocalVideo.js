'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { VIDEO_SIZE_CLASSES, LABEL_SIZE_CLASSES } from '@/lib/video/videoConstants';
import { attachLocalTrack, detachLocalTrack } from '@/lib/video/trackManager';
import VideoAvatar from './VideoAvatar';

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
const BlurIcon = ({ enabled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={enabled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const LocalVideo = forwardRef(function LocalVideo({
  track,
  providerType,
  isVideoOff = false,
  isMuted = false,
  userName = 'You',
  size = 'grid',
  accentColor = 'rose',
  onClick,
  isBlurEnabled = false,
  isBlurSupported = false,
  isBlurLoading = false,
  onToggleBlur,
  blurCanvas = null, // Canvas element from useBackgroundBlur for overlay
}, ref) {
  const videoRef = useRef(null);
  const blurContainerRef = useRef(null);
  const attachedTrackRef = useRef(null);

  // Expose video ref via forwardRef
  useImperativeHandle(ref, () => videoRef.current, []);

  // Manage blur canvas overlay — attaches/detaches automatically with component lifecycle
  useEffect(() => {
    const container = blurContainerRef.current;
    if (!container || !blurCanvas || isVideoOff) {
      // Remove canvas if it was in this container
      if (blurCanvas && blurCanvas.parentElement === container) {
        container?.removeChild(blurCanvas);
      }
      return;
    }

    // Move canvas to this container (remove from old parent if needed)
    if (blurCanvas.parentElement && blurCanvas.parentElement !== container) {
      blurCanvas.parentElement.removeChild(blurCanvas);
    }

    if (blurCanvas.parentElement !== container) {
      blurCanvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        z-index: 10; pointer-events: none;
        border-radius: inherit;
        transform: scaleX(-1);
      `;
      container.appendChild(blurCanvas);
    }

    return () => {
      // Remove canvas when component unmounts
      if (blurCanvas.parentElement === container) {
        container.removeChild(blurCanvas);
      }
    };
  }, [blurCanvas, isVideoOff]);

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

  // Use shared constants
  const containerClass = VIDEO_SIZE_CLASSES[size] || VIDEO_SIZE_CLASSES.grid;
  const labelClass = LABEL_SIZE_CLASSES[size] || LABEL_SIZE_CLASSES.grid;

  // Agora uses container div, others use video element
  const isAgora = providerType === 'agora';

  return (
    <div
      className={`bg-stone-800 rounded-lg relative overflow-hidden ${containerClass}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* Video element - Agora div is always mounted so the SDK player isn't destroyed on toggle */}
      {isAgora ? (
        <div
          ref={videoRef}
          className="absolute inset-0 overflow-hidden rounded-lg agora-video-player"
          style={{ transform: 'scaleX(-1)', visibility: isVideoOff ? 'hidden' : 'visible' }}
        />
      ) : !isVideoOff ? (
        <div ref={blurContainerRef} className="absolute inset-0 overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      ) : null}

      {/* Placeholder when video is off - rendered on top */}
      {isVideoOff && (
        <div className="absolute inset-0 bg-stone-700 flex items-center justify-center rounded-lg z-10">
          <VideoAvatar
            name={userName}
            size={size}
            accentColor={accentColor}
            showName={size !== 'thumbnail'}
            subtitle={size !== 'thumbnail' ? 'Camera off' : undefined}
          />
        </div>
      )}

      {/* Blur toggle - top right of local video */}
      {!isVideoOff && isBlurSupported && onToggleBlur && size !== 'thumbnail' && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBlur(); }}
          disabled={isBlurLoading}
          className={`absolute bottom-2 right-2 z-50 p-2.5 rounded-xl transition-all duration-200 backdrop-blur-sm
            ${isBlurEnabled
              ? 'bg-white/25 text-white hover:bg-white/35'
              : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'}
            ${isBlurLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:scale-110 active:scale-95'}
          `}
          title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
        >
          {isBlurLoading ? <span className="block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <BlurIcon enabled={isBlurEnabled} />}
        </button>
      )}

      {/* Name label - positioned outside overflow-hidden area */}
      <div className={`absolute bg-black/80 text-white rounded z-50 ${labelClass}`}>
        Me
      </div>
    </div>
  );
});

export default LocalVideo;
