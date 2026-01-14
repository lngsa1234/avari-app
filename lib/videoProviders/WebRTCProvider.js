/**
 * WebRTC Video Provider
 *
 * Used for 1:1 Coffee Chats (peer-to-peer)
 * Implements BaseVideoProvider interface for native WebRTC
 * Uses Socket.IO signaling server for connection establishment
 */

import { BaseVideoProvider, ProviderEvents } from './types';

class WebRTCProvider extends BaseVideoProvider {
  constructor(config = {}) {
    super(config);
    this.peerConnection = null;
    this.localStream = null;
    this.screenStream = null;
    this.signalingSocket = null;
    this.iceServers = [];
    this.remoteUserId = null;
    this.metricsInterval = null;
  }

  async join(joinConfig) {
    const { roomId, userId, userName, otherUserId, iceServers = [] } = joinConfig;

    this.remoteUserId = otherUserId;
    this.iceServers = iceServers.length > 0 ? iceServers : await this._fetchIceServers();

    this.state.isConnecting = true;
    this.emit(ProviderEvents.RECONNECTING, {});

    try {
      console.log('[WebRTCProvider] Setting up peer connection');

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

      // Set up event handlers
      this._setupPeerConnectionHandlers();

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.state.isPublishing = true;

      // Start metrics collection
      this._startMetricsCollection();

      console.log('[WebRTCProvider] Local media ready');

      return userId;
    } catch (error) {
      this.state.isConnecting = false;
      this.state.error = error.message;
      this.emit(ProviderEvents.CONNECTION_ERROR, { error });
      throw error;
    }
  }

  async leave() {
    console.log('[WebRTCProvider] Closing connection...');

    this._stopMetricsCollection();

    try {
      // Stop local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      // Stop screen share
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
        this.screenStream = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      this.state.isConnected = false;
      this.state.isPublishing = false;
      this.state.isScreenSharing = false;
      this.participants.clear();

      this.emit(ProviderEvents.DISCONNECTED, {});

      console.log('[WebRTCProvider] Connection closed');
    } catch (error) {
      console.error('[WebRTCProvider] Error closing connection:', error);
    }
  }

  getLocalTracks() {
    if (!this.localStream) {
      return { audio: null, video: null, screen: null };
    }

    const audioTrack = this.localStream.getAudioTracks()[0];
    const videoTrack = this.localStream.getVideoTracks()[0];
    const screenTrack = this.screenStream?.getVideoTracks()[0];

    return {
      audio: audioTrack ? {
        track: audioTrack,
        enabled: audioTrack.enabled,
        kind: 'audio'
      } : null,
      video: videoTrack ? {
        track: videoTrack,
        enabled: videoTrack.enabled,
        kind: 'video'
      } : null,
      screen: screenTrack ? {
        track: screenTrack,
        enabled: true,
        kind: 'video'
      } : null
    };
  }

  async toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      console.log('[WebRTCProvider] Audio', enabled ? 'unmuted' : 'muted');
      return enabled;
    }
    return false;
  }

  async toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      console.log('[WebRTCProvider] Video', enabled ? 'on' : 'off');
      return enabled;
    }
    return false;
  }

  async startScreenShare() {
    if (this.state.isScreenSharing) return;

    try {
      console.log('[WebRTCProvider] Starting screen share...');

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      // Replace video track in peer connection
      if (this.peerConnection) {
        const screenTrack = this.screenStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }

      // Handle user stopping share via browser button
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      this.state.isScreenSharing = true;
      console.log('[WebRTCProvider] Screen share started');
    } catch (error) {
      console.error('[WebRTCProvider] Failed to start screen share:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    if (!this.state.isScreenSharing) return;

    try {
      console.log('[WebRTCProvider] Stopping screen share...');

      // Stop screen stream
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      // Replace with camera video track
      if (this.peerConnection && this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }

      this.state.isScreenSharing = false;
      console.log('[WebRTCProvider] Screen share stopped');
    } catch (error) {
      console.error('[WebRTCProvider] Failed to stop screen share:', error);
    }
  }

  // WebRTC-specific methods for signaling

  async createOffer() {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer) {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('[WebRTCProvider] No peer connection for ICE candidate');
      return;
    }

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // Callbacks for signaling
  onIceCandidate(callback) {
    this._onIceCandidateCallback = callback;
  }

  onRemoteStream(callback) {
    this._onRemoteStreamCallback = callback;
  }

  // Private methods

  async _fetchIceServers() {
    try {
      const response = await fetch('/api/ice-servers');
      if (response.ok) {
        const data = await response.json();
        return data.iceServers;
      }
    } catch (e) {
      console.warn('[WebRTCProvider] Failed to fetch ICE servers, using default');
    }

    // Fallback to Google STUN
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  _setupPeerConnectionHandlers() {
    // ICE candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this._onIceCandidateCallback) {
        this._onIceCandidateCallback(event.candidate.toJSON());
      }
    };

    // Remote stream handler
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTCProvider] Received remote track:', event.track.kind);

      if (event.streams[0]) {
        const participant = {
          id: this.remoteUserId || 'remote',
          name: 'Remote User',
          audioTrack: null,
          videoTrack: null,
          isSpeaking: false,
          speakingTime: 0
        };

        // Get tracks from stream
        const audioTrack = event.streams[0].getAudioTracks()[0];
        const videoTrack = event.streams[0].getVideoTracks()[0];

        if (audioTrack) {
          participant.audioTrack = {
            track: audioTrack,
            enabled: audioTrack.enabled,
            kind: 'audio'
          };
        }

        if (videoTrack) {
          participant.videoTrack = {
            track: videoTrack,
            enabled: videoTrack.enabled,
            kind: 'video'
          };
        }

        this.participants.set(participant.id, participant);
        this.emit(ProviderEvents.TRACK_PUBLISHED, { participant, stream: event.streams[0] });

        if (this._onRemoteStreamCallback) {
          this._onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    // Connection state handler
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[WebRTCProvider] Connection state:', state);

      if (state === 'connected') {
        this.state.isConnected = true;
        this.state.isConnecting = false;
        this.emit(ProviderEvents.CONNECTED, {});
      } else if (state === 'failed' || state === 'disconnected') {
        this.state.isConnected = false;
        this.emit(ProviderEvents.DISCONNECTED, { reason: state });
      }
    };

    // ICE connection state handler
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTCProvider] ICE connection state:', this.peerConnection.iceConnectionState);
    };
  }

  _startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      if (this.peerConnection) {
        try {
          const stats = await this.peerConnection.getStats();
          let rtt = 0;
          let packetLoss = 0;
          let bitrate = 0;

          stats.forEach((stat) => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
            }
            if (stat.type === 'inbound-rtp' && stat.packetsLost !== undefined) {
              const total = stat.packetsReceived + stat.packetsLost;
              packetLoss = total > 0 ? (stat.packetsLost / total) * 100 : 0;
            }
            if (stat.type === 'outbound-rtp' && stat.bytesSent) {
              bitrate = stat.bytesSent / 1000;
            }
          });

          this.metrics = {
            latency: Math.round(rtt),
            packetLoss: Math.round(packetLoss * 100) / 100,
            bitrate: Math.round(bitrate),
            videoResolution: this._getVideoResolution(),
            fps: 30,
            connectionQuality: this._calculateConnectionQuality({ RTT: rtt })
          };

          this.emit(ProviderEvents.METRICS_UPDATED, { metrics: this.metrics });
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
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
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
    super.destroy();
  }
}

export default WebRTCProvider;
