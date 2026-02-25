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

      case 'livekit': {
        // LiveKit tracks have attach() method but need a <video>/<audio> element, not a div
        if (track.attach) {
          let targetEl = element;
          if (element.tagName === 'DIV') {
            const tag = trackType === 'audio' ? 'audio' : 'video';
            targetEl = element.querySelector(tag);
            if (!targetEl) {
              targetEl = document.createElement(tag);
              targetEl.autoplay = true;
              targetEl.playsInline = true;
              if (tag === 'video') {
                Object.assign(targetEl.style, {
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: 'none',
                });
              }
              element.appendChild(targetEl);
            }
          }
          track.attach(targetEl);
          // Ensure no mirror transform is applied to remote video
          if (trackType === 'video' && targetEl.tagName === 'VIDEO') {
            targetEl.style.setProperty('transform', 'none', 'important');
          }
        }
        break;
      }

      case 'webrtc': {
        // WebRTC uses MediaStream — needs a <video>/<audio> element.
        // If the target is a container div (e.g. RemoteVideo), create a
        // media element inside it, similar to how Agora/LiveKit work.
        let mediaEl = element;
        if (element.tagName === 'DIV') {
          const tag = trackType === 'audio' ? 'audio' : 'video';
          // Reuse existing child media element if present
          mediaEl = element.querySelector(tag);
          if (!mediaEl) {
            mediaEl = document.createElement(tag);
            mediaEl.autoplay = true;
            mediaEl.playsInline = true;
            if (tag === 'video') {
              Object.assign(mediaEl.style, {
                width: '100%', height: '100%', objectFit: 'cover',
              });
            }
            element.appendChild(mediaEl);
          }
          // Always ensure remote video is not mirrored (use !important to override any CSS)
          if (tag === 'video') {
            mediaEl.style.setProperty('transform', 'none', 'important');
          }
        }
        if (track instanceof MediaStream) {
          mediaEl.srcObject = track;
        } else if (track instanceof MediaStreamTrack) {
          mediaEl.srcObject = new MediaStream([track]);
        } else if (track.mediaStreamTrack) {
          mediaEl.srcObject = new MediaStream([track.mediaStreamTrack]);
        }
        // Don't call play() immediately — it races with the autoplay attribute
        // and causes AbortError. Instead, defer play as a fallback in case
        // autoplay doesn't kick in (e.g. unmuted remote audio on mobile Safari).
        setTimeout(() => {
          if (mediaEl.paused && mediaEl.srcObject) {
            mediaEl.play?.().catch(() => {});
          }
        }, 100);
        break;
      }

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
          if (element.tagName === 'DIV') {
            const child = element.querySelector('video') || element.querySelector('audio');
            if (child) {
              track.detach(child);
              child.remove();
            }
          } else {
            track.detach(element);
          }
        }
        break;

      case 'webrtc':
        // Clear the srcObject — handle both direct media elements and container divs
        if (element.tagName === 'DIV') {
          const child = element.querySelector('video') || element.querySelector('audio');
          if (child) {
            child.srcObject = null;
            child.remove();
          }
        } else {
          element.srcObject = null;
        }
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
