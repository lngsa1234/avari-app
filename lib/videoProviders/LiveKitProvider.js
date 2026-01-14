/**
 * LiveKit Video Provider
 *
 * Used for Admin Scheduled Meetups (large groups)
 * Implements BaseVideoProvider interface for LiveKit SDK
 * Supports transcription for enhanced recaps
 */

import { BaseVideoProvider, ProviderEvents } from './types';

class LiveKitProvider extends BaseVideoProvider {
  constructor(config = {}) {
    super(config);
    this.room = null;
    this.localParticipant = null;
    this.serverUrl = config.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL;
    this.metricsInterval = null;
    this.transcriptionEnabled = false;
  }

  async join(joinConfig) {
    const { roomId, userId, userName, token } = joinConfig;

    if (!this.serverUrl) {
      throw new Error('LiveKit server URL not configured');
    }

    this.state.isConnecting = true;
    this.emit(ProviderEvents.RECONNECTING, {});

    try {
      // Dynamically import LiveKit SDK
      const { Room, RoomEvent, VideoPresets, Track } = await import('livekit-client');

      // Create room instance
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      // Set up event handlers before connecting
      this._setupEventHandlers(RoomEvent, Track);

      // Get token if not provided
      let accessToken = token;
      if (!accessToken) {
        accessToken = await this._fetchToken(roomId, userId, userName);
      }

      console.log('[LiveKitProvider] Connecting to room:', roomId);

      // Connect to room
      await this.room.connect(this.serverUrl, accessToken);

      this.localParticipant = this.room.localParticipant;

      // Enable camera and microphone
      await this.room.localParticipant.enableCameraAndMicrophone();

      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.isPublishing = true;

      // Start metrics collection
      this._startMetricsCollection();

      // Enable transcription if configured
      if (this.config.enableTranscription) {
        this.enableTranscription();
      }

      this.emit(ProviderEvents.CONNECTED, { userId });

      console.log('[LiveKitProvider] Successfully connected and publishing');

      return userId;
    } catch (error) {
      this.state.isConnecting = false;
      this.state.error = error.message;
      this.emit(ProviderEvents.CONNECTION_ERROR, { error });
      throw error;
    }
  }

  async leave() {
    console.log('[LiveKitProvider] Disconnecting from room...');

    this._stopMetricsCollection();

    try {
      if (this.room) {
        await this.room.disconnect();
        this.room = null;
      }

      this.localParticipant = null;
      this.state.isConnected = false;
      this.state.isPublishing = false;
      this.state.isScreenSharing = false;
      this.participants.clear();

      this.emit(ProviderEvents.DISCONNECTED, {});

      console.log('[LiveKitProvider] Successfully disconnected');
    } catch (error) {
      console.error('[LiveKitProvider] Error disconnecting:', error);
    }
  }

  getLocalTracks() {
    if (!this.localParticipant) {
      return { audio: null, video: null, screen: null };
    }

    const audioTrack = this.localParticipant.getTrack('microphone');
    const videoTrack = this.localParticipant.getTrack('camera');
    const screenTrack = this.localParticipant.getTrack('screen_share');

    return {
      audio: audioTrack ? {
        track: audioTrack.track,
        enabled: !audioTrack.isMuted,
        kind: 'audio'
      } : null,
      video: videoTrack ? {
        track: videoTrack.track,
        enabled: !videoTrack.isMuted,
        kind: 'video'
      } : null,
      screen: screenTrack ? {
        track: screenTrack.track,
        enabled: !screenTrack.isMuted,
        kind: 'video'
      } : null
    };
  }

  async toggleAudio(enabled) {
    if (this.localParticipant) {
      await this.localParticipant.setMicrophoneEnabled(enabled);
      console.log('[LiveKitProvider] Audio', enabled ? 'unmuted' : 'muted');
      return enabled;
    }
    return false;
  }

  async toggleVideo(enabled) {
    if (this.localParticipant) {
      await this.localParticipant.setCameraEnabled(enabled);
      console.log('[LiveKitProvider] Video', enabled ? 'on' : 'off');
      return enabled;
    }
    return false;
  }

  async startScreenShare() {
    if (!this.localParticipant || this.state.isScreenSharing) return;

    try {
      console.log('[LiveKitProvider] Starting screen share...');
      await this.localParticipant.setScreenShareEnabled(true);
      this.state.isScreenSharing = true;
      console.log('[LiveKitProvider] Screen share started');
    } catch (error) {
      console.error('[LiveKitProvider] Failed to start screen share:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    if (!this.localParticipant || !this.state.isScreenSharing) return;

    try {
      console.log('[LiveKitProvider] Stopping screen share...');
      await this.localParticipant.setScreenShareEnabled(false);
      this.state.isScreenSharing = false;
      console.log('[LiveKitProvider] Screen share stopped');
    } catch (error) {
      console.error('[LiveKitProvider] Failed to stop screen share:', error);
    }
  }

  enableTranscription(lang = 'en') {
    this.transcriptionEnabled = true;
    console.log('[LiveKitProvider] Transcription enabled for language:', lang);
    // Note: Actual transcription requires LiveKit server-side agent setup
    // The transcript data will come via data channel events
  }

  // Private methods

  async _fetchToken(roomId, userId, userName) {
    try {
      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, participantId: userId, participantName: userName })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LiveKit token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('[LiveKitProvider] Error fetching token:', error);
      throw error;
    }
  }

  _setupEventHandlers(RoomEvent, Track) {
    // Participant connected
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveKitProvider] Participant connected:', participant.identity);

      const participantData = {
        id: participant.identity,
        name: participant.name || participant.identity,
        audioTrack: null,
        videoTrack: null,
        isSpeaking: false,
        speakingTime: 0
      };

      this.participants.set(participant.identity, participantData);
      this.emit(ProviderEvents.PARTICIPANT_JOINED, { participant: participantData });
    });

    // Participant disconnected
    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[LiveKitProvider] Participant disconnected:', participant.identity);

      const participantData = this.participants.get(participant.identity);
      this.participants.delete(participant.identity);
      this.emit(ProviderEvents.PARTICIPANT_LEFT, { participant: participantData });
    });

    // Track subscribed
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[LiveKitProvider] Track subscribed:', track.kind, 'from', participant.identity);

      const participantData = this.participants.get(participant.identity) || {
        id: participant.identity,
        name: participant.name || participant.identity,
        audioTrack: null,
        videoTrack: null,
        isSpeaking: false,
        speakingTime: 0
      };

      if (track.kind === Track.Kind.Video) {
        participantData.videoTrack = {
          track: track,
          enabled: true,
          kind: 'video'
        };
      } else if (track.kind === Track.Kind.Audio) {
        participantData.audioTrack = {
          track: track,
          enabled: true,
          kind: 'audio'
        };
      }

      this.participants.set(participant.identity, participantData);
      this.emit(ProviderEvents.TRACK_PUBLISHED, { participant: participantData, track });
    });

    // Track unsubscribed
    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('[LiveKitProvider] Track unsubscribed:', track.kind, 'from', participant.identity);

      const participantData = this.participants.get(participant.identity);
      if (participantData) {
        if (track.kind === Track.Kind.Video) {
          participantData.videoTrack = null;
        } else if (track.kind === Track.Kind.Audio) {
          participantData.audioTrack = null;
        }
        this.participants.set(participant.identity, participantData);
        this.emit(ProviderEvents.TRACK_UNPUBLISHED, { participant: participantData, track });
      }
    });

    // Active speaker changed
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      // Update speaking status for all participants
      this.participants.forEach((participant, id) => {
        const isSpeaking = speakers.some(s => s.identity === id);
        if (participant.isSpeaking !== isSpeaking) {
          participant.isSpeaking = isSpeaking;
          this.emit(ProviderEvents.SPEAKING_CHANGED, { participant, isSpeaking });
        }
      });
    });

    // Data received (for transcription)
    this.room.on(RoomEvent.DataReceived, (payload, participant, kind) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));

        // Handle transcription data
        if (data.type === 'transcription') {
          const entry = {
            speakerId: participant?.identity || 'unknown',
            speakerName: participant?.name || 'Unknown',
            text: data.text,
            timestamp: Date.now(),
            isFinal: data.isFinal
          };

          this.transcript.push(entry);
          this.emit(ProviderEvents.TRANSCRIPT_RECEIVED, { entry });
        }
      } catch (e) {
        // Not JSON or not transcription data
      }
    });

    // Disconnected
    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log('[LiveKitProvider] Disconnected:', reason);
      this.state.isConnected = false;
      this.emit(ProviderEvents.DISCONNECTED, { reason });
    });

    // Reconnecting
    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('[LiveKitProvider] Reconnecting...');
      this.emit(ProviderEvents.RECONNECTING, {});
    });

    // Reconnected
    this.room.on(RoomEvent.Reconnected, () => {
      console.log('[LiveKitProvider] Reconnected');
      this.state.isConnected = true;
      this.emit(ProviderEvents.CONNECTED, {});
    });
  }

  _startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      if (this.room && this.localParticipant) {
        try {
          // Get connection stats
          const stats = await this.room.engine?.getStats();

          if (stats) {
            // Process stats to extract metrics
            let totalRtt = 0;
            let rttCount = 0;
            let totalBitrate = 0;

            stats.forEach((stat) => {
              if (stat.roundTripTime) {
                totalRtt += stat.roundTripTime * 1000;
                rttCount++;
              }
              if (stat.bytesSent) {
                totalBitrate += stat.bytesSent;
              }
            });

            this.metrics = {
              latency: rttCount > 0 ? Math.round(totalRtt / rttCount) : 0,
              packetLoss: 0, // Would need more detailed stats
              bitrate: Math.round(totalBitrate / 1000),
              videoResolution: this._getVideoResolution(),
              fps: 30, // Default, would need track stats
              connectionQuality: this._calculateConnectionQuality({ RTT: totalRtt / rttCount })
            };

            this.emit(ProviderEvents.METRICS_UPDATED, { metrics: this.metrics });
          }
        } catch (e) {
          // Stats not available
        }
      }
    }, 5000);
  }

  _stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  _getVideoResolution() {
    const videoTrack = this.localParticipant?.getTrack('camera');
    if (videoTrack?.track) {
      const settings = videoTrack.track.mediaStreamTrack?.getSettings();
      if (settings) {
        return `${settings.width || 0}x${settings.height || 0}`;
      }
    }
    return '1280x720';
  }

  _calculateConnectionQuality(stats) {
    const rtt = stats.RTT || 0;
    if (rtt < 100) return 'excellent';
    if (rtt < 200) return 'good';
    if (rtt < 400) return 'fair';
    return 'poor';
  }

  destroy() {
    this._stopMetricsCollection();
    if (this.room) {
      this.room.removeAllListeners();
    }
    super.destroy();
  }
}

export default LiveKitProvider;
