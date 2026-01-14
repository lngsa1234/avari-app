/**
 * Agora Video Provider
 *
 * Used for Connection Groups (3-4 people)
 * Implements BaseVideoProvider interface for Agora SDK
 */

import { BaseVideoProvider, ProviderEvents } from './types';

class AgoraProvider extends BaseVideoProvider {
  constructor(config = {}) {
    super(config);
    this.client = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.localScreenTrack = null;
    this.AgoraRTC = null;
    this.metricsInterval = null;
  }

  async join(joinConfig) {
    const { roomId, userId, userName, token = null } = joinConfig;
    const appId = this.config.appId;

    if (!appId) {
      throw new Error('Agora App ID not configured');
    }

    this.state.isConnecting = true;
    this.emit(ProviderEvents.RECONNECTING, {});

    try {
      // Dynamically import Agora SDK
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      this.AgoraRTC = AgoraRTC;

      // Create client
      this.client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });

      // Set up event handlers
      this._setupEventHandlers();

      // Convert UUID to numeric UID if needed
      const numericUid = this._generateNumericUid(userId);

      console.log('[AgoraProvider] Joining channel:', roomId, 'with UID:', numericUid);

      // Join channel
      await this.client.join(appId, roomId, token, numericUid);

      // Create local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          encoderConfig: 'music_standard',
          echoCancellation: true,
          noiseSuppression: true
        },
        {
          encoderConfig: {
            width: 640,
            height: 480,
            frameRate: 15,
            bitrateMin: 600,
            bitrateMax: 1000
          }
        }
      );

      this.localAudioTrack = audioTrack;
      this.localVideoTrack = videoTrack;

      // Publish tracks
      await this.client.publish([audioTrack, videoTrack]);

      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.isPublishing = true;

      // Start metrics collection
      this._startMetricsCollection();

      this.emit(ProviderEvents.CONNECTED, { userId: numericUid });

      console.log('[AgoraProvider] Successfully joined and published');

      return numericUid;
    } catch (error) {
      this.state.isConnecting = false;
      this.state.error = error.message;
      this.emit(ProviderEvents.CONNECTION_ERROR, { error });
      throw error;
    }
  }

  async leave() {
    console.log('[AgoraProvider] Leaving channel...');

    // Stop metrics collection
    this._stopMetricsCollection();

    try {
      // Stop and close local tracks
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }

      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }

      if (this.localScreenTrack) {
        this.localScreenTrack.stop();
        this.localScreenTrack.close();
        this.localScreenTrack = null;
      }

      // Leave channel
      if (this.client && (this.client.connectionState === 'CONNECTED' || this.client.connectionState === 'CONNECTING')) {
        await this.client.leave();
      }

      this.state.isConnected = false;
      this.state.isPublishing = false;
      this.state.isScreenSharing = false;
      this.participants.clear();

      this.emit(ProviderEvents.DISCONNECTED, {});

      console.log('[AgoraProvider] Successfully left channel');
    } catch (error) {
      console.error('[AgoraProvider] Error leaving channel:', error);
    }
  }

  getLocalTracks() {
    return {
      audio: this.localAudioTrack ? {
        track: this.localAudioTrack,
        enabled: this.localAudioTrack.enabled,
        kind: 'audio'
      } : null,
      video: this.localVideoTrack ? {
        track: this.localVideoTrack,
        enabled: this.localVideoTrack.enabled,
        kind: 'video'
      } : null,
      screen: this.localScreenTrack ? {
        track: this.localScreenTrack,
        enabled: true,
        kind: 'video'
      } : null
    };
  }

  async toggleAudio(enabled) {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(enabled);
      console.log('[AgoraProvider] Audio', enabled ? 'unmuted' : 'muted');
      return enabled;
    }
    return false;
  }

  async toggleVideo(enabled) {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(enabled);
      console.log('[AgoraProvider] Video', enabled ? 'on' : 'off');
      return enabled;
    }
    return false;
  }

  async startScreenShare() {
    if (!this.client || this.state.isScreenSharing) return;

    try {
      console.log('[AgoraProvider] Starting screen share...');

      const screenTrack = await this.AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
      }, 'auto');

      this.localScreenTrack = screenTrack;

      // Unpublish camera video
      if (this.localVideoTrack) {
        await this.client.unpublish(this.localVideoTrack);
      }

      // Publish screen track
      await this.client.publish(screenTrack);
      this.state.isScreenSharing = true;

      // Handle screen share stopped by browser
      screenTrack.on('track-ended', async () => {
        console.log('[AgoraProvider] Screen share stopped by user');
        await this.stopScreenShare();
      });

      console.log('[AgoraProvider] Screen share started');
    } catch (error) {
      console.error('[AgoraProvider] Failed to start screen share:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    if (!this.client || !this.localScreenTrack) return;

    try {
      console.log('[AgoraProvider] Stopping screen share...');

      await this.client.unpublish(this.localScreenTrack);
      this.localScreenTrack.close();
      this.localScreenTrack = null;

      // Republish camera video
      if (this.localVideoTrack) {
        await this.client.publish(this.localVideoTrack);
      }

      this.state.isScreenSharing = false;
      console.log('[AgoraProvider] Screen share stopped');
    } catch (error) {
      console.error('[AgoraProvider] Failed to stop screen share:', error);
    }
  }

  // Private methods

  _setupEventHandlers() {
    // Remote user published media
    this.client.on('user-published', async (user, mediaType) => {
      console.log('[AgoraProvider] User published:', user.uid, mediaType);

      try {
        await this.client.subscribe(user, mediaType);

        const participant = this.participants.get(user.uid) || {
          id: user.uid,
          name: `User ${user.uid}`,
          audioTrack: null,
          videoTrack: null,
          isSpeaking: false,
          speakingTime: 0
        };

        if (mediaType === 'video') {
          participant.videoTrack = {
            track: user.videoTrack,
            enabled: true,
            kind: 'video'
          };
        }

        if (mediaType === 'audio') {
          participant.audioTrack = {
            track: user.audioTrack,
            enabled: true,
            kind: 'audio'
          };
          // Auto-play remote audio
          user.audioTrack?.play();
        }

        this.participants.set(user.uid, participant);
        this.emit(ProviderEvents.TRACK_PUBLISHED, { participant, mediaType });
        this.emit(ProviderEvents.PARTICIPANT_UPDATED, { participant });

      } catch (error) {
        console.error('[AgoraProvider] Error subscribing to user:', error);
      }
    });

    // Remote user unpublished media
    this.client.on('user-unpublished', (user, mediaType) => {
      console.log('[AgoraProvider] User unpublished:', user.uid, mediaType);

      const participant = this.participants.get(user.uid);
      if (participant) {
        if (mediaType === 'video') {
          participant.videoTrack = null;
        }
        if (mediaType === 'audio') {
          participant.audioTrack = null;
        }
        this.participants.set(user.uid, participant);
        this.emit(ProviderEvents.TRACK_UNPUBLISHED, { participant, mediaType });
      }
    });

    // Remote user left
    this.client.on('user-left', (user) => {
      console.log('[AgoraProvider] User left:', user.uid);
      const participant = this.participants.get(user.uid);
      this.participants.delete(user.uid);
      this.emit(ProviderEvents.PARTICIPANT_LEFT, { participant });
    });

    // Connection state changed
    this.client.on('connection-state-change', (curState, prevState) => {
      console.log('[AgoraProvider] Connection state:', prevState, '->', curState);

      if (curState === 'DISCONNECTED') {
        this.state.isConnected = false;
        this.emit(ProviderEvents.DISCONNECTED, {});
      } else if (curState === 'CONNECTED') {
        this.state.isConnected = true;
        this.emit(ProviderEvents.CONNECTED, {});
      }
    });
  }

  _startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      if (this.client) {
        const stats = this.client.getRTCStats();

        this.metrics = {
          latency: stats.RTT || 0,
          packetLoss: stats.OutgoingAvailableBandwidth ? 0 : 5, // Estimate
          bitrate: (stats.SendBitrate || 0) / 1000, // Convert to kbps
          videoResolution: this.localVideoTrack ?
            `${this.localVideoTrack.getMediaStreamTrack()?.getSettings()?.width || 0}x${this.localVideoTrack.getMediaStreamTrack()?.getSettings()?.height || 0}` : '',
          fps: this.localVideoTrack ?
            this.localVideoTrack.getMediaStreamTrack()?.getSettings()?.frameRate || 0 : 0,
          connectionQuality: this._calculateConnectionQuality(stats)
        };

        this.emit(ProviderEvents.METRICS_UPDATED, { metrics: this.metrics });
      }
    }, 5000);
  }

  _stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  _calculateConnectionQuality(stats) {
    const rtt = stats.RTT || 0;
    if (rtt < 100) return 'excellent';
    if (rtt < 200) return 'good';
    if (rtt < 400) return 'fair';
    return 'poor';
  }

  _generateNumericUid(uuidString) {
    let hash = 0;
    for (let i = 0; i < uuidString.length; i++) {
      const char = uuidString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  destroy() {
    this._stopMetricsCollection();
    if (this.client) {
      this.client.removeAllListeners();
    }
    super.destroy();
  }
}

export default AgoraProvider;
