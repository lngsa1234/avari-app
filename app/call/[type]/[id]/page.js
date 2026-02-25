'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCallTypeConfig, isValidCallType } from '@/lib/video/callTypeConfig';
import { saveCallRecap } from '@/lib/callRecapHelpers';
import { useCallRoom } from '@/hooks/useCallRoom';
import { useRecording } from '@/hooks/useRecording';
import useTranscription from '@/hooks/useTranscription';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import useDeviceSelection from '@/hooks/useDeviceSelection';
import PostMeetingSummary from '@/components/PostMeetingSummary';

import {
  VideoHeader,
  ControlBar,
  VideoGrid,
  VideoSpeakerView,
  TranscriptOverlay,
  ChatPanel,
  ParticipantsPanel,
} from '@/components/video';

// Fallback topic suggestions (used when icebreakers fail to load)
const FALLBACK_TOPICS = [
  { question: "What brings you here today?", category: "intro" },
  { question: "What's something you're excited about right now?", category: "general" },
  { question: "What's the best advice you've received recently?", category: "learning" },
  { question: "What's a skill you'd like to develop this year?", category: "growth" }
];

/**
 * Unified Video Call Page
 * Supports: coffee (WebRTC), meetup (LiveKit), circle (Agora)
 */
export default function UnifiedCallPage() {
  const params = useParams();
  const router = useRouter();
  const callType = params.type;
  const roomId = params.id;

  // Validate call type
  const config = getCallTypeConfig(callType);

  // User state
  const [user, setUser] = useState(null);

  // Room data hook
  const {
    room,
    relatedData,
    participants: roomParticipants,
    isLoading: roomLoading,
    error: roomError,
    startRoom,
    endRoom,
    getRecapData,
  } = useCallRoom(callType, roomId);

  // Provider state - varies by type
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);

  // Control state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [isLocalMain, setIsLocalMain] = useState(false);
  const [isVideoDeviceSwitching, setIsVideoDeviceSwitching] = useState(false);
  const [isAudioDeviceSwitching, setIsAudioDeviceSwitching] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('en-US');
  const [pendingLanguageRestart, setPendingLanguageRestart] = useState(false);

  // Topics/Icebreakers state (for meetups)
  const [currentTopic, setCurrentTopic] = useState(null);
  const [usedTopicIndices, setUsedTopicIndices] = useState(new Set());
  const [icebreakers, setIcebreakers] = useState([]);
  const [icebreakersLoading, setIcebreakersLoading] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // Screen share state
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState(null);
  const [screenSharerName, setScreenSharerName] = useState('');

  // Meeting info state
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('good');

  // Recap state
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);

  // Refs
  const localVideoRef = useRef(null);
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);
  const messagesEndRef = useRef(null);
  const callStartTimeRef = useRef(null);
  // Refs for keyboard shortcuts (to avoid stale closures)
  const handleToggleMuteRef = useRef(null);
  const handleToggleVideoRef = useRef(null);
  const showChatRef = useRef(false);
  const userIdRef = useRef(null);
  // Ref to store latest roomParticipants for use in event handler closures
  const roomParticipantsRef = useRef([]);

  // Provider-specific refs
  const roomRef = useRef(null); // LiveKit room
  const peerConnectionRef = useRef(null); // WebRTC
  const iceCandidateQueueRef = useRef([]); // Buffer ICE candidates until remote description is set
  const realtimeChannelRef = useRef(null); // Supabase channel
  const agoraClientRef = useRef(null); // Agora client (camera/audio)
  const agoraScreenClientRef = useRef(null); // Agora screen share client (separate to allow simultaneous camera+screen)
  const agoraUidRef = useRef(null); // Store Agora UID for screen client
  const screenTrackRef = useRef(null);

  // Hooks
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    formatTime
  } = useRecording();

  const {
    isBlurEnabled,
    isBlurSupported,
    isLoading: blurLoading,
    toggleBlur: toggleBlurHook,
    blurResult: blurResultRef,
    preloadAgoraBlur,
    preloadLiveKitBlur,
  } = useBackgroundBlur(config?.provider || 'webrtc');

  // Store blur canvas in state so React re-renders when it changes
  const [blurCanvasEl, setBlurCanvasEl] = useState(null);

  // Device selection hook
  const {
    videoDevices,
    audioDevices,
    selectedVideoDevice,
    selectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedAudioDevice,
    switchVideoDevice,
    switchAudioDevice,
    refreshDevices
  } = useDeviceSelection();

  // Interim transcript (what's currently being spoken)
  const [interimText, setInterimText] = useState('');
  const interimTimeoutRef = useRef(null);
  const lastInterimRef = useRef('');
  // Ref to store restart function (set after hook is called)
  const restartListeningRef = useRef(null);
  // Track last auto-finalized text to skip duplicate from browser's final event
  const lastAutoFinalizedRef = useRef('');

  // Auto-finalize interim text after pause
  const finalizeInterim = useCallback(() => {
    if (lastInterimRef.current.trim()) {
      const textToFinalize = lastInterimRef.current.trim();
      console.log('[Transcript] Auto-finalizing:', textToFinalize);

      // Track this so we skip it if browser sends it as final
      lastAutoFinalizedRef.current = textToFinalize;

      const entry = {
        speakerId: user?.id || 'local',
        speakerName: user?.name || 'You',
        text: textToFinalize,
        timestamp: Date.now(),
        isFinal: true
      };
      setTranscript(prev => [...prev, entry]);
      setInterimText('');
      lastInterimRef.current = '';

      // Save to database
      if (roomId) {
        supabase.from('call_transcripts').insert({
          channel_name: roomId,
          user_id: user?.id,
          speaker_name: entry.speakerName,
          text: entry.text,
          timestamp: entry.timestamp,
          is_final: true
        }).then(({ error }) => {
          if (error) console.error('Failed to save transcript:', error);
        });
      }

      // Restart recognition to clear browser's accumulated buffer
      if (restartListeningRef.current) {
        console.log('[Transcript] Restarting recognition to clear buffer');
        restartListeningRef.current();
      }
    }
  }, [user, roomId]);

  // Transcription handler
  const handleTranscript = useCallback(({ text, isFinal, timestamp }) => {
    // Clear any pending auto-finalize
    if (interimTimeoutRef.current) {
      clearTimeout(interimTimeoutRef.current);
      interimTimeoutRef.current = null;
    }

    if (isFinal && text.trim()) {
      const finalText = text.trim();

      // Skip if this is a duplicate of what we just auto-finalized
      // (happens when browser sends final event during restart)
      if (lastAutoFinalizedRef.current && finalText.includes(lastAutoFinalizedRef.current)) {
        console.log('[Transcript] Skipping duplicate final:', finalText);
        lastAutoFinalizedRef.current = '';
        setInterimText('');
        lastInterimRef.current = '';
        return;
      }

      // Browser marked it final
      setInterimText('');
      lastInterimRef.current = '';
      lastAutoFinalizedRef.current = '';

      const entry = {
        speakerId: user?.id || 'local',
        speakerName: user?.name || 'You',
        text: finalText,
        timestamp,
        isFinal: true
      };
      setTranscript(prev => [...prev, entry]);

      // Save to database for shared access
      if (roomId) {
        supabase.from('call_transcripts').insert({
          channel_name: roomId,
          user_id: user?.id,
          speaker_name: entry.speakerName,
          text: entry.text,
          timestamp: entry.timestamp,
          is_final: true
        }).then(({ error }) => {
          if (error) console.error('Failed to save transcript:', error);
        });
      }
    } else if (!isFinal && text.trim()) {
      // Show interim text directly
      console.log('[Transcript] Interim:', text.trim());
      setInterimText(text.trim());
      lastInterimRef.current = text.trim();

      // Auto-finalize after 800ms of no new input
      interimTimeoutRef.current = setTimeout(() => {
        finalizeInterim();
      }, 800);
    }
  }, [user, roomId, finalizeInterim]);

  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    isSafari,
    error: speechError,
    startListening,
    stopListening,
    restartListening
  } = useTranscription({
    onTranscript: handleTranscript,
    language: transcriptionLanguage,
    continuous: true,
    interimResults: true
  });

  // Store restartListening in ref so finalizeInterim can access it
  useEffect(() => {
    restartListeningRef.current = restartListening;
  }, [restartListening]);

  // Calculate derived state
  const showSidebar = showChat || showTopics || showParticipants;
  const enabledPanels = [
    showChat && 'messages',
    showTopics && 'topics',
    showParticipants && 'participants',
  ].filter(Boolean);
  const participantCount = remoteParticipants.length + (isJoined ? 1 : 0);

  // Get current user with profile
  useEffect(() => {
    async function fetchUserWithProfile() {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        // Fetch profile to get display name
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, profile_picture')
          .eq('id', authData.user.id)
          .single();

        // Merge profile data with user object
        setUser({
          ...authData.user,
          name: profile?.name || authData.user.email?.split('@')[0],
          profile_picture: profile?.profile_picture
        });
      } else {
        router.push('/');
      }
    }
    fetchUserWithProfile();
  }, [router]);

  // Validate call type
  useEffect(() => {
    if (!isValidCallType(callType)) {
      console.error('Invalid call type:', callType);
      router.push('/');
    }
  }, [callType, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          // Space to toggle mute
          e.preventDefault();
          handleToggleMuteRef.current?.();
          break;
        case 'KeyV':
          // V to toggle video
          e.preventDefault();
          handleToggleVideoRef.current?.();
          break;
        case 'KeyM':
          // M to toggle mute (alternative)
          e.preventDefault();
          handleToggleMuteRef.current?.();
          break;
        case 'Escape':
          // Escape to close sidebar
          setShowChat(false);
          setShowTopics(false);
          setShowParticipants(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize call when user is ready
  useEffect(() => {
    if (user && config && !hasInitialized.current && !isInitializing.current) {
      initializeCall();
    }

    return () => {
      if (hasInitialized.current) {
        leaveCall();
      }
      // Clean up interim timeout
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
      }
    };
  }, [user, config]);

  // Load messages
  useEffect(() => {
    if (!roomId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('call_messages')
        .select('*')
        .eq('channel_name', roomId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    };
    loadMessages();

    // Subscribe to new messages — use refs to always read latest values
    const channel = supabase
      .channel(`call-messages-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_messages',
        filter: `channel_name=eq.${roomId}`
      }, (payload) => {
        const isNew = payload.new;
        setMessages(prev => {
          if (prev.some(m => m.id === isNew.id)) return prev;
          return [...prev, isNew];
        });
        // Increment unread if chat panel is closed and message is from someone else
        if (!showChatRef.current && isNew.user_id !== userIdRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Load icebreakers for calls with icebreakers feature enabled
  useEffect(() => {
    if (roomId && config?.features.icebreakers) {
      loadIcebreakers();
    }
  }, [callType, roomId, config?.features.icebreakers]);

  // Load icebreakers from API
  const loadIcebreakers = async () => {
    setIcebreakersLoading(true);
    try {
      // First try to get cached icebreakers
      const getResponse = await fetch(`/api/agent/icebreakers?meetupId=${roomId}`);
      const getData = await getResponse.json();

      if (getData.found && getData.icebreakers) {
        setIcebreakers(getData.icebreakers);
        setIsAIGenerated(getData.tier === 'light_ai' || getData.tier === 'ai');
        setIcebreakersLoading(false);
        return;
      }

      // Generate new icebreakers if we have enough context
      const postResponse = await fetch('/api/agent/icebreakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetupId: roomId,
          title: relatedData?.topic || relatedData?.name || (callType === 'coffee' ? '1:1 Coffee Chat' : 'Networking Meetup'),
          description: relatedData?.description || '',
          attendees: roomParticipants?.map(p => ({
            career: p.career,
            interests: p.interests
          })) || []
        })
      });

      const postData = await postResponse.json();
      if (postData.icebreakers) {
        setIcebreakers(postData.icebreakers);
        setIsAIGenerated(postData.tier === 'light_ai' || postData.tier === 'ai');
      } else {
        // Fallback to default topics
        setIcebreakers(FALLBACK_TOPICS);
        setIsAIGenerated(false);
      }
    } catch (e) {
      console.error('[Call] Error loading icebreakers:', e);
      setIcebreakers(FALLBACK_TOPICS);
      setIsAIGenerated(false);
    } finally {
      setIcebreakersLoading(false);
    }
  };

  // Call duration timer
  useEffect(() => {
    if (!isJoined || !callStartTime) return;

    const interval = setInterval(() => {
      const start = new Date(callStartTime);
      const now = new Date();
      const seconds = Math.floor((now - start) / 1000);
      setCallDuration(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [isJoined, callStartTime]);

  // Keep roomParticipantsRef updated for use in event handler closures
  // Also re-update remote participant names when roomParticipants loads
  useEffect(() => {
    roomParticipantsRef.current = roomParticipants || [];

    // If we have remote participants and roomParticipants just loaded, refresh names
    if (roomParticipants?.length > 0 && remoteParticipants.length > 0) {
      console.log('[Call] roomParticipants loaded, refreshing remote participant names');

      // For Agora, re-run the participant update
      if (config?.provider === 'agora' && agoraClientRef.current) {
        updateAgoraParticipants(agoraClientRef.current);
      }
      // For LiveKit, re-run the participant update
      else if (config?.provider === 'livekit' && roomRef.current) {
        updateLiveKitParticipants(roomRef.current);
      }
    }
  }, [roomParticipants]);

  // Handle language change
  const handleLanguageChange = useCallback((newLanguage) => {
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
      setPendingLanguageRestart(true);
    }
    setTranscriptionLanguage(newLanguage);
  }, [isTranscribing, stopListening]);

  // Restart transcription after language change
  useEffect(() => {
    if (pendingLanguageRestart) {
      setPendingLanguageRestart(false);
      const started = startListening();
      if (started) setIsTranscribing(true);
    }
  }, [pendingLanguageRestart, startListening]);

  // Initialize call based on provider type
  const initializeCall = async () => {
    if (isInitializing.current || hasInitialized.current) return;
    isInitializing.current = true;
    setIsConnecting(true);

    try {
      console.log(`[UnifiedCall] Initializing ${config.provider} call for ${callType}:`, roomId);

      // Request camera/microphone permissions
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      testStream.getTracks().forEach(track => track.stop());

      // Create AudioContext now while we still have user gesture context
      // This prevents "AudioContext was not allowed to start" warnings
      if (!window.__avariAudioContext) {
        try {
          window.__avariAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { /* ignore */ }
      }

      // Refresh device list now that we have permission
      await refreshDevices();

      switch (config.provider) {
        case 'webrtc':
          await initializeWebRTCCall();
          break;
        case 'livekit':
          await initializeLiveKitCall();
          break;
        case 'agora':
          await initializeAgoraCall();
          break;
        default:
          throw new Error(`Unknown provider: ${config.provider}`);
      }

      hasInitialized.current = true;
      setIsJoined(true);
      setIsConnecting(false);

      const startTime = new Date().toISOString();
      setCallStartTime(startTime);
      callStartTimeRef.current = startTime;

      await startRoom();

      // Auto-start transcription for supported providers
      if (config.features.transcription && isSpeechSupported && !isSafari) {
        const started = startListening();
        if (started) setIsTranscribing(true);
      }

    } catch (error) {
      console.error('[UnifiedCall] Error initializing call:', error);
      setIsConnecting(false);
      isInitializing.current = false;
      handlePermissionError(error);
    }
  };

  // WebRTC initialization (1:1 calls)
  const initializeWebRTCCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    setLocalVideoTrack(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // Setup peer connection
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Collect remote tracks — ontrack fires once per track (audio + video)
    const remoteTracks = { video: null, audio: null };
    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired, track kind:', event.track.kind);
      if (event.track.kind === 'video') {
        remoteTracks.video = event.streams[0] || new MediaStream([event.track]);
      } else if (event.track.kind === 'audio') {
        remoteTracks.audio = event.streams[0] || new MediaStream([event.track]);
      }
      setRemoteParticipants([{
        id: 'remote',
        name: relatedData?.partner_name || 'Partner',
        videoTrack: remoteTracks.video,
        audioTrack: remoteTracks.audio,
        hasVideo: !!remoteTracks.video,
        hasAudio: !!remoteTracks.audio,
        _lastUpdate: Date.now(),
      }]);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    // Setup signaling channel with presence to determine polite/impolite peer
    const channel = supabase.channel(`meeting:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: user?.id || 'anon' } }
    });

    let isPolite = false; // impolite by default; second joiner becomes polite

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleWebRTCSignal(payload, pc, isPolite);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Filter out our own join event
        const otherJoins = (newPresences || []).filter(p => p.user_id !== user?.id);
        if (otherJoins.length === 0) return;

        console.log('[WebRTC] Peer joined, creating offer');
        // Reset to stable if we have a stale local offer from a previous attempt
        if (pc.signalingState === 'have-local-offer') {
          pc.setLocalDescription({ type: 'rollback' }).then(() => {
            createWebRTCOffer(pc);
          }).catch(() => {
            createWebRTCOffer(pc);
          });
        } else {
          createWebRTCOffer(pc);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({ user_id: user?.id, joined_at: Date.now() });
          // Check if someone else is already here
          const presenceState = channel.presenceState();
          const otherPeers = Object.keys(presenceState).filter(k => k !== (user?.id || 'anon'));
          if (otherPeers.length > 0) {
            // We're the second joiner — be polite and wait for their offer
            isPolite = true;
            console.log('[WebRTC] Peer already present, waiting as polite peer');
            // Nudge the first peer to send an offer in case they missed our join event
            setTimeout(() => {
              if (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting') {
                console.log('[WebRTC] No offer received, creating our own');
                createWebRTCOffer(pc);
              }
            }, 2000);
          } else {
            console.log('[WebRTC] First in room, waiting for peer to join');
          }
        }
      });

    realtimeChannelRef.current = channel;
  };

  // LiveKit initialization (meetups)
  const initializeLiveKitCall = async () => {
    const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!liveKitUrl) throw new Error('LiveKit URL not configured');

    const { Room, RoomEvent, VideoPresets } = await import('livekit-client');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      webAudioMix: window.__avariAudioContext ? { audioContext: window.__avariAudioContext } : false,
    });

    roomRef.current = room;

    // Event handlers
    room.on(RoomEvent.ParticipantConnected, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.ParticipantDisconnected, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackSubscribed, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackUnsubscribed, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackMuted, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackUnmuted, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.Disconnected, () => setIsJoined(false));
    room.on(RoomEvent.Reconnecting, () => setIsConnecting(true));
    room.on(RoomEvent.Reconnected, () => {
      setIsConnecting(false);
      updateLiveKitParticipants(room);
    });

    // Handle browser autoplay policy — resume audio on first user interaction
    const resumeAudio = async () => {
      try {
        await room.startAudio();
      } catch (e) { /* ignore */ }
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('touchstart', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('touchstart', resumeAudio);

    // Get token
    const tokenResponse = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomId,
        participantId: user.id,
        participantName: user.name || 'Anonymous'
      })
    });

    if (!tokenResponse.ok) throw new Error('Failed to get LiveKit token');
    const { token } = await tokenResponse.json();

    await room.connect(liveKitUrl, token);
    await room.localParticipant.enableCameraAndMicrophone();

    const camTrack = room.localParticipant.getTrackPublication('camera');
    const micTrack = room.localParticipant.getTrackPublication('microphone');

    if (camTrack?.track) setLocalVideoTrack(camTrack.track);
    if (micTrack?.track) setLocalAudioTrack(micTrack.track);

    // Pre-load blur processor in background so it's instant when user clicks
    preloadLiveKitBlur();
  };

  // Agora initialization (circles)
  const initializeAgoraCall = async () => {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    if (!appId) throw new Error('Agora App ID not configured');

    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    agoraClientRef.current = client;

    // Event handlers
    client.on('user-published', async (remoteUser, mediaType) => {
      console.log('[Agora] user-published:', remoteUser.uid, mediaType);
      await client.subscribe(remoteUser, mediaType);
      console.log('[Agora] Subscribed to:', remoteUser.uid, 'videoTrack:', !!remoteUser.videoTrack);
      updateAgoraParticipants(client);
    });

    client.on('user-unpublished', (remoteUser, mediaType) => {
      console.log('[Agora] user-unpublished:', remoteUser.uid, mediaType);
      updateAgoraParticipants(client);
    });
    client.on('user-joined', (remoteUser) => {
      console.log('[Agora] user-joined:', remoteUser.uid);
      updateAgoraParticipants(client);
    });
    client.on('user-left', (remoteUser) => {
      console.log('[Agora] user-left:', remoteUser.uid);
      updateAgoraParticipants(client);
    });

    // Use user ID as string UID (Agora supports ASCII strings 1-255 chars)
    // Fallback to a constrained numeric UID if needed
    const agoraUid = user.id.length <= 255 && /^[\x00-\x7F]+$/.test(user.id)
      ? user.id
      : Math.abs(user.id.split('').reduce((hash, char) => {
          return ((hash << 5) - hash) + char.charCodeAt(0);
        }, 0)) % 10000;

    // Store UID for screen sharing client
    agoraUidRef.current = agoraUid;

    await client.join(appId, roomId, null, agoraUid);

    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    await client.publish([audioTrack, videoTrack]);

    setLocalVideoTrack(videoTrack);
    setLocalAudioTrack(audioTrack);

    if (localVideoRef.current) {
      videoTrack.play(localVideoRef.current);
    }

    // Pre-load blur processor in background so it's instant when user clicks
    preloadAgoraBlur();
  };

  // Helper to get participant name from roomParticipants by UID
  // Uses ref to avoid stale closure issues in event handlers
  const getParticipantName = (uid) => {
    const uidStr = String(uid);
    const participants = roomParticipantsRef.current;
    console.log('[getParticipantName] Looking for UID:', uidStr);
    console.log('[getParticipantName] roomParticipants:', participants?.map(p => ({ id: p.id, name: p.name })));

    // Try to find by exact ID match
    const participant = participants?.find(p => p.id === uidStr);
    if (participant?.name) {
      console.log('[getParticipantName] Found:', participant.name);
      return participant.name;
    }

    // Fallback to a shorter display
    const fallback = uidStr.length > 8 ? `User ${uidStr.slice(0, 8)}...` : `User ${uidStr}`;
    console.log('[getParticipantName] Not found, using fallback:', fallback);
    return fallback;
  };

  // Update LiveKit participants
  const updateLiveKitParticipants = (room) => {
    if (!room || room.state === 'disconnected') return;

    let foundScreenShare = null;
    let screenShareParticipantName = '';

    const participants = Array.from(room.remoteParticipants.values()).map(p => {
      const videoPublication = p.getTrackPublication('camera');
      const audioPublication = p.getTrackPublication('microphone');
      const screenPublication = p.getTrackPublication('screen_share');

      // Get display name - prefer LiveKit name, fallback to our lookup
      const displayName = p.name || getParticipantName(p.identity);

      // Track remote screen share
      if (screenPublication?.track) {
        foundScreenShare = screenPublication.track;
        screenShareParticipantName = displayName;
      }

      return {
        id: p.identity,
        name: displayName,
        videoTrack: videoPublication?.track,
        audioTrack: audioPublication?.track,
        screenTrack: screenPublication?.track,
        isSpeaking: p.isSpeaking,
        connectionQuality: p.connectionQuality,
        hasVideo: !!videoPublication?.track,
        hasAudio: !!audioPublication?.track,
        hasScreen: !!screenPublication?.track,
      };
    });

    setRemoteParticipants(participants);
    setRemoteScreenTrack(foundScreenShare);
    setScreenSharerName(screenShareParticipantName);

    // Update connection quality from local participant
    if (room.localParticipant) {
      const quality = room.localParticipant.connectionQuality;
      if (quality === 3) setConnectionQuality('excellent');
      else if (quality === 2) setConnectionQuality('good');
      else if (quality === 1) setConnectionQuality('fair');
      else setConnectionQuality('poor');
    }
  };

  // Update Agora participants
  const updateAgoraParticipants = (client) => {
    if (!client) return;

    let foundScreenTrack = null;
    let foundScreenSharerName = '';

    // Our own screen UID (to exclude from remote screen detection)
    const myScreenUid = agoraUidRef.current ? `${agoraUidRef.current}_screen` : null;

    console.log('[Agora] updateParticipants - remoteUsers:', client.remoteUsers.map(u => ({
      uid: u.uid,
      hasVideo: !!u.videoTrack,
      hasAudio: !!u.audioTrack
    })));
    console.log('[Agora] myScreenUid:', myScreenUid);

    // Separate screen share users from regular users
    // Exclude our own screen client from screen users
    const screenUsers = client.remoteUsers.filter(u => {
      const uid = String(u.uid);
      return uid.endsWith('_screen') && uid !== myScreenUid;
    });
    const regularUsers = client.remoteUsers.filter(u => !String(u.uid).endsWith('_screen'));

    console.log('[Agora] screenUsers:', screenUsers.map(u => u.uid));
    console.log('[Agora] regularUsers:', regularUsers.map(u => u.uid));

    // Find active remote screen share (not our own)
    for (const screenUser of screenUsers) {
      console.log('[Agora] Checking screen user:', screenUser.uid, 'videoTrack:', !!screenUser.videoTrack);
      if (screenUser.videoTrack) {
        foundScreenTrack = screenUser.videoTrack;
        // Extract the main user ID by removing '_screen' suffix
        const mainUid = String(screenUser.uid).replace('_screen', '');
        foundScreenSharerName = getParticipantName(mainUid);
        console.log('[Agora] Found remote screen share from:', mainUid, 'name:', foundScreenSharerName);
        break;
      }
    }

    // Build participants from regular users only (excluding screen share clients)
    const participants = regularUsers.map(u => {
      const isScreenSharing = screenUsers.some(
        s => String(s.uid) === `${u.uid}_screen` && s.videoTrack
      );
      return {
        id: u.uid,
        uid: u.uid,
        name: getParticipantName(u.uid),
        videoTrack: u.videoTrack,
        audioTrack: u.audioTrack,
        hasVideo: !!u.videoTrack,
        hasAudio: !!u.audioTrack,
        hasScreen: isScreenSharing,
        _videoEnabled: u._videoEnabled !== false,
        _lastUpdate: Date.now(),
      };
    });

    console.log('[Agora] Setting remoteScreenTrack:', !!foundScreenTrack, 'participants:', participants.length);
    setRemoteParticipants(participants);
    setRemoteScreenTrack(foundScreenTrack);
    setScreenSharerName(foundScreenSharerName);
  };

  // WebRTC signaling handlers
  // Flush queued ICE candidates after remote description is set
  const flushIceCandidates = async (pc) => {
    const queued = iceCandidateQueueRef.current;
    iceCandidateQueueRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Queued ICE candidate error:', e.message);
      }
    }
    if (queued.length > 0) console.log('[WebRTC] Flushed', queued.length, 'queued ICE candidates');
  };

  const handleWebRTCSignal = async (signal, pc, isPolite = false) => {
    try {
      switch (signal.type) {
        case 'offer': {
          const offerCollision = pc.signalingState !== 'stable';
          if (offerCollision && !isPolite) {
            console.log('[WebRTC] Impolite peer ignoring colliding offer');
            return;
          }
          if (offerCollision) {
            console.log('[WebRTC] Polite peer rolling back to accept offer');
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          await flushIceCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          realtimeChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', answer: pc.localDescription }
          });
          break;
        }

        case 'answer':
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            await flushIceCandidates(pc);
          }
          break;

        case 'ice-candidate':
          // Queue if remote description not yet set
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            iceCandidateQueueRef.current.push(signal.candidate);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.warn('[WebRTC] ICE candidate error:', e.message);
            }
          }
          break;
      }
    } catch (error) {
      console.error('[WebRTC] Signal error:', error);
    }
  };

  const createWebRTCOffer = async (pc) => {
    if (!pc || pc.signalingState !== 'stable') return;
    // Don't re-offer if connection is already established
    if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'offer', offer: pc.localDescription }
      });
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    }
  };

  // Control handlers
  const handleToggleMute = async () => {
    if (config.provider === 'webrtc' && localVideoTrack instanceof MediaStream) {
      localVideoTrack.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    } else if (config.provider === 'livekit' && roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(isMuted);
    } else if (config.provider === 'agora' && localAudioTrack) {
      await localAudioTrack.setEnabled(isMuted);
    }
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = async () => {
    if (config.provider === 'webrtc' && localVideoTrack instanceof MediaStream) {
      localVideoTrack.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
    } else if (config.provider === 'livekit' && roomRef.current) {
      await roomRef.current.localParticipant.setCameraEnabled(isVideoOff);
    } else if (config.provider === 'agora' && localVideoTrack) {
      await localVideoTrack.setEnabled(isVideoOff);
    }
    setIsVideoOff(!isVideoOff);
  };

  const handleToggleBlur = async () => {
    if (!localVideoTrack) return;

    if (config?.provider === 'webrtc' && localVideoTrack instanceof MediaStream) {
      if (!isBlurEnabled) {
        // ENABLE blur
        await toggleBlurHook(localVideoTrack);

        const result = blurResultRef?.current;
        if (result) {
          // Store canvas in state so React passes it as a prop
          setBlurCanvasEl(result.canvas);

          // Send blurred track to remote peer (skip on Safari — captureStream not reliable)
          if (peerConnectionRef.current && result.blurredTrack && !isSafari) {
            const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
            if (sender) await sender.replaceTrack(result.blurredTrack);
          }
        }
      } else {
        // DISABLE blur
        setBlurCanvasEl(null);
        await toggleBlurHook(localVideoTrack);

        // Restore original track in peer connection (skip on Safari — wasn't replaced)
        if (peerConnectionRef.current && localVideoTrack instanceof MediaStream && !isSafari) {
          const origTrack = localVideoTrack.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender && origTrack) await sender.replaceTrack(origTrack);
        }
      }
    } else {
      // LiveKit / Agora — existing behavior
      await toggleBlurHook(localVideoTrack);
    }
  };

  // Update refs for keyboard shortcuts and chat state
  handleToggleMuteRef.current = handleToggleMute;
  handleToggleVideoRef.current = handleToggleVideo;
  showChatRef.current = showChat;
  userIdRef.current = user?.id || null;

  // Detect screen share support (iOS browsers don't support getDisplayMedia)
  const [isScreenShareSupported, setIsScreenShareSupported] = useState(true);
  useEffect(() => {
    setIsScreenShareSupported(!!navigator.mediaDevices?.getDisplayMedia);
  }, []);

  // Handle video device change
  const handleVideoDeviceChange = async (deviceId) => {
    setIsVideoDeviceSwitching(true);
    try {
      const constraints = switchVideoDevice(deviceId);

      if (config.provider === 'webrtc' && localVideoTrack instanceof MediaStream) {
        // Stop old video track
        localVideoTrack.getVideoTracks().forEach(t => t.stop());

        // Get new video track
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];

        // Replace in peer connection
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }

        // Update local stream
        localVideoTrack.getVideoTracks().forEach(t => localVideoTrack.removeTrack(t));
        localVideoTrack.addTrack(newVideoTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localVideoTrack;
        }
      } else if (config.provider === 'livekit' && roomRef.current) {
        await roomRef.current.switchActiveDevice('videoinput', deviceId);
      } else if (config.provider === 'agora' && agoraClientRef.current) {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        // Close old track and create new one
        if (localVideoTrack?.close) localVideoTrack.close();
        const newVideoTrack = await AgoraRTC.createCameraVideoTrack({ cameraId: deviceId });
        await agoraClientRef.current.unpublish([localVideoTrack]);
        await agoraClientRef.current.publish([newVideoTrack]);
        setLocalVideoTrack(newVideoTrack);
        if (localVideoRef.current) {
          newVideoTrack.play(localVideoRef.current);
        }
      }
    } catch (error) {
      console.error('[UnifiedCall] Error switching video device:', error);
    } finally {
      setIsVideoDeviceSwitching(false);
    }
  };

  // Handle audio device change
  const handleAudioDeviceChange = async (deviceId) => {
    setIsAudioDeviceSwitching(true);
    try {
      const constraints = switchAudioDevice(deviceId);

      if (config.provider === 'webrtc' && localVideoTrack instanceof MediaStream) {
        // Stop old audio track
        localVideoTrack.getAudioTracks().forEach(t => t.stop());

        // Get new audio track
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newAudioTrack = newStream.getAudioTracks()[0];

        // Replace in peer connection
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) {
            await sender.replaceTrack(newAudioTrack);
          }
        }

        // Update local stream
        localVideoTrack.getAudioTracks().forEach(t => localVideoTrack.removeTrack(t));
        localVideoTrack.addTrack(newAudioTrack);
      } else if (config.provider === 'livekit' && roomRef.current) {
        await roomRef.current.switchActiveDevice('audioinput', deviceId);
      } else if (config.provider === 'agora' && agoraClientRef.current) {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        // Close old track and create new one
        if (localAudioTrack?.close) localAudioTrack.close();
        const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ microphoneId: deviceId });
        await agoraClientRef.current.unpublish([localAudioTrack]);
        await agoraClientRef.current.publish([newAudioTrack]);
        setLocalAudioTrack(newAudioTrack);
      }
    } catch (error) {
      console.error('[UnifiedCall] Error switching audio device:', error);
    } finally {
      setIsAudioDeviceSwitching(false);
    }
  };

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = (message, duration = 3000) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), duration);
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop sharing
        if (config.provider === 'livekit' && screenTrackRef.current) {
          await roomRef.current?.localParticipant.unpublishTrack(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        } else if (config.provider === 'agora') {
          // Agora dual-client: leave the screen client
          if (agoraScreenClientRef.current) {
            try {
              if (screenTrackRef.current) {
                await agoraScreenClientRef.current.unpublish([screenTrackRef.current]);
                screenTrackRef.current.close();
                screenTrackRef.current = null;
              }
              await agoraScreenClientRef.current.leave();
            } catch (e) {
              console.log('[UnifiedCall] Cleanup screen client:', e.message);
            }
            agoraScreenClientRef.current = null;
          }
        }
        setIsScreenSharing(false);
        setLocalScreenTrack(null);
      } else {
        // Block if someone else is already sharing
        if (remoteScreenTrack) {
          showToast(`${screenSharerName || 'Someone'} is already sharing their screen`);
          return;
        }

        // Check if screen sharing is supported
        if (!navigator.mediaDevices?.getDisplayMedia) {
          showToast('Screen sharing is not supported on this device');
          return;
        }

        // Start sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        const screenVideoTrack = screenStream.getVideoTracks()[0];

        if (config.provider === 'livekit') {
          const { LocalVideoTrack, Track } = await import('livekit-client');
          const screenTrack = new LocalVideoTrack(screenVideoTrack);
          screenTrackRef.current = screenTrack;
          setLocalScreenTrack(screenTrack);
          await roomRef.current?.localParticipant.publishTrack(screenTrack, {
            name: 'screen',
            source: Track.Source.ScreenShare
          });
        } else if (config.provider === 'agora') {
          // Agora dual-client approach: use a separate client for screen sharing
          // This allows camera to stay published on the main client
          const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
          const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

          // Create a separate client for screen sharing
          const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          agoraScreenClientRef.current = screenClient;

          // Join with a screen-specific UID
          const screenUid = `${agoraUidRef.current}_screen`;
          console.log('[Agora] Screen client joining with UID:', screenUid);
          await screenClient.join(appId, roomId, null, screenUid);

          // Create and publish screen track on the screen client
          const screenTrack = AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: screenVideoTrack
          });
          screenTrackRef.current = screenTrack;
          setLocalScreenTrack(screenTrack);
          await screenClient.publish([screenTrack]);

          console.log('[Agora] Screen share published via dual-client, UID:', screenUid);
        } else {
          // WebRTC - store the screen stream directly
          setLocalScreenTrack(screenStream);
        }

        setIsScreenSharing(true);

        // Handle user stopping via browser UI
        screenVideoTrack.onended = () => {
          handleToggleScreenShare();
        };
      }
    } catch (error) {
      console.error('[UnifiedCall] Screen share error:', error);
      alert('Failed to share screen: ' + error.message);
    }
  };

  // Stop screen share handler (for ScreenShareView)
  const handleStopScreenShare = () => {
    handleToggleScreenShare();
  };

  const toggleTranscription = useCallback(() => {
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
      // Clear interim state
      setInterimText('');
      lastInterimRef.current = '';
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
        interimTimeoutRef.current = null;
      }
    } else {
      const started = startListening();
      if (started) setIsTranscribing(true);
    }
  }, [isTranscribing, startListening, stopListening]);

  // Shuffle topic (for meetups) - uses icebreakers from API
  const shuffleTopic = useCallback(() => {
    const topics = icebreakers.length > 0 ? icebreakers : FALLBACK_TOPICS;
    const availableIndices = topics
      .map((_, index) => index)
      .filter(index => !usedTopicIndices.has(index));

    if (availableIndices.length === 0) {
      setUsedTopicIndices(new Set());
      const randomIndex = Math.floor(Math.random() * topics.length);
      setCurrentTopic(topics[randomIndex]);
      setUsedTopicIndices(new Set([randomIndex]));
    } else {
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      setCurrentTopic(topics[randomIndex]);
      setUsedTopicIndices(prev => new Set([...prev, randomIndex]));
    }
  }, [icebreakers, usedTopicIndices]);

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('call_messages')
        .insert({
          channel_name: roomId,
          user_id: user.id,
          user_name: user.name || 'Anonymous',
          message: newMessage.trim()
        })
        .select();

      if (error) throw error;
      setNewMessage('');

      if (data?.[0]) {
        setMessages(prev => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Leave call
  const leaveCall = async () => {
    console.log('[UnifiedCall] Leaving call...');

    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
      // Clear interim state
      setInterimText('');
      lastInterimRef.current = '';
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
        interimTimeoutRef.current = null;
      }
    }

    if (isRecording) {
      stopRecording();
    }

    // Stop screen share track if active
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
      } catch (e) {
        console.log('[UnifiedCall] Screen track stop error:', e);
      }
      screenTrackRef.current = null;
    }

    // Cleanup based on provider
    if (config?.provider === 'webrtc') {
      if (localVideoTrack instanceof MediaStream) {
        localVideoTrack.getTracks().forEach(t => t.stop());
      }
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      realtimeChannelRef.current?.unsubscribe();
      realtimeChannelRef.current = null;
    } else if (config?.provider === 'livekit') {
      try {
        await roomRef.current?.disconnect();
      } catch (e) {
        console.log('[UnifiedCall] LiveKit disconnect error:', e);
      }
      roomRef.current = null;
    } else if (config?.provider === 'agora') {
      try {
        if (localVideoTrack?.close) localVideoTrack.close();
        if (localAudioTrack?.close) localAudioTrack.close();
        await agoraClientRef.current?.leave();
        // Cleanup screen client if active
        if (agoraScreenClientRef.current) {
          await agoraScreenClientRef.current.leave();
          agoraScreenClientRef.current = null;
        }
      } catch (e) {
        console.log('[UnifiedCall] Agora leave error:', e);
      }
      agoraClientRef.current = null;
    }

    hasInitialized.current = false;
    isInitializing.current = false;
    setIsJoined(false);
    console.log('[UnifiedCall] Call left successfully');
  };

  // Handle leave call and show recap
  const handleLeaveCall = async () => {
    // Step 1: Show "Ending call..." transition immediately
    setIsLeaving(true);

    // Capture participant IDs before cleanup
    const participantIds = [user?.id, ...remoteParticipants.map(p => p.id)].filter(Boolean);
    const currentTranscript = [...transcript];
    const currentMessages = [...messages];
    const startTime = callStartTimeRef.current || callStartTime;
    const endTime = new Date().toISOString();

    // Step 2: End room and cleanup video call
    await endRoom();
    await leaveCall();

    // Step 3: Clear all video-related state
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setRemoteParticipants([]);
    setLocalScreenTrack(null);
    setRemoteScreenTrack(null);
    setIsScreenSharing(false);
    setShowChat(false);
    setShowTopics(false);
    setShowParticipants(false);

    // Small delay to ensure video cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Note: meetups/coffee chats are NOT marked completed on call end.
    // They naturally filter out of "upcoming" once their scheduled time passes.

    // Step 4: Prepare recap data
    let allParticipants = [];
    if (participantIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, profile_picture, career')
        .in('id', participantIds);
      allParticipants = profiles || [];
    }

    setRecapData({
      channelName: roomId,
      callType: config.internalType,
      provider: config.provider,
      startedAt: startTime,
      endedAt: endTime,
      duration: startTime && endTime ? Math.floor((new Date(endTime) - new Date(startTime)) / 1000) : 0,
      participants: allParticipants,
      transcript: currentTranscript,
      messages: currentMessages,
    });

    // Step 5: Hide transition and show recap
    setIsLeaving(false);
    setShowRecap(true);

    // Step 6: Generate AI summary in background
    setLoadingSummary(true);
    try {
      const duration = startTime && endTime ? Math.floor((new Date(endTime) - new Date(startTime)) / 1000) : 0;
      const response = await fetch('/api/generate-recap-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: currentTranscript,
          messages: currentMessages,
          participants: allParticipants.map(p => p.name || p.email?.split('@')[0]),
          duration,
          meetingTitle: relatedData?.topic || relatedData?.name || config.ui.title,
          meetingType: callType === 'coffee' ? '1:1 coffee chat' : callType === 'meetup' ? 'group meetup' : 'circle meeting'
        })
      });

      if (response.ok) {
        const summaryData = await response.json();
        setAiSummary(summaryData);

        // Build full summary text for storage
        let fullSummaryText = summaryData.summary || '';
        if (summaryData.keyTakeaways?.length > 0) {
          fullSummaryText += '\n\nKey Takeaways:\n';
          summaryData.keyTakeaways.forEach(t => {
            const text = typeof t === 'string' ? t : (t.text || t);
            const emoji = typeof t === 'object' && t.emoji ? t.emoji + ' ' : '• ';
            fullSummaryText += `${emoji}${text}\n`;
          });
        }
        if (summaryData.actionItems?.length > 0) {
          fullSummaryText += '\nAction Items:\n';
          summaryData.actionItems.forEach(a => {
            const text = typeof a === 'string' ? a : (a.text || a);
            fullSummaryText += `• ${text}\n`;
          });
        }

        // Save recap to database
        try {
          await saveCallRecap({
            channelName: roomId,
            callType: config.internalType,
            provider: config.provider,
            startedAt: startTime,
            endedAt: endTime,
            participants: allParticipants,
            transcript: currentTranscript,
            aiSummary: fullSummaryText.trim(),
            metrics: {},
            userId: user?.id
          });
          console.log('[UnifiedCall] Recap saved to database');
        } catch (saveErr) {
          console.error('[UnifiedCall] Failed to save recap:', saveErr);
        }
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
      // Still save the recap without AI summary
      try {
        await saveCallRecap({
          channelName: roomId,
          callType: config.internalType,
          provider: config.provider,
          startedAt: startTime,
          endedAt: endTime,
          participants: allParticipants,
          transcript: currentTranscript,
          aiSummary: null,
          metrics: {},
          userId: user?.id
        });
        console.log('[UnifiedCall] Recap saved to database (without AI summary)');
      } catch (saveErr) {
        console.error('[UnifiedCall] Failed to save recap:', saveErr);
      }
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRecapClose = () => {
    // Navigate directly without setting showRecap to false
    // This prevents the video call UI from briefly showing during navigation
    router.push('/');
  };

  const handleConnectFromRecap = async (userId) => {
    try {
      await supabase.from('user_interests').insert({
        user_id: user.id,
        interested_in_user_id: userId
      });
      alert('Connection request sent!');
    } catch (err) {
      console.error('Error connecting:', err);
    }
  };

  // Handle sharing summary to circle (for circle calls)
  const handleShareToCircle = async (summaryText) => {
    if (!relatedData?.id || callType !== 'circle') return;

    try {
      const { error } = await supabase.from('connection_group_messages').insert({
        group_id: relatedData.id,
        user_id: user.id,
        message: summaryText
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error sharing to circle:', err);
      throw err;
    }
  };

  // Handle sending summary to a participant via messages
  const handleSendToParticipant = async (participantId, summaryText) => {
    if (!participantId || !user?.id) return;

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: participantId,
        content: summaryText,
        read: false
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error sending to participant:', err);
      throw err;
    }
  };

  const handlePermissionError = (error) => {
    let errorMsg = 'Camera/Microphone Access Denied\n\n';
    if (error.name === 'NotAllowedError') {
      errorMsg += 'Please allow camera and microphone access in your browser settings.';
    } else if (error.name === 'NotFoundError') {
      errorMsg += 'No camera or microphone found.';
    } else if (error.name === 'NotReadableError') {
      errorMsg += 'Camera or microphone is already in use.';
    } else {
      errorMsg += error.message;
    }
    alert(errorMsg);
  };

  // Show "Ending call..." transition
  if (isLeaving) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)',
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-white mb-2">Ending Call</h2>
          <p className="text-stone-400">Preparing your meeting summary...</p>
        </div>
      </div>
    );
  }

  // Show recap
  if (showRecap && recapData) {
    const startTime = recapData.startedAt;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'auto' }}>
        <PostMeetingSummary
          meeting={{
            title: relatedData?.topic || relatedData?.name || config?.ui.title || 'Meeting',
            type: config?.internalType || 'group',
            emoji: config?.ui.emoji || '👥',
            host: user?.name || 'Host',
            date: startTime ? new Date(startTime).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : '',
            duration: recapData.duration,
            location: 'Video Call',
          }}
          summary={aiSummary || {
            summary: loadingSummary ? 'Generating AI summary...' : 'Summary not available',
            sentiment: { overall: 'Productive', emoji: '✨', highlights: ['Connection made'] },
            keyTakeaways: [],
            topicsDiscussed: [],
            memorableQuotes: [],
            actionItems: [],
            suggestedFollowUps: []
          }}
          participants={recapData.participants || []}
          currentUserId={user?.id}
          onClose={handleRecapClose}
          onConnect={handleConnectFromRecap}
          onScheduleFollowUp={() => router.push('/')}
          circleId={callType === 'circle' ? relatedData?.id : null}
          onShareToCircle={callType === 'circle' ? handleShareToCircle : null}
          onSendToParticipant={handleSendToParticipant}
        />
      </div>
    );
  }

  // Invalid call type
  if (!config) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)',
        }}
      >
        <div className="text-white text-center">
          <p className="text-xl mb-4">Invalid call type</p>
          <button
            onClick={() => router.push('/')}
            className="bg-amber-700 hover:bg-amber-800 px-6 py-3 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Get subtitle based on call type
  const getSubtitle = () => {
    if (callType === 'coffee') {
      return isJoined ? `Connected with ${relatedData?.partner_name || 'Partner'}` : 'Connecting...';
    } else if (callType === 'meetup' && relatedData) {
      return `${relatedData.date} at ${relatedData.time}`;
    } else if (callType === 'circle' && relatedData) {
      return relatedData.name || (isJoined ? 'Connected' : 'Connecting...');
    }
    return isJoined ? 'Connected' : 'Connecting...';
  };

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: 'linear-gradient(165deg, #1E1410 0%, #2D1E14 40%, #1A120E 100%)',
      }}
    >
      {/* Agora global styles — cover for camera feeds, contain for screen shares */}
      {config.provider === 'agora' && (
        <style jsx global>{`
          [class*="agora_video"] video,
          div[id*="video"] video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
          [data-screen-share] [class*="agora_video"] video,
          [data-screen-share] div[id*="video"] video,
          [data-screen-share] video {
            object-fit: contain !important;
          }
        `}</style>
      )}

      {/* Header */}
      <VideoHeader
        title={
          callType === 'coffee' && relatedData?.partner_name ? `Coffee Chat with ${relatedData.partner_name}`
          : callType === 'circle' && relatedData?.meetupTopic ? relatedData.meetupTopic
          : callType === 'meetup' && relatedData?.topic ? relatedData.topic
          : config.ui.title
        }
        brandName={
          callType === 'meetup' && relatedData?.topic ? relatedData.topic
          : callType === 'circle' && relatedData?.name ? relatedData.name
          : config.ui.brandName
        }
        callType={callType}
        subtitle={getSubtitle()}
        participantCount={participantCount}
        providerBadge={config.provider}
        isConnecting={isConnecting}
        isTranscribing={isTranscribing && callType === 'coffee'}
        isRecording={isRecording}
        gridView={gridView}
        showGridToggle={remoteParticipants.length > 0}
        onToggleView={() => setGridView(!gridView)}
        meetingId={roomId}
        callDuration={callDuration}
        connectionQuality={connectionQuality}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg animate-slide-up"
          style={{ background: 'rgba(45, 30, 20, 0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(245,237,228,0.1)' }}
        >
          {toastMessage}
        </div>
      )}

      {/* Video Area */}
      <div className={`flex-1 p-2 sm:p-3 relative transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`} style={{ minHeight: 0 }}>
        {gridView ? (
          <VideoGrid
            localVideoRef={localVideoRef}
            localVideoTrack={localVideoTrack}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            userName={user?.name || 'You'}
            accentColor={config.ui.accentColor}
            remoteParticipants={remoteParticipants}
            providerType={config.provider}
            localScreenTrack={localScreenTrack}
            remoteScreenTrack={remoteScreenTrack}
            screenSharerName={screenSharerName}
            onStopScreenShare={handleStopScreenShare}
            isBlurEnabled={isBlurEnabled}
            isBlurSupported={isBlurSupported}
            isBlurLoading={blurLoading}
            onToggleBlur={handleToggleBlur}
            blurCanvas={blurCanvasEl}
          />
        ) : (
          <VideoSpeakerView
            localVideoRef={localVideoRef}
            localVideoTrack={localVideoTrack}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            userName={user?.name || 'You'}
            accentColor={config.ui.accentColor}
            remoteParticipants={remoteParticipants}
            providerType={config.provider}
            isLocalMain={isLocalMain}
            onSwap={() => setIsLocalMain(!isLocalMain)}
            localScreenTrack={localScreenTrack}
            remoteScreenTrack={remoteScreenTrack}
            screenSharerName={screenSharerName}
            onStopScreenShare={handleStopScreenShare}
            isBlurEnabled={isBlurEnabled}
            isBlurSupported={isBlurSupported}
            isBlurLoading={blurLoading}
            onToggleBlur={handleToggleBlur}
            blurCanvas={blurCanvasEl}
          />
        )}

        {/* Transcript Overlay */}
        <TranscriptOverlay
          transcript={transcript}
          isTranscribing={isTranscribing}
          interimText={interimText}
          speakerName={user?.name || 'You'}
        />
      </div>

      {/* Controls */}
      <div className={`flex-shrink-0 overflow-visible relative z-50 transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`}>
        <ControlBar
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isBlurEnabled={isBlurEnabled}
          isBlurSupported={isBlurSupported}
          isBlurLoading={blurLoading}
          isScreenSharing={isScreenSharing}
          isOtherSharing={!!remoteScreenTrack && !isScreenSharing}
          isScreenShareSupported={isScreenShareSupported}
          screenSharerName={screenSharerName}
          isRecording={isRecording}
          recordingTime={recordingTime}
          isTranscribing={isTranscribing}
          isSpeechSupported={isSpeechSupported}
          isSafari={isSafari}
          showChat={showChat}
          showTopics={showTopics}
          showParticipants={showParticipants}
          messagesCount={unreadCount}
          participantCount={remoteParticipants.length + 1}
          transcriptionLanguage={transcriptionLanguage}
          videoDevices={videoDevices}
          audioDevices={audioDevices}
          selectedVideoDevice={selectedVideoDevice}
          selectedAudioDevice={selectedAudioDevice}
          onVideoDeviceChange={handleVideoDeviceChange}
          onAudioDeviceChange={handleAudioDeviceChange}
          isVideoDeviceSwitching={isVideoDeviceSwitching}
          isAudioDeviceSwitching={isAudioDeviceSwitching}
          features={config.features}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleBlur={handleToggleBlur}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleRecording={() => isRecording ? stopRecording() : startRecording()}
          onToggleTranscription={toggleTranscription}
          onToggleChat={() => {
            setShowChat(!showChat);
            if (!showChat) {
              setActiveTab('messages');
              setUnreadCount(0);
            }
          }}
          onToggleTopics={() => {
            setShowTopics(!showTopics);
            if (!showTopics) setActiveTab('topics');
          }}
          onToggleParticipants={() => {
            setShowParticipants(!showParticipants);
            if (!showParticipants) setActiveTab('participants');
          }}
          onLanguageChange={handleLanguageChange}
          onLeave={handleLeaveCall}
          formatTime={formatTime}
        />
      </div>

      {/* Sidebar - Modal/Drawer on mobile, Fixed panel on desktop */}
      {showSidebar && (
        <>
          {/* Mobile backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => {
              setShowChat(false);
              setShowTopics(false);
              setShowParticipants(false);
            }}
          />
          {/* Sidebar panel - Glass morphism */}
          <div
            className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm md:w-80 flex flex-col z-50 animate-slide-in-right md:animate-none"
            style={{
              background: 'rgba(30, 20, 14, 0.85)',
              backdropFilter: 'blur(24px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
              borderLeft: '1px solid rgba(245,237,228,0.08)',
            }}
          >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <span
              className="text-base font-bold"
              style={{ color: '#F5EDE4', letterSpacing: '-0.02em' }}
            >
              Meeting Panel
            </span>
            <button
              onClick={() => {
                setShowChat(false);
                setShowTopics(false);
                setShowParticipants(false);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ background: 'rgba(245,237,228,0.06)', color: 'rgba(245,237,228,0.5)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex mx-2" style={{ borderBottom: '1px solid rgba(245,237,228,0.08)' }}>
            {showChat && (
              <button
                onClick={() => setActiveTab('messages')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative"
                style={{ color: activeTab === 'messages' ? '#D4A574' : 'rgba(245,237,228,0.5)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Messages</span>
                {activeTab === 'messages' && (
                  <div className="absolute bottom-0 left-[15%] right-[15%] h-0.5 rounded-full" style={{ background: '#D4A574' }} />
                )}
              </button>
            )}
            {showTopics && (
              <button
                onClick={() => setActiveTab('topics')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative"
                style={{ color: activeTab === 'topics' ? '#D4A574' : 'rgba(245,237,228,0.5)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.48 2 2 6 2 11c0 2.5 1.1 4.8 2.9 6.5L4 22l4.5-2.3c1.1.3 2.3.5 3.5.5 5.52 0 10-4 10-9s-4.48-9-10-9z" />
                  <circle cx="8" cy="11" r="1" fill="currentColor" />
                  <circle cx="12" cy="11" r="1" fill="currentColor" />
                  <circle cx="16" cy="11" r="1" fill="currentColor" />
                </svg>
                <span>Topics</span>
                {activeTab === 'topics' && (
                  <div className="absolute bottom-0 left-[15%] right-[15%] h-0.5 rounded-full" style={{ background: '#D4A574' }} />
                )}
              </button>
            )}
            {showParticipants && (
              <button
                onClick={() => setActiveTab('participants')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative"
                style={{ color: activeTab === 'participants' ? '#D4A574' : 'rgba(245,237,228,0.5)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>People</span>
                {activeTab === 'participants' && (
                  <div className="absolute bottom-0 left-[15%] right-[15%] h-0.5 rounded-full" style={{ background: '#D4A574' }} />
                )}
              </button>
            )}
          </div>

          {/* Chat Content */}
          {showChat && (enabledPanels.length === 1 || activeTab === 'messages') && (
            <ChatPanel
              messages={messages}
              currentUserId={user?.id}
              newMessage={newMessage}
              onNewMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
            />
          )}

          {/* Topics Content */}
          {showTopics && (enabledPanels.length === 1 || activeTab === 'topics') && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Topic Card */}
              <div className="p-3.5">
                {icebreakersLoading ? (
                  <div
                    className="rounded-2xl p-4 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212,165,116,0.15) 0%, rgba(139,94,60,0.12) 100%)',
                      border: '1px solid rgba(212,165,116,0.25)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span style={{ color: '#D4A574' }} className="text-sm">Loading icebreakers...</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl p-4 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212,165,116,0.15) 0%, rgba(139,94,60,0.12) 100%)',
                      border: '1px solid rgba(212,165,116,0.25)',
                    }}
                  >
                    {/* Subtle glow */}
                    <div
                      className="absolute -top-5 -right-5 w-20 h-20"
                      style={{ background: 'radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)' }}
                    />
                    <div className="flex items-start gap-3 relative">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-[10px] font-bold uppercase"
                            style={{ color: '#D4A574', letterSpacing: '1.2px' }}
                          >
                            Current Topic
                          </span>
                          {isAIGenerated && (
                            <span className="flex items-center gap-1 text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                              ✨ AI
                            </span>
                          )}
                          {currentTopic?.category && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: 'rgba(245,237,228,0.08)', color: 'rgba(245,237,228,0.6)' }}
                            >
                              {currentTopic.category}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[15px] font-semibold leading-relaxed"
                          style={{ color: '#F5EDE4', letterSpacing: '-0.01em' }}
                        >
                          {currentTopic?.question || currentTopic || 'Click shuffle to get a conversation starter!'}
                        </p>
                      </div>
                      <button
                        onClick={shuffleTopic}
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
                        style={{
                          background: '#D4A574',
                          boxShadow: '0 2px 8px rgba(212,165,116,0.3)',
                        }}
                        title="Shuffle topic"
                        disabled={icebreakersLoading}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 3 21 3 21 8" />
                          <line x1="4" y1="20" x2="21" y2="3" />
                          <polyline points="21 16 21 21 16 21" />
                          <line x1="15" y1="15" x2="21" y2="21" />
                          <line x1="4" y1="4" x2="9" y2="9" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Transcript */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mx-3.5 mb-2 flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: isTranscribing ? '#6BBF6A' : 'rgba(245,237,228,0.3)',
                      animation: isTranscribing ? 'pulse 2s ease infinite' : 'none',
                    }}
                  />
                  <span className="text-xs font-semibold" style={{ color: '#F5EDE4', letterSpacing: '0.02em' }}>
                    Live Transcript
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-3.5 pb-3 space-y-2.5 scrollbar-thin">
                  {transcript.length === 0 && !interimText ? (
                    <div className="flex flex-col items-center justify-center pt-12 gap-3">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(245,237,228,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: 'rgba(245,237,228,0.5)' }}>
                        {isTranscribing ? 'Listening... Start speaking!' : 'Transcript will appear here'}
                      </span>
                    </div>
                  ) : (
                    <>
                      {transcript.map((entry, idx) => (
                        <div key={idx} className="animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold" style={{ color: '#D4A574' }}>
                              {entry.speakerName}
                            </span>
                            <span className="text-[10px]" style={{ color: 'rgba(245,237,228,0.3)' }}>
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div
                            className="rounded-xl px-3 py-2 text-sm"
                            style={{
                              background: 'rgba(245,237,228,0.08)',
                              borderLeft: '2px solid rgba(212,165,116,0.25)',
                              color: 'rgba(245,237,228,0.8)',
                              lineHeight: 1.5,
                            }}
                          >
                            {entry.text}
                          </div>
                        </div>
                      ))}
                      {/* Show interim text while speaking */}
                      {interimText && (
                        <div className="animate-slide-up opacity-70">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold" style={{ color: '#D4A574' }}>
                              {user?.name || 'You'}
                            </span>
                            <span className="text-[10px]" style={{ color: '#6BBF6A' }}>
                              speaking...
                            </span>
                          </div>
                          <div
                            className="rounded-xl px-3 py-2 text-sm italic"
                            style={{
                              background: 'rgba(245,237,228,0.08)',
                              borderLeft: '2px solid rgba(107,191,106,0.4)',
                              color: 'rgba(245,237,228,0.7)',
                              lineHeight: 1.5,
                            }}
                          >
                            {interimText}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Participants Content */}
          {showParticipants && (enabledPanels.length === 1 || activeTab === 'participants') && (
            <ParticipantsPanel
              currentUser={user}
              remoteParticipants={remoteParticipants}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isScreenSharing={isScreenSharing}
              participantCount={participantCount}
            />
          )}

          {/* Brand footer */}
          <div
            className="py-2 flex items-center justify-center"
            style={{ borderTop: '1px solid rgba(245,237,228,0.08)' }}
          >
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ color: 'rgba(245,237,228,0.2)', letterSpacing: '1.5px' }}
            >
              CircleW
            </span>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
