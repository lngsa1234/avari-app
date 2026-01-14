'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createProvider, getProviderInfo, ProviderEvents } from '@/lib/videoProviders';

/**
 * Custom hook for managing video providers
 *
 * Usage:
 * const { join, leave, toggleAudio, toggleVideo, ... } = useVideoProvider('meetup');
 *
 * @param {'1on1' | 'meetup' | 'group'} callType - Type of call
 * @param {Object} config - Additional provider configuration
 */
export function useVideoProvider(callType, config = {}) {
  const [provider, setProvider] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState(null);
  const [localTracks, setLocalTracks] = useState({ audio: null, video: null, screen: null });
  const [participants, setParticipants] = useState(new Map());
  const [metrics, setMetrics] = useState(null);
  const [transcript, setTranscript] = useState([]);

  const providerRef = useRef(null);
  const isInitialized = useRef(false);

  // Provider info for display
  const providerInfo = getProviderInfo(callType);

  // Initialize provider
  useEffect(() => {
    if (isInitialized.current) return;

    const initProvider = async () => {
      try {
        console.log(`[useVideoProvider] Initializing ${callType} provider`);
        const p = await createProvider(callType, config);
        providerRef.current = p;
        setProvider(p);

        // Set up event listeners
        p.on(ProviderEvents.CONNECTED, () => {
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
        });

        p.on(ProviderEvents.DISCONNECTED, () => {
          setIsConnected(false);
          setIsPublishing(false);
        });

        p.on(ProviderEvents.CONNECTION_ERROR, ({ error }) => {
          setError(error?.message || 'Connection error');
          setIsConnecting(false);
        });

        p.on(ProviderEvents.RECONNECTING, () => {
          setIsConnecting(true);
        });

        p.on(ProviderEvents.PARTICIPANT_JOINED, ({ participant }) => {
          setParticipants(prev => new Map(prev).set(participant.id, participant));
        });

        p.on(ProviderEvents.PARTICIPANT_LEFT, ({ participant }) => {
          setParticipants(prev => {
            const next = new Map(prev);
            next.delete(participant?.id);
            return next;
          });
        });

        p.on(ProviderEvents.PARTICIPANT_UPDATED, ({ participant }) => {
          setParticipants(prev => new Map(prev).set(participant.id, participant));
        });

        p.on(ProviderEvents.TRACK_PUBLISHED, ({ participant }) => {
          setParticipants(prev => new Map(prev).set(participant.id, participant));
        });

        p.on(ProviderEvents.TRACK_UNPUBLISHED, ({ participant }) => {
          setParticipants(prev => new Map(prev).set(participant.id, participant));
        });

        p.on(ProviderEvents.METRICS_UPDATED, ({ metrics }) => {
          setMetrics(metrics);
        });

        p.on(ProviderEvents.TRANSCRIPT_RECEIVED, ({ entry }) => {
          setTranscript(prev => [...prev, entry]);
        });

        isInitialized.current = true;
        console.log(`[useVideoProvider] Provider initialized:`, providerInfo.name);
      } catch (err) {
        console.error('[useVideoProvider] Failed to initialize provider:', err);
        setError(err.message);
      }
    };

    initProvider();

    return () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      isInitialized.current = false;
    };
  }, [callType]);

  // Join call
  const join = useCallback(async (joinConfig) => {
    const p = providerRef.current;
    if (!p) {
      throw new Error('Provider not initialized');
    }

    setIsConnecting(true);
    setError(null);

    try {
      await p.join(joinConfig);
      setLocalTracks(p.getLocalTracks());
      setIsPublishing(true);
    } catch (err) {
      setError(err.message);
      setIsConnecting(false);
      throw err;
    }
  }, []);

  // Leave call
  const leave = useCallback(async () => {
    const p = providerRef.current;
    if (!p) return;

    try {
      await p.leave();
      setLocalTracks({ audio: null, video: null, screen: null });
      setParticipants(new Map());
    } catch (err) {
      console.error('[useVideoProvider] Error leaving:', err);
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    const p = providerRef.current;
    if (!p) return false;

    const tracks = p.getLocalTracks();
    const currentEnabled = tracks.audio?.enabled ?? false;
    const newEnabled = await p.toggleAudio(!currentEnabled);
    setLocalTracks(p.getLocalTracks());
    return newEnabled;
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    const p = providerRef.current;
    if (!p) return false;

    const tracks = p.getLocalTracks();
    const currentEnabled = tracks.video?.enabled ?? false;
    const newEnabled = await p.toggleVideo(!currentEnabled);
    setLocalTracks(p.getLocalTracks());
    return newEnabled;
  }, []);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    const p = providerRef.current;
    if (!p) return;

    await p.startScreenShare();
    setIsScreenSharing(true);
    setLocalTracks(p.getLocalTracks());
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(async () => {
    const p = providerRef.current;
    if (!p) return;

    await p.stopScreenShare();
    setIsScreenSharing(false);
    setLocalTracks(p.getLocalTracks());
  }, []);

  // Enable transcription
  const enableTranscription = useCallback((lang = 'en') => {
    const p = providerRef.current;
    if (!p) return;

    p.enableTranscription(lang);
  }, []);

  // Get call metrics
  const getMetrics = useCallback(() => {
    const p = providerRef.current;
    return p ? p.getCallMetrics() : null;
  }, []);

  // Get transcript
  const getTranscript = useCallback(() => {
    const p = providerRef.current;
    return p ? p.getTranscript() : [];
  }, []);

  // Get provider state
  const getState = useCallback(() => {
    const p = providerRef.current;
    return p ? p.getState() : null;
  }, []);

  return {
    // State
    provider,
    providerInfo,
    isConnected,
    isConnecting,
    isPublishing,
    isScreenSharing,
    error,

    // Tracks
    localTracks,
    participants: Array.from(participants.values()),

    // Analytics
    metrics,
    transcript,

    // Actions
    join,
    leave,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    enableTranscription,
    getMetrics,
    getTranscript,
    getState,
  };
}

export default useVideoProvider;
