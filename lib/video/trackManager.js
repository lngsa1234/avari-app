/**
 * Track Manager
 * Unified track attachment/detachment logic for all video providers
 */

/**
 * Attach a track to a DOM element
 * @param {Object} track - The media track (provider-specific)
 * @param {HTMLElement} element - The DOM element to attach to
 * @param {string} provider - Provider type: 'agora', 'livekit', 'webrtc'
 * @param {string} trackType - Track type: 'video' or 'audio'
 */
export function attachTrack(track, element, provider, trackType = 'video') {
  if (!track || !element) return;

  try {
    switch (provider) {
      case 'agora':
        // Agora tracks have a play() method
        if (track.play) {
          track.play(element, { fit: 'cover' });
        }
        break;

      case 'livekit':
        // LiveKit tracks have attach() method
        if (track.attach) {
          track.attach(element);
          element.play?.().catch(e => {
            if (e.name !== 'AbortError') {
              console.log(`[TrackManager] ${trackType} autoplay prevented:`, e.name);
            }
          });
        }
        break;

      case 'webrtc':
        // WebRTC uses MediaStream
        if (track instanceof MediaStream) {
          element.srcObject = track;
        } else if (track instanceof MediaStreamTrack) {
          element.srcObject = new MediaStream([track]);
        } else if (track.mediaStreamTrack) {
          element.srcObject = new MediaStream([track.mediaStreamTrack]);
        }
        element.play?.().catch(() => {});
        break;

      default:
        console.warn('[TrackManager] Unknown provider:', provider);
    }
  } catch (e) {
    console.error(`[TrackManager] Error attaching ${trackType} track:`, e);
  }
}

/**
 * Detach a track from a DOM element
 * @param {Object} track - The media track (provider-specific)
 * @param {HTMLElement} element - The DOM element to detach from
 * @param {string} provider - Provider type: 'agora', 'livekit', 'webrtc'
 */
export function detachTrack(track, element, provider) {
  if (!element) return;

  try {
    switch (provider) {
      case 'agora':
        // Agora tracks have stop() method for video
        if (track?.stop) {
          // Note: calling stop() on Agora track stops it completely
          // Only call if we want to fully stop, not just detach
        }
        break;

      case 'livekit':
        // LiveKit tracks have detach() method
        if (track?.detach) {
          track.detach(element);
        }
        break;

      case 'webrtc':
        // Clear the srcObject
        element.srcObject = null;
        break;

      default:
        // Fallback: clear srcObject
        element.srcObject = null;
    }
  } catch (e) {
    // Ignore detach errors
  }
}

/**
 * Attach local track to video element (with mirror flip for self-view)
 * @param {Object} track - The local media track
 * @param {HTMLElement} element - The video element
 * @param {string} provider - Provider type
 */
export function attachLocalTrack(track, element, provider) {
  attachTrack(track, element, provider, 'video');
}

/**
 * Detach local track from video element
 * @param {Object} track - The local media track
 * @param {HTMLElement} element - The video element
 * @param {string} provider - Provider type
 */
export function detachLocalTrack(track, element, provider) {
  detachTrack(track, element, provider);
}

/**
 * Check if a track is valid and has media
 * @param {Object} track - The media track
 * @param {string} provider - Provider type
 * @returns {boolean}
 */
export function isTrackValid(track, provider) {
  if (!track) return false;

  switch (provider) {
    case 'agora':
      return track.isPlaying !== undefined || track._enabled !== false;
    case 'livekit':
      return !track.isMuted;
    case 'webrtc':
      if (track instanceof MediaStream) {
        return track.active && track.getTracks().length > 0;
      }
      if (track instanceof MediaStreamTrack) {
        return track.readyState === 'live';
      }
      return !!track;
    default:
      return !!track;
  }
}
