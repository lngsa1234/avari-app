'use client';

import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * Custom hook for Agora video calls (group meetups)
 * Handles multi-participant video calls with up to 17 participants
 */
export function useAgora() {
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const clientRef = useRef(null);
  const isJoiningRef = useRef(false); // Track if currently joining

  useEffect(() => {
    // Create Agora client with rtc mode for group calls
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });
    clientRef.current = client;

    // Event: Remote user published media
    client.on('user-published', async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);

      try {
        // Subscribe to the remote user
        await client.subscribe(user, mediaType);
        console.log('✅ Subscribed to user:', user.uid, mediaType);

        if (mediaType === 'video') {
          console.log('📹 Setting video track for user:', user.uid);
          setRemoteUsers(prev => {
            const updated = {
              ...prev,
              [user.uid]: {
                ...prev[user.uid],
                videoTrack: user.videoTrack,
                uid: user.uid
              }
            };
            console.log('📹 Updated remoteUsers:', Object.keys(updated));
            return updated;
          });
        }

        if (mediaType === 'audio') {
          console.log('🔊 Setting audio track for user:', user.uid);
          setRemoteUsers(prev => {
            const updated = {
              ...prev,
              [user.uid]: {
                ...prev[user.uid],
                audioTrack: user.audioTrack,
                uid: user.uid
              }
            };
            console.log('🔊 Updated remoteUsers:', Object.keys(updated));
            return updated;
          });
          // Auto-play remote audio
          user.audioTrack?.play();
        }
      } catch (error) {
        console.error('❌ Error subscribing to user:', error);
      }
    });

    // Event: Remote user unpublished media
    client.on('user-unpublished', (user, mediaType) => {
      console.log('📴 User unpublished:', user.uid, mediaType);

      if (mediaType === 'video') {
        setRemoteUsers(prev => {
          const updated = { ...prev };
          if (updated[user.uid]) {
            delete updated[user.uid].videoTrack;
          }
          return updated;
        });
      }

      if (mediaType === 'audio') {
        setRemoteUsers(prev => {
          const updated = { ...prev };
          if (updated[user.uid]) {
            delete updated[user.uid].audioTrack;
          }
          return updated;
        });
      }
    });

    // Event: Remote user left
    client.on('user-left', (user) => {
      console.log('👋 User left:', user.uid);
      setRemoteUsers(prev => {
        const updated = { ...prev };
        delete updated[user.uid];
        return updated;
      });
    });

    // Event: Connection state changed
    client.on('connection-state-change', (curState, prevState) => {
      console.log('🔄 Connection state changed:', prevState, '->', curState);
    });

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up Agora client');
      client.removeAllListeners();
    };
  }, []);

  /**
   * Join an Agora channel
   * @param {string} appId - Agora App ID
   * @param {string} channel - Channel name (e.g., meetup ID)
   * @param {string|null} token - Optional token for secure channels
   * @param {string|number|null} uid - Optional user ID
   */
  const join = async (appId, channel, token = null, uid = null) => {
    const client = clientRef.current;
    if (!client) {
      throw new Error('Agora client not initialized');
    }

    // Prevent duplicate joins
    if (isJoiningRef.current || isJoined) {
      console.log('⚠️ Already joining or joined, skipping');
      return;
    }

    try {
      isJoiningRef.current = true;
      console.log('🚀 Joining Agora channel:', channel);
      console.log('📊 Current connection state:', client.connectionState);

      // Join the channel
      const assignedUid = await client.join(appId, channel, token, uid);
      console.log('✅ Joined channel with UID:', assignedUid);

      // Create local audio and video tracks
      console.log('🎥 Creating local tracks...');
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {
          // Audio config
          encoderConfig: 'music_standard',
          echoCancellation: true,
          noiseSuppression: true
        },
        {
          // Video config
          encoderConfig: {
            width: 640,
            height: 480,
            frameRate: 15,
            bitrateMin: 600,
            bitrateMax: 1000
          }
        }
      );

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      // Publish tracks to the channel
      console.log('📡 Publishing local tracks...');
      await client.publish([audioTrack, videoTrack]);
      setIsPublishing(true);

      setIsJoined(true);
      isJoiningRef.current = false;
      console.log('✅ Successfully joined and published to channel:', channel);

      return assignedUid;
    } catch (error) {
      console.error('❌ Failed to join channel:', error);
      isJoiningRef.current = false;
      throw error;
    }
  };

  /**
   * Leave the Agora channel
   */
  const leave = async () => {
    const client = clientRef.current;

    console.log('👋 Leaving Agora channel...');

    try {
      // Stop and close local tracks
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }

      // Leave the channel (only if connected or connecting)
      if (client && (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING')) {
        await client.leave();
      }

      setIsJoined(false);
      setIsPublishing(false);
      setRemoteUsers({});
      isJoiningRef.current = false;

      console.log('✅ Successfully left channel');
    } catch (error) {
      console.error('❌ Error leaving channel:', error);
      isJoiningRef.current = false;
    }
  };

  /**
   * Toggle microphone on/off
   */
  const toggleMute = async () => {
    if (localAudioTrack) {
      const newState = !localAudioTrack.enabled;
      await localAudioTrack.setEnabled(newState);
      console.log('🎤 Audio', newState ? 'unmuted' : 'muted');
      return newState;
    }
    return false;
  };

  /**
   * Toggle camera on/off
   */
  const toggleVideo = async () => {
    if (localVideoTrack) {
      const newState = !localVideoTrack.enabled;
      await localVideoTrack.setEnabled(newState);
      console.log('📹 Video', newState ? 'on' : 'off');
      return newState;
    }
    return false;
  };

  /**
   * Start screen sharing
   */
  const startScreenShare = async () => {
    const client = clientRef.current;
    if (!client || isScreenSharing) return;

    try {
      console.log('🖥️ Starting screen share...');

      // Create screen track
      // Note: createScreenVideoTrack with 'auto' can return either:
      // - A single video track (if system audio not available)
      // - An array [videoTrack, audioTrack] (if system audio available)
      // Using 720p and VP8 for better Safari compatibility
      const screenTrackResult = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: {
          width: 1280,
          height: 720,
          frameRate: 15,
          bitrateMax: 1500,
        },
        optimizationMode: 'detail',
      }, 'disable'); // Disable system audio for better compatibility

      // Handle both cases - array or single track
      const screenVideoTrack = Array.isArray(screenTrackResult)
        ? screenTrackResult[0]
        : screenTrackResult;
      const screenAudioTrack = Array.isArray(screenTrackResult)
        ? screenTrackResult[1]
        : null;

      setLocalScreenTrack(screenVideoTrack);

      // Unpublish camera video
      if (localVideoTrack) {
        await client.unpublish(localVideoTrack);
      }

      // Publish screen track(s)
      if (screenAudioTrack) {
        await client.publish([screenVideoTrack, screenAudioTrack]);
      } else {
        await client.publish(screenVideoTrack);
      }
      setIsScreenSharing(true);

      console.log('✅ Screen share started');

      // Handle screen share stopped (user clicks browser stop button)
      screenVideoTrack.on('track-ended', async () => {
        console.log('🛑 Screen share stopped by user');
        await stopScreenShare();
      });

    } catch (error) {
      console.error('❌ Failed to start screen share:', error);
      throw error;
    }
  };

  /**
   * Stop screen sharing
   */
  const stopScreenShare = async () => {
    const client = clientRef.current;
    if (!client || !localScreenTrack) return;

    try {
      console.log('🛑 Stopping screen share...');

      // Unpublish and close screen track
      await client.unpublish(localScreenTrack);
      localScreenTrack.close();
      setLocalScreenTrack(null);

      // Republish camera video
      if (localVideoTrack) {
        await client.publish(localVideoTrack);
      }

      setIsScreenSharing(false);
      console.log('✅ Screen share stopped');

    } catch (error) {
      console.error('❌ Failed to stop screen share:', error);
    }
  };

  return {
    // Local tracks
    localAudioTrack,
    localVideoTrack,
    localScreenTrack,

    // Remote users
    remoteUsers,

    // State
    isJoined,
    isPublishing,
    isScreenSharing,

    // Actions
    join,
    leave,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
}
