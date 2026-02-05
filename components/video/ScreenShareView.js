'use client';

import { useEffect, useRef } from 'react';

/**
 * Screen Share View Component
 * Renders screen share - full width when viewing, side panel when sharing
 *
 * @param {boolean} compact - If true, renders in compact side panel mode
 */
export default function ScreenShareView({
  screenTrack,
  isLocal = false,
  providerType = 'webrtc',
  sharerName = 'Unknown',
  onStopSharing,
  compact = false,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!screenTrack || !videoRef.current) return;

    // Attach track based on provider type
    if (providerType === 'webrtc') {
      // WebRTC: screenTrack is a MediaStream or MediaStreamTrack
      if (screenTrack instanceof MediaStream) {
        videoRef.current.srcObject = screenTrack;
      } else if (screenTrack instanceof MediaStreamTrack) {
        videoRef.current.srcObject = new MediaStream([screenTrack]);
      }
    } else if (providerType === 'livekit') {
      // LiveKit: screenTrack is a RemoteVideoTrack or LocalVideoTrack
      if (screenTrack.attach) {
        screenTrack.attach(videoRef.current);
      } else if (screenTrack.mediaStreamTrack) {
        videoRef.current.srcObject = new MediaStream([screenTrack.mediaStreamTrack]);
      }
    } else if (providerType === 'agora') {
      // Agora: screenTrack has play method
      if (screenTrack.play) {
        screenTrack.play(videoRef.current);
      }
    }

    return () => {
      // Cleanup
      if (providerType === 'livekit' && screenTrack?.detach) {
        screenTrack.detach(videoRef.current);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [screenTrack, providerType]);

  if (!screenTrack) return null;

  return (
    <div className="relative w-full h-full bg-stone-900 rounded-xl overflow-hidden">
      {/* Screen share video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-contain bg-black"
      />

      {/* Overlay with info */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">
              🖥️ {isLocal ? 'You are sharing your screen' : `${sharerName} is sharing their screen`}
            </span>
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              LIVE
            </span>
          </div>

          {/* Stop sharing button (only for local screen share) */}
          {isLocal && onStopSharing && (
            <button
              onClick={onStopSharing}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition"
            >
              Stop Sharing
            </button>
          )}
        </div>
      </div>

      {/* Bottom gradient for aesthetics */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
