/**
 * Video Provider Types and Interfaces
 *
 * This module defines the common interface that all video providers must implement.
 * Providers: WebRTC (1:1), LiveKit (meetups), Agora (connection groups)
 */

/**
 * @typedef {Object} TrackInfo
 * @property {MediaStreamTrack|Object} track - The media track
 * @property {boolean} enabled - Whether the track is enabled
 * @property {string} kind - 'audio' or 'video'
 */

/**
 * @typedef {Object} LocalTracks
 * @property {TrackInfo|null} audio - Local audio track
 * @property {TrackInfo|null} video - Local video track
 * @property {TrackInfo|null} screen - Screen share track
 */

/**
 * @typedef {Object} RemoteParticipant
 * @property {string} id - Participant ID
 * @property {string} name - Participant name
 * @property {TrackInfo|null} audioTrack - Remote audio track
 * @property {TrackInfo|null} videoTrack - Remote video track
 * @property {boolean} isSpeaking - Whether participant is currently speaking
 * @property {number} speakingTime - Total speaking time in seconds
 */

/**
 * @typedef {Object} CallMetrics
 * @property {number} latency - Round-trip latency in ms
 * @property {number} packetLoss - Packet loss percentage
 * @property {number} bitrate - Current bitrate in kbps
 * @property {string} videoResolution - e.g., '1280x720'
 * @property {number} fps - Frames per second
 * @property {string} connectionQuality - 'excellent', 'good', 'fair', 'poor'
 */

/**
 * @typedef {Object} TranscriptEntry
 * @property {string} speakerId - ID of the speaker
 * @property {string} speakerName - Name of the speaker
 * @property {string} text - Transcribed text
 * @property {number} timestamp - Unix timestamp
 * @property {boolean} isFinal - Whether this is a final transcription
 */

/**
 * @typedef {Object} JoinConfig
 * @property {string} roomId - Room/channel identifier
 * @property {string} userId - Current user ID
 * @property {string} userName - Current user name
 * @property {string} [token] - Authentication token (provider-specific)
 * @property {boolean} [enableTranscription] - Enable speech-to-text
 */

/**
 * @typedef {Object} ProviderState
 * @property {boolean} isConnected - Whether connected to the room
 * @property {boolean} isConnecting - Whether currently connecting
 * @property {boolean} isPublishing - Whether publishing local tracks
 * @property {boolean} isScreenSharing - Whether screen sharing is active
 * @property {boolean} isRecording - Whether recording is active
 * @property {string|null} error - Current error message if any
 */

/**
 * Provider event types
 */
export const ProviderEvents = {
  // Connection events
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTION_ERROR: 'connection-error',
  RECONNECTING: 'reconnecting',

  // Participant events
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  PARTICIPANT_UPDATED: 'participant-updated',

  // Track events
  TRACK_PUBLISHED: 'track-published',
  TRACK_UNPUBLISHED: 'track-unpublished',
  TRACK_MUTED: 'track-muted',
  TRACK_UNMUTED: 'track-unmuted',

  // Transcription events
  TRANSCRIPT_RECEIVED: 'transcript-received',

  // Metrics events
  METRICS_UPDATED: 'metrics-updated',

  // Speaking events
  SPEAKING_CHANGED: 'speaking-changed',
};

/**
 * Provider types
 */
export const ProviderType = {
  WEBRTC: 'webrtc',
  LIVEKIT: 'livekit',
  AGORA: 'agora',
};

/**
 * Call types mapped to providers
 */
export const CallTypeProvider = {
  '1on1': ProviderType.WEBRTC,
  'meetup': ProviderType.LIVEKIT,
  'group': ProviderType.AGORA,
};

/**
 * Base Video Provider Interface
 * All providers must implement these methods
 */
export class BaseVideoProvider {
  constructor(config = {}) {
    this.config = config;
    this.listeners = new Map();
    this.state = {
      isConnected: false,
      isConnecting: false,
      isPublishing: false,
      isScreenSharing: false,
      isRecording: false,
      error: null,
    };
    this.metrics = {
      latency: 0,
      packetLoss: 0,
      bitrate: 0,
      videoResolution: '',
      fps: 0,
      connectionQuality: 'unknown',
    };
    this.transcript = [];
    this.participants = new Map();
  }

  // Connection methods
  async join(config) {
    throw new Error('join() must be implemented by provider');
  }

  async leave() {
    throw new Error('leave() must be implemented by provider');
  }

  // Track management
  getLocalTracks() {
    throw new Error('getLocalTracks() must be implemented by provider');
  }

  getRemoteParticipants() {
    return this.participants;
  }

  async toggleAudio(enabled) {
    throw new Error('toggleAudio() must be implemented by provider');
  }

  async toggleVideo(enabled) {
    throw new Error('toggleVideo() must be implemented by provider');
  }

  async startScreenShare() {
    throw new Error('startScreenShare() must be implemented by provider');
  }

  async stopScreenShare() {
    throw new Error('stopScreenShare() must be implemented by provider');
  }

  // Analytics & Transcription
  getCallMetrics() {
    return this.metrics;
  }

  enableTranscription(lang = 'en') {
    console.warn('Transcription not supported by this provider');
  }

  getTranscript() {
    return this.transcript;
  }

  // State
  getState() {
    return { ...this.state };
  }

  // Event handling
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }

  // Cleanup
  destroy() {
    this.listeners.clear();
    this.participants.clear();
    this.transcript = [];
  }
}

export default BaseVideoProvider;
