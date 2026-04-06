'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCallTypeConfig, isValidCallType } from '@/lib/video/callTypeConfig';
import { saveCallRecap } from '@/lib/callRecapHelpers';
import { completeCoffeeChat } from '@/lib/coffeeChatHelpers';
import { io } from 'socket.io-client';
import { useCallRoom } from '@/hooks/useCallRoom';
import { useRecording } from '@/hooks/useRecording';
import useTranscription from '@/hooks/useTranscription';
import useTranscriptConsent from '@/hooks/useTranscriptConsent';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import useDeviceSelection from '@/hooks/useDeviceSelection';
import PostMeetingSummary from '@/components/PostMeetingSummary';
import TranscriptConsentModal from '@/components/video/TranscriptConsentModal';
import TranscriptIndicator from '@/components/video/TranscriptIndicator';

import {
  VideoHeader,
  ControlBar,
  VideoGrid,
  VideoSpeakerView,
  TranscriptOverlay,
  ChatPanel,
  ParticipantsPanel,
} from '@/components/video';

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
  const allParticipantIdsRef = useRef(new Set()); // Track everyone who ever joined
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const activeSpeakerTimeoutRef = useRef(null);

  // Control state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [gridView, setGridView] = useState(true); // Start in grid, auto-switch to speaker when someone talks
  const [autoSwitchedToSpeaker, setAutoSwitchedToSpeaker] = useState(false);
  const autoSwitchedRef = useRef(false);
  const gridViewRef = useRef(true);
  const activeSpeakerIdRef = useRef(null);
  // Keep refs in sync for use in event handler closures
  gridViewRef.current = gridView;
  activeSpeakerIdRef.current = activeSpeakerId;
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
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('zh-CN');
  const [pendingLanguageRestart, setPendingLanguageRestart] = useState(false);

  // Transcript consent
  const {
    consentStatus,
    consentRequester,
    attemptCount,
    requestConsent,
    respondToConsent,
    cancelConsent,
    stopTranscription: stopConsentTranscription,
    deleteConsentRow,
  } = useTranscriptConsent({
    roomId,
    userId: user?.id,
    userName: user?.name,
    callType,
    consentMode: config?.consentMode || 'host',
    userPreference: user?.transcription_preference || 'ask',
    supabase,
    isJoined,
  });

  // Discussion topics state
  const [discussionTopics, setDiscussionTopics] = useState(null);

  // Load discussion topics — extract meetup UUID from channel name (meetup-{uuid})
  const meetupUUID = roomId?.startsWith('meetup-') ? roomId.replace('meetup-', '') : relatedData?.id;
  useEffect(() => {
    if (!meetupUUID || !config?.features.topics) return;

    const loadTopics = async () => {
      try {
        // Try cache first
        const cacheRes = await fetch(`/api/agent/discussion-topics?meetupId=${meetupUUID}`);
        const cacheData = await cacheRes.json();
        if (cacheData.found && cacheData.topics) {
          setDiscussionTopics(cacheData.topics);
          return;
        }

        // No cache — generate on demand
        const res = await fetch('/api/agent/discussion-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetupId: meetupUUID,
            title: relatedData?.topic || relatedData?.name || '',
            description: relatedData?.description || '',
            attendees: (roomParticipants || []).map(p => ({
              name: p.name,
              career: p.career,
              interests: p.interests || [],
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.topics) setDiscussionTopics(data.topics);
        }
      } catch (err) {
        console.error('[Call] Error loading discussion topics:', err);
      }
    };

    loadTopics();
  }, [meetupUUID, config?.features.topics]);

  // Screen share state
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState(null);
  const [screenSharerName, setScreenSharerName] = useState('');

  // Meeting info state
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('good');

  // Host controls
  const hostChannelRef = useRef(null);
  const isHost = relatedData?.creator_id === user?.id || relatedData?.created_by === user?.id;

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
  // Ref to store latest relatedData for use in ontrack closure
  const relatedDataRef = useRef(null);

  // Provider-specific refs
  const roomRef = useRef(null); // LiveKit room
  const peerConnectionRef = useRef(null); // WebRTC
  const iceCandidateQueueRef = useRef([]); // Buffer ICE candidates until remote description is set
  const qualityMonitorRef = useRef(null); // Adaptive bitrate stats interval
  const disconnectGraceRef = useRef(null); // Grace period before showing "Disconnected"
  const prevStatsRef = useRef(null); // Previous stats snapshot for delta calculation
  const realtimeChannelRef = useRef(null); // Supabase channel (unused for WebRTC now)
  const signalingSocketRef = useRef(null); // Socket.IO signaling for WebRTC
  const remotePeerIdRef = useRef(null); // Remote peer user ID for Socket.IO targeted messages
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
  // Ref to track active transcription provider ('webspeech' or 'deepgram')
  const transcriptionProviderRef = useRef('webspeech');
  // Track last auto-finalized text to skip duplicate from browser's final event
  const lastAutoFinalizedRef = useRef('');
  // Echo guard refs (kept for future use but disabled — too aggressive in group calls)
  const remoteSpeakingActiveRef = useRef(false);
  const echoGuardTimeoutRef = useRef(null);

  // Save transcript entry to database
  const saveTranscriptToDb = useCallback(async (entry) => {
    if (!roomId) return;
    // Try getSession first (no network call), fall back to refreshSession
    let session;
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) {
      session = existing;
    } else {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed) {
        console.warn('[Transcript] Auth failed, skipping save:', refreshError?.message || 'no session');
        return;
      }
      session = refreshed;
    }
    const { error } = await supabase.from('call_transcripts').insert({
      channel_name: roomId,
      user_id: session.user.id,
      speaker_name: entry.speakerName,
      text: entry.text,
      timestamp: entry.timestamp,
      is_final: true
    });
    if (error) console.error('Failed to save transcript:', error);
  }, [roomId]);

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

      saveTranscriptToDb(entry);

      // Restart recognition to clear browser's accumulated buffer (Web Speech API only)
      if (transcriptionProviderRef.current === 'webspeech' && restartListeningRef.current) {
        console.log('[Transcript] Restarting recognition to clear buffer');
        restartListeningRef.current();
      }
    }
  }, [user, roomId, saveTranscriptToDb]);

  // Transcription handler
  const handleTranscript = useCallback(({ text, isFinal, timestamp }) => {
    // Note: Echo guard disabled — was too aggressive in group calls, blocking
    // the local user's own speech. Relying on Web Speech API's built-in echo
    // cancellation and Deepgram's gain-node muting instead.

    // Clear any pending auto-finalize
    if (interimTimeoutRef.current) {
      clearTimeout(interimTimeoutRef.current);
      interimTimeoutRef.current = null;
    }

    if (isFinal && text.trim()) {
      const finalText = text.trim();

      // If we auto-finalized a partial and Deepgram now sends the full final,
      // replace the partial with the complete version
      if (lastAutoFinalizedRef.current && finalText.includes(lastAutoFinalizedRef.current)) {
        console.log('[Transcript] Replacing auto-finalized partial with full final:', finalText);
        setTranscript(prev => {
          // Remove the last entry that matches the auto-finalized partial
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].text === lastAutoFinalizedRef.current) {
              updated.splice(i, 1);
              break;
            }
          }
          return [...updated, {
            speakerId: user?.id || 'local',
            speakerName: user?.name || 'You',
            text: finalText,
            timestamp,
            isFinal: true
          }];
        });
        lastAutoFinalizedRef.current = '';
        setInterimText('');
        lastInterimRef.current = '';
        saveTranscriptToDb({
          speakerId: user?.id || 'local',
          speakerName: user?.name || 'You',
          text: finalText,
          timestamp,
          isFinal: true
        });
        return;
      }

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

      saveTranscriptToDb(entry);
    } else if (!isFinal && text.trim()) {
      // Show interim text directly
      console.log('[Transcript] Interim:', text.trim());
      setInterimText(text.trim());
      lastInterimRef.current = text.trim();

      // Auto-finalize after pause — Deepgram sends its own finals so use longer
      // timeout as safety net only; Web Speech API needs shorter timeout
      const autoFinalizeDelay = transcriptionProviderRef.current === 'deepgram' ? 3000 : 800;
      interimTimeoutRef.current = setTimeout(() => {
        finalizeInterim();
      }, autoFinalizeDelay);
    }
  }, [user, roomId, finalizeInterim, saveTranscriptToDb]);

  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    isSafari,
    error: speechError,
    startListening,
    stopListening,
    restartListening,
    provider: transcriptionProvider,
    setRemoteSpeaking,
    setExternalAudioTrack,
  } = useTranscription({
    onTranscript: handleTranscript,
    language: transcriptionLanguage,
    continuous: true,
    interimResults: true
  });

  // Store restartListening, provider, and echo suppression in refs so callbacks can access them
  const setRemoteSpeakingRef = useRef(null);
  useEffect(() => {
    restartListeningRef.current = restartListening;
    transcriptionProviderRef.current = transcriptionProvider;
    setRemoteSpeakingRef.current = setRemoteSpeaking;
  }, [restartListening, transcriptionProvider, setRemoteSpeaking]);

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
      console.log('[UnifiedCall] Fetching user with profile...');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log('[UnifiedCall] Auth result:', { user: authData?.user?.id, error: authError?.message });
      if (authData?.user) {
        // Fetch profile to get display name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('name, profile_picture, role, transcription_preference')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          console.error('[UnifiedCall] Profile fetch error:', profileError.message);
        }
        console.log('[UnifiedCall] Profile loaded:', profile?.name);

        // Merge profile data with user object
        setUser({
          ...authData.user,
          name: profile?.name || authData.user.email?.split('@')[0],
          profile_picture: profile?.profile_picture,
          role: profile?.role,
          transcription_preference: profile?.transcription_preference || 'ask',
        });
        console.log('[UnifiedCall] User set, config:', config?.provider);
      } else {
        console.warn('[UnifiedCall] No auth user, redirecting to /');
        router.push('/home');
      }
    }
    fetchUserWithProfile();
  }, [router]);

  // Load eruda debug console for admin users (mobile debugging)
  useEffect(() => {
    if (user?.role !== 'admin') return;
    import('eruda').then(({ default: eruda }) => {
      if (!eruda._isInit) eruda.init();
    });
  }, [user?.role]);

  // Validate call type
  useEffect(() => {
    if (!isValidCallType(callType)) {
      console.error('Invalid call type:', callType);
      router.push('/home');
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
    console.log('[UnifiedCall] Init check — user:', !!user, 'config:', !!config, 'hasInit:', hasInitialized.current, 'isIniting:', isInitializing.current);
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

  // Update remote participant name when relatedData finishes loading
  // (ontrack handler captures stale relatedData from its closure)
  useEffect(() => {
    if (relatedData?.partner_name && config?.provider === 'webrtc') {
      setRemoteParticipants(prev => {
        if (prev.length === 0) return prev;
        return prev.map(p => ({
          ...p,
          name: relatedData.partner_name,
          _lastUpdate: Date.now(),
        }));
      });
    }
  }, [relatedData?.partner_name, config?.provider]);

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
    relatedDataRef.current = relatedData;

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
  }, [roomParticipants, remoteParticipants.length]);

  // Manage video subscriptions based on active speaker in speaker mode (3+ participants)
  // Only subscribe to the active speaker's video; unsubscribe others to save bandwidth
  const speakerOptimizationActiveRef = useRef(false);
  useEffect(() => {
    // Only optimize in speaker mode with 3+ participants
    if (gridView || remoteParticipants.length < 2) {
      // Switched back to grid or fewer people: re-subscribe all video
      if (speakerOptimizationActiveRef.current) {
        resubscribeAllVideo();
        speakerOptimizationActiveRef.current = false;
      }
      return;
    }
    speakerOptimizationActiveRef.current = true;

    const client = agoraClientRef.current;
    const room = roomRef.current;

    if (config?.provider === 'agora' && client) {
      // Find which UID should have video
      const speakerUid = activeSpeakerId || String(remoteParticipants[0]?.uid || remoteParticipants[0]?.id);
      let changed = false;

      const ops = [];
      for (const remoteUser of client.remoteUsers) {
        const uid = String(remoteUser.uid);
        if (uid.endsWith('_screen')) continue; // Don't touch screen shares

        if (uid === speakerUid) {
          // Subscribe to active speaker's video if not already subscribed
          if (!remoteUser.videoTrack && remoteUser.hasVideo) {
            ops.push(
              client.subscribe(remoteUser, 'video').catch(() => {})
            );
            changed = true;
          }
        } else {
          // Unsubscribe non-speakers' video to save bandwidth
          if (remoteUser.videoTrack) {
            ops.push(
              client.unsubscribe(remoteUser, 'video').catch(() => {})
            );
            changed = true;
          }
        }
      }

      // Batch update participants after all subscribe/unsubscribe ops complete
      if (changed) {
        Promise.all(ops).then(() => updateAgoraParticipants(client));
      }
    } else if (config?.provider === 'livekit' && room) {
      const speakerId = activeSpeakerId || remoteParticipants[0]?.id;

      for (const [, participant] of room.remoteParticipants) {
        const camPub = participant.getTrackPublication('camera');
        if (!camPub) continue;

        if (participant.identity === speakerId) {
          camPub.setSubscribed(true);
        } else {
          camPub.setSubscribed(false);
        }
      }
      // LiveKit auto-updates tracks via events, so updateLiveKitParticipants
      // will be triggered by TrackSubscribed/TrackUnsubscribed events
    }
  }, [activeSpeakerId, gridView, remoteParticipants.length, config?.provider]);

  // Re-subscribe all video (when switching back to grid mode)
  const resubscribeAllVideo = () => {
    const client = agoraClientRef.current;
    const room = roomRef.current;

    if (config?.provider === 'agora' && client) {
      for (const remoteUser of client.remoteUsers) {
        if (String(remoteUser.uid).endsWith('_screen')) continue;
        if (remoteUser.hasVideo && !remoteUser.videoTrack) {
          client.subscribe(remoteUser, 'video').then(() => {
            updateAgoraParticipants(client);
          }).catch(() => {});
        }
      }
    } else if (config?.provider === 'livekit' && room) {
      for (const [, participant] of room.remoteParticipants) {
        const camPub = participant.getTrackPublication('camera');
        if (camPub) camPub.setSubscribed(true);
      }
    }
  };

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

      // Write join signal for live call detection
      // Strip call-type prefix from roomId for UUID columns (e.g. coffee-{uuid} → {uuid})
      const signalRoomId = roomId?.includes('-') && roomId.split('-').length > 5
        ? roomId.replace(/^[a-z]+-/, '')
        : roomId;
      supabase.from('video_signals').insert({
        room_id: signalRoomId,
        channel_name: roomId,
        sender_id: user?.id,
        type: 'join',
        data: {},
      }).then(({ error }) => {
        if (error) console.warn('[UnifiedCall] Failed to write join signal:', error);
      });


      await startRoom();

      // Transcription now requires consent — don't auto-start
      // User must click "Start Transcription" in the control bar

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
      video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    setLocalVideoTrack(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // ICE server configuration
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
    if (turnUser && turnCred) {
      iceServers.push(
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:global.relay.metered.ca:80', username: turnUser, credential: turnCred },
        { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: turnUser, credential: turnCred },
        { urls: 'turn:global.relay.metered.ca:443', username: turnUser, credential: turnCred },
        { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: turnUser, credential: turnCred },
      );
      console.log('[WebRTC] TURN servers configured');
    } else {
      console.warn('[WebRTC] ⚠️ TURN servers NOT configured — calls will fail behind symmetric NAT, corporate Wi-Fi, or cellular networks. Set NEXT_PUBLIC_TURN_USERNAME and NEXT_PUBLIC_TURN_CREDENTIAL env vars.');
    }

    // Create (or recreate) a peer connection with all event handlers wired up
    const createPeerConnection = () => {
      // Clean up old connection if any
      if (peerConnectionRef.current) {
        if (qualityMonitorRef.current) {
          clearInterval(qualityMonitorRef.current);
          qualityMonitorRef.current = null;
        }
        try { peerConnectionRef.current.close(); } catch (e) { /* ignore */ }
      }
      // Do NOT clear iceCandidateQueueRef here — candidates may have arrived
      // before the offer. The queue is flushed after setRemoteDescription().

      const newPc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = newPc;

      // Add local tracks
      stream.getTracks().forEach(track => {
        const sender = newPc.addTrack(track, stream);
        if (track.kind === 'video') {
          track.contentHint = 'motion';
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = 1_500_000;
          params.encodings[0].maxFramerate = 24;
          params.degradationPreference = 'maintain-framerate';
          sender.setParameters(params).catch(e => console.warn('[WebRTC] Could not set video params:', e.message));
        }
      });

      // Collect remote tracks — ontrack fires once per track (audio + video)
      const remoteTracks = { video: null, audio: null };
      newPc.ontrack = (event) => {
        console.log('[WebRTC] ontrack fired, track kind:', event.track.kind, 'readyState:', event.track.readyState, 'enabled:', event.track.enabled);
        if (event.track.kind === 'video') {
          remoteTracks.video = new MediaStream([event.track]);
        } else if (event.track.kind === 'audio') {
          remoteTracks.audio = new MediaStream([event.track]);
        }
        const rd = relatedDataRef.current || relatedData;
        const partnerId = rd && user?.id
          ? (rd.requester_id === user.id ? rd.recipient_id : rd.requester_id) || 'remote'
          : 'remote';
        setRemoteParticipants([{
          id: partnerId,
          name: rd?.partner_name || 'Partner',
          videoTrack: remoteTracks.video,
          audioTrack: remoteTracks.audio,
          hasVideo: !!remoteTracks.video,
          hasAudio: !!remoteTracks.audio,
          _lastUpdate: Date.now(),
        }]);
      };

      newPc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', newPc.connectionState);
        if (newPc.connectionState === 'disconnected') {
          if (disconnectGraceRef.current) clearTimeout(disconnectGraceRef.current);
          disconnectGraceRef.current = setTimeout(() => {
            if (newPc.connectionState === 'disconnected' || newPc.connectionState === 'failed') {
              setRemoteParticipants(prev => prev.map(p => ({
                ...p,
                isDisconnected: true,
                _lastUpdate: Date.now(),
              })));
            }
          }, 5000);
        } else if (newPc.connectionState === 'failed') {
          if (disconnectGraceRef.current) clearTimeout(disconnectGraceRef.current);
          setRemoteParticipants(prev => prev.map(p => ({
            ...p,
            isDisconnected: true,
            _lastUpdate: Date.now(),
          })));
        } else if (newPc.connectionState === 'connected') {
          if (disconnectGraceRef.current) {
            clearTimeout(disconnectGraceRef.current);
            disconnectGraceRef.current = null;
          }
          setRemoteParticipants(prev => prev.map(p => ({
            ...p,
            isDisconnected: false,
            _lastUpdate: Date.now(),
          })));
          newPc.getStats().then(stats => {
            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                const localId = report.localCandidateId;
                const remoteId = report.remoteCandidateId;
                stats.forEach(s => {
                  if (s.id === localId) console.log('[WebRTC] Local candidate:', s.candidateType, s.protocol, s.address);
                  if (s.id === remoteId) console.log('[WebRTC] Remote candidate:', s.candidateType, s.protocol, s.address);
                });
                console.log('[WebRTC] Round-trip time:', report.currentRoundTripTime, 's');
              }
            });
          });
          startQualityMonitor(newPc);
        }
      };

      newPc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', newPc.iceConnectionState);
        if (newPc.iceConnectionState === 'failed') {
          console.error('[WebRTC] ❌ ICE FAILED — likely NAT traversal issue. Check TURN server config.');
          newPc.getStats().then(stats => {
            let candidatePairs = 0;
            let relayCandidates = 0;
            stats.forEach(report => {
              if (report.type === 'candidate-pair') candidatePairs++;
              if (report.type === 'local-candidate' && report.candidateType === 'relay') relayCandidates++;
            });
            console.log(`[WebRTC] Candidate pairs attempted: ${candidatePairs}, relay candidates: ${relayCandidates}`);
            if (relayCandidates === 0) {
              console.error('[WebRTC] ❌ No relay (TURN) candidates — TURN server is missing or not working');
            }
          });
        }
      };

      newPc.onicecandidate = (event) => {
        if (event.candidate && signalingSocketRef.current?.connected) {
          signalingSocketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            to: remotePeerIdRef.current,
          });
        }
        if (!event.candidate) {
          console.log('[WebRTC] ICE gathering complete');
        }
      };

      newPc.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', newPc.iceGatheringState);
      };

      console.log('[WebRTC] Peer connection created');
      return newPc;
    };

    let pc = createPeerConnection();

    // Setup Socket.IO signaling — reliable delivery via Render server
    const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: isMobile ? 500 : 1000,
      reconnectionDelayMax: isMobile ? 3000 : 5000,
      reconnectionAttempts: isMobile ? 10 : 5,
      timeout: isMobile ? 30000 : 20000,
      upgrade: true,
      rememberUpgrade: true,
      path: '/socket.io/',
    });

    signalingSocketRef.current = socket;
    let remotePeerId = null;
    // Lower user ID = impolite (offerer); higher user ID = polite (answerer)
    const amIPolite = (remoteId) => (user?.id || '') > remoteId;

    socket.on('connect', () => {
      console.log('[WebRTC] Connected to signaling server');
      socket.emit('register', { userId: user?.id, matchId: roomId });
    });

    socket.on('reconnect', () => {
      console.log('[WebRTC] Reconnected to signaling server');
      socket.emit('register', { userId: user?.id, matchId: roomId });
    });

    // Handle server errors (e.g. match_full when old socket lingers)
    socket.on('error', ({ type, message }) => {
      console.warn('[WebRTC] Server error:', type, message);
      if (type === 'match_full') {
        // Old socket still in match — retry after it gets cleaned up
        console.log('[WebRTC] Match full, retrying registration in 3s...');
        setTimeout(() => {
          if (socket.connected) {
            socket.emit('register', { userId: user?.id, matchId: roomId });
          }
        }, 3000);
      }
    });

    // Receive signaling messages from remote peer
    // Always use peerConnectionRef.current so handlers see the latest PC after recreation
    socket.on('offer', ({ offer, from }) => {
      console.log('[WebRTC] Received offer from:', from);
      remotePeerId = from;
      remotePeerIdRef.current = from;
      // Create or repair PC if needed — the offer is the synchronization point
      const currentPc = peerConnectionRef.current;
      if (!currentPc || currentPc.connectionState === 'failed' || currentPc.connectionState === 'closed' || currentPc.connectionState === 'disconnected') {
        console.log('[WebRTC] Creating fresh peer connection for incoming offer');
        pc = createPeerConnection();
      }
      handleWebRTCSignal({ type: 'offer', offer }, peerConnectionRef.current, amIPolite(from));
    });

    socket.on('answer', ({ answer, from }) => {
      console.log('[WebRTC] Received answer from:', from);
      handleWebRTCSignal({ type: 'answer', answer }, peerConnectionRef.current, amIPolite(from));
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      handleWebRTCSignal({ type: 'ice-candidate', candidate }, peerConnectionRef.current, false);
    });

    // Room events — peer join/leave
    socket.on('joined', ({ participants: roomParticipants }) => {
      console.log('[WebRTC] Joined room, participants:', roomParticipants);
      const others = roomParticipants.filter(id => id !== user?.id);
      if (others.length > 0) {
        remotePeerId = others[0];
        remotePeerIdRef.current = others[0];
        allParticipantIdsRef.current.add(others[0]);
        const polite = amIPolite(remotePeerId);
        console.log('[WebRTC] Peer already present, I am', polite ? 'polite' : 'impolite');
        if (!polite) {
          createWebRTCOffer(peerConnectionRef.current);
        }
        // Polite peer waits for offer — no fallback timer needed with reliable signaling
      } else {
        console.log('[WebRTC] First in room, waiting for peer to join');
      }
    });

    socket.on('user-joined', ({ userId: joinedUserId }) => {
      if (joinedUserId === user?.id) return;
      remotePeerId = joinedUserId;
      remotePeerIdRef.current = joinedUserId;
      allParticipantIdsRef.current.add(joinedUserId);

      // Clear disconnected state — peer is back
      setRemoteParticipants(prev => prev.map(p => ({
        ...p,
        isDisconnected: false,
        _lastUpdate: Date.now(),
      })));

      const polite = amIPolite(remotePeerId);
      console.log('[WebRTC] I am', polite ? 'polite' : 'impolite');
      if (!polite) {
        // Impolite peer: create fresh PC and send offer immediately
        console.log('[WebRTC] Peer joined, creating fresh peer connection');
        pc = createPeerConnection();
        createWebRTCOffer(peerConnectionRef.current);
      }
      // Polite peer: wait for the offer — it is the true synchronization point.
      // Creating a fresh PC here causes a race condition where queued ICE
      // candidates get cleared before the offer arrives.
    });

    socket.on('user-left', ({ userId: leftUserId }) => {
      console.log('[WebRTC] Peer left:', leftUserId);
      // Peer intentionally left — clear grace timer and mark disconnected immediately
      if (disconnectGraceRef.current) {
        clearTimeout(disconnectGraceRef.current);
        disconnectGraceRef.current = null;
      }
      setRemoteParticipants(prev => prev.map(p => ({
        ...p,
        isDisconnected: true,
        _lastUpdate: Date.now(),
      })));
    });

    // Mobile: handle visibility changes
    if (isMobile) {
      const handleVisibilityChange = () => {
        if (!document.hidden && !socket.connected) {
          console.log('[WebRTC] App foregrounded, reconnecting signaling');
          socket.connect();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      socket._visibilityHandler = handleVisibilityChange;
    }
  };

  // LiveKit initialization (meetups)
  const initializeLiveKitCall = async () => {
    const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!liveKitUrl) throw new Error('LiveKit URL not configured');

    const { Room, RoomEvent, VideoPresets } = await import('livekit-client');

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
        facingMode: 'user',
      },
      publishDefaults: {
        videoEncoding: {
          maxBitrate: 1_500_000,
          maxFramerate: 24,
        },
        screenShareEncoding: {
          maxBitrate: 2_500_000,
          maxFramerate: 15,
        },
        videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h180],
      },
      // Don't use webAudioMix — Chrome aggressively suspends AudioContexts
      // before remote audio arrives, causing silence. Instead, remote audio
      // is played via manual track.attach() on <audio> elements in RemoteVideo.
      webAudioMix: false,
    });

    roomRef.current = room;

    // Event handlers
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant?.identity) allParticipantIdsRef.current.add(participant.identity);
      updateLiveKitParticipants(room);
    });
    room.on(RoomEvent.ParticipantDisconnected, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackSubscribed, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackUnsubscribed, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackMuted, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.TrackUnmuted, () => updateLiveKitParticipants(room));
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const remoteSpeaker = speakers.find(s => s.identity !== user?.id);
      if (remoteSpeaker) {
        setActiveSpeakerId(remoteSpeaker.identity);
        // Auto-switch from grid to speaker mode on first speech
        if (!autoSwitchedRef.current) {
          autoSwitchedRef.current = true;
          setAutoSwitchedToSpeaker(true);
          setGridView(false);
        }
        clearTimeout(activeSpeakerTimeoutRef.current);
        activeSpeakerTimeoutRef.current = setTimeout(() => {
          setActiveSpeakerId(null);
        }, 3000);
      }
      updateLiveKitParticipants(room);
    });
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
      const uid = String(remoteUser.uid);
      const isScreenClient = uid.endsWith('_screen');
      const isOwnScreenClient = uid === `${agoraUid}_screen`;
      console.log('[Agora] user-published:', uid, mediaType, isScreenClient ? '(screen)' : '');

      // Skip subscribing to our own screen share client
      if (isOwnScreenClient) {
        console.log('[Agora] Skipping own screen client');
        return;
      }

      // In speaker mode with 3+ participants, skip video for non-active speakers
      // Audio is always subscribed; video only for the active speaker
      const inSpeakerMode = !gridViewRef.current && client.remoteUsers.filter(u => !String(u.uid).endsWith('_screen')).length >= 2;
      if (inSpeakerMode && mediaType === 'video' && !isScreenClient) {
        const currentSpeaker = activeSpeakerIdRef.current;
        if (currentSpeaker && uid !== currentSpeaker) {
          console.log('[Agora] Speaker mode: skipping video subscribe for non-speaker', uid);
          updateAgoraParticipants(client);
          return;
        }
      }

      await client.subscribe(remoteUser, mediaType);
      console.log('[Agora] Subscribed to:', uid, 'videoTrack:', !!remoteUser.videoTrack);
      updateAgoraParticipants(client);
    });

    client.on('user-unpublished', (remoteUser, mediaType) => {
      console.log('[Agora] user-unpublished:', remoteUser.uid, mediaType);
      updateAgoraParticipants(client);
    });
    client.on('user-joined', (remoteUser) => {
      console.log('[Agora] user-joined:', remoteUser.uid);
      allParticipantIdsRef.current.add(String(remoteUser.uid));
      updateAgoraParticipants(client);
    });
    client.on('user-left', (remoteUser) => {
      console.log('[Agora] user-left:', remoteUser.uid);
      // Clear speaking state for echo suppression
      if (setRemoteSpeakingRef.current) {
        setRemoteSpeakingRef.current(String(remoteUser.uid), false);
      }
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

    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      {
        encoderConfig: 'speech_standard',
        echoCancellation: true,
        noiseSuppression: true,
      },
      {
        encoderConfig: {
          width: 640,
          height: 480,
          frameRate: 15,
          bitrateMin: 600,
          bitrateMax: 1000,
        }
      }
    );
    await client.publish([audioTrack, videoTrack]);

    setLocalVideoTrack(videoTrack);
    setLocalAudioTrack(audioTrack);

    // Share Agora's mic track with Deepgram transcription so it reuses the same
    // echo-cancelled stream instead of opening a second getUserMedia capture
    setExternalAudioTrack(audioTrack);

    if (localVideoRef.current) {
      videoTrack.play(localVideoRef.current);
    }

    // Enable volume indicator for echo suppression — mutes mic→Deepgram when
    // remote users are speaking to prevent speaker audio from being transcribed
    client.enableAudioVolumeIndicator();
    client.on('volume-indicator', (volumes) => {
      if (!setRemoteSpeakingRef.current) return;
      let loudestUid = null;
      let loudestLevel = 0;
      let anyRemoteSpeaking = false;
      for (const { uid, level } of volumes) {
        const uidStr = String(uid);
        // Skip local user (uid 0 or our own UID)
        if (uid === 0 || uidStr === String(agoraUid)) continue;
        const isSpeaking = level > 5;
        setRemoteSpeakingRef.current(uidStr, isSpeaking);
        // Echo guard uses higher threshold — only block transcripts when remote
        // audio is loud enough to actually leak through speakers into the mic
        if (level > 30) anyRemoteSpeaking = true;
        // Track loudest speaker for active speaker mode
        if (level > loudestLevel && level > 5) {
          loudestLevel = level;
          loudestUid = uidStr;
        }
      }
      // Update active speaker with debounce to avoid flicker
      if (loudestUid) {
        setActiveSpeakerId(loudestUid);
        // Auto-switch from grid to speaker mode on first speech
        if (!autoSwitchedRef.current) {
          autoSwitchedRef.current = true;
          setAutoSwitchedToSpeaker(true);
          setGridView(false);
        }
        clearTimeout(activeSpeakerTimeoutRef.current);
        activeSpeakerTimeoutRef.current = setTimeout(() => {
          setActiveSpeakerId(null);
        }, 3000);
      }
    });

    // Pre-load blur processor in background so it's instant when user clicks
    preloadAgoraBlur();
  };

  // Helper to get participant name from roomParticipants by UID
  // Uses ref to avoid stale closure issues in event handlers
  // Cache for names fetched directly from DB
  const nameCache = useRef({});

  const getParticipantName = (uid) => {
    const uidStr = String(uid);
    const participants = roomParticipantsRef.current;

    // Try to find by exact ID match in room participants
    const participant = participants?.find(p => p.id === uidStr);
    if (participant?.name) return participant.name;

    // Check cache from direct DB lookups
    if (nameCache.current[uidStr]) return nameCache.current[uidStr];

    // If it looks like a UUID and we don't have the name, fetch it
    if (uidStr.length > 8 && uidStr.includes('-')) {
      supabase.from('profiles').select('name').eq('id', uidStr).single().then(({ data }) => {
        if (data?.name) {
          nameCache.current[uidStr] = data.name;
          // Trigger re-render of participants
          if (config?.provider === 'agora' && agoraClientRef.current) {
            updateAgoraParticipants(agoraClientRef.current);
          } else if (config?.provider === 'livekit' && roomRef.current) {
            updateLiveKitParticipants(roomRef.current);
          }
        }
      });
    }

    // Fallback
    return uidStr.length > 8 ? `User ${uidStr.slice(0, 8)}...` : `User ${uidStr}`;
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

  // Adaptive bitrate quality monitor — adjusts video encoding based on network stats
  const qualityTiers = [
    { label: 'high',   maxBitrate: 1_500_000, scaleDown: 1,   minRtt: 0,    maxRtt: 0.15, maxLoss: 2  },
    { label: 'medium', maxBitrate: 800_000,   scaleDown: 1.5, minRtt: 0.15, maxRtt: 0.3,  maxLoss: 5  },
    { label: 'low',    maxBitrate: 400_000,   scaleDown: 2,   minRtt: 0.3,  maxRtt: 0.5,  maxLoss: 10 },
    { label: 'very-low', maxBitrate: 200_000, scaleDown: 4,   minRtt: 0.5,  maxRtt: Infinity, maxLoss: Infinity },
  ];

  const startQualityMonitor = (pc) => {
    if (qualityMonitorRef.current) clearInterval(qualityMonitorRef.current);
    let currentTierIdx = 0;

    qualityMonitorRef.current = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;
      try {
        const stats = await pc.getStats();
        let rtt = null;
        let packetLoss = null;

        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const prev = prevStatsRef.current;
            if (prev && prev.packetsSent !== undefined) {
              const packetsSent = report.packetsSent - prev.packetsSent;
              const nackCount = (report.nackCount || 0) - (prev.nackCount || 0);
              if (packetsSent > 0) {
                packetLoss = (nackCount / packetsSent) * 100;
              }
            }
            prevStatsRef.current = { packetsSent: report.packetsSent, nackCount: report.nackCount || 0 };
          }
        });

        if (rtt === null) return;

        // Determine target tier based on network conditions
        let targetIdx = 0;
        for (let i = 0; i < qualityTiers.length; i++) {
          if (rtt >= qualityTiers[i].minRtt || (packetLoss !== null && packetLoss > qualityTiers[i].maxLoss)) {
            targetIdx = i;
          }
        }

        // Only change tier if it's different (with hysteresis: go down immediately, go up after sustained improvement)
        if (targetIdx > currentTierIdx) {
          // Downgrade immediately
          currentTierIdx = targetIdx;
        } else if (targetIdx < currentTierIdx) {
          // Upgrade one step at a time
          currentTierIdx = currentTierIdx - 1;
        } else {
          return; // No change needed
        }

        const tier = qualityTiers[currentTierIdx];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (!sender) return;

        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) return;
        params.encodings[0].maxBitrate = tier.maxBitrate;
        params.encodings[0].scaleResolutionDownBy = tier.scaleDown;
        await sender.setParameters(params);
        console.log(`[WebRTC] Quality: ${tier.label} (bitrate: ${tier.maxBitrate/1000}kbps, scale: 1/${tier.scaleDown}, rtt: ${rtt?.toFixed(3)}s, loss: ${packetLoss?.toFixed(1)}%)`);
      } catch (e) {
        // Stats collection can fail if connection is closing
      }
    }, 3000);
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
            iceCandidateQueueRef.current = [];
            return;
          }
          if (offerCollision) {
            console.log('[WebRTC] Polite peer rolling back to accept offer');
            await pc.setLocalDescription({ type: 'rollback' });
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          } catch (sdpError) {
            // m-line mismatch — stale PC from previous session. Recreate and retry.
            console.log('[WebRTC] SDP error, recreating peer connection:', sdpError.message);
            pc = createPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          }
          await flushIceCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalingSocketRef.current?.emit('answer', {
            answer: pc.localDescription,
            to: remotePeerIdRef.current,
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
      // Always use iceRestart on re-offers to preserve m-line order and refresh candidates
      const isReoffer = pc.remoteDescription !== null;
      const offer = await pc.createOffer({ iceRestart: isReoffer });
      if (isReoffer) console.log('[WebRTC] Re-offer with ICE restart');
      await pc.setLocalDescription(offer);
      signalingSocketRef.current?.emit('offer', {
        offer: pc.localDescription,
        to: remotePeerIdRef.current,
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

  // Host controls channel — broadcast mute-all / video-off commands
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  isMutedRef.current = isMuted;
  isVideoOffRef.current = isVideoOff;

  useEffect(() => {
    if (!isJoined || !roomId || callType === 'coffee') return;

    const channel = supabase.channel(`host-controls-${roomId}`);
    channel.on('broadcast', { event: 'host-command' }, ({ payload }) => {
      if (payload?.from === user?.id) return;
      if (payload?.command === 'mute-all' && !isMutedRef.current) {
        handleToggleMuteRef.current?.();
      } else if (payload?.command === 'unmute-all' && isMutedRef.current) {
        handleToggleMuteRef.current?.();
      } else if (payload?.command === 'video-off-all' && !isVideoOffRef.current) {
        handleToggleVideoRef.current?.();
      } else if (payload?.command === 'video-on-all' && isVideoOffRef.current) {
        handleToggleVideoRef.current?.();
      } else if (payload?.command === 'set-language' && payload?.language) {
        handleLanguageChange(payload.language);
      }
    }).subscribe();

    hostChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isJoined, roomId, callType, user?.id]);

  const handleMuteAll = () => {
    hostChannelRef.current?.send({
      type: 'broadcast', event: 'host-command',
      payload: { command: 'mute-all', from: user?.id },
    });
    if (!isMuted) handleToggleMute();
  };

  const handleUnmuteAll = () => {
    hostChannelRef.current?.send({
      type: 'broadcast', event: 'host-command',
      payload: { command: 'unmute-all', from: user?.id },
    });
    if (isMuted) handleToggleMute();
  };

  const handleVideoOffAll = () => {
    hostChannelRef.current?.send({
      type: 'broadcast', event: 'host-command',
      payload: { command: 'video-off-all', from: user?.id },
    });
    if (!isVideoOff) handleToggleVideo();
  };

  const handleVideoOnAll = () => {
    hostChannelRef.current?.send({
      type: 'broadcast', event: 'host-command',
      payload: { command: 'video-on-all', from: user?.id },
    });
    if (isVideoOff) handleToggleVideo();
  };

  const handleSetLanguageAll = (language) => {
    hostChannelRef.current?.send({
      type: 'broadcast', event: 'host-command',
      payload: { command: 'set-language', language, from: user?.id },
    });
    handleLanguageChange(language);
  };

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
        const newAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          microphoneId: deviceId,
          encoderConfig: 'speech_standard',
          echoCancellation: true,
          noiseSuppression: true,
        });
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
        } else if (config.provider === 'webrtc') {
          // Restore camera track on the video sender
          if (screenTrackRef.current) {
            screenTrackRef.current.stop();
            screenTrackRef.current = null;
          }
          const pc = peerConnectionRef.current;
          if (pc && localVideoTrack instanceof MediaStream) {
            const cameraTrack = localVideoTrack.getVideoTracks()[0];
            if (cameraTrack) {
              const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
              if (videoSender) {
                await videoSender.replaceTrack(cameraTrack);
              }
            }
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

          // Clean up any leftover screen client from a previous session
          if (agoraScreenClientRef.current) {
            try {
              await agoraScreenClientRef.current.leave();
            } catch (e) { /* ignore */ }
            agoraScreenClientRef.current = null;
          }

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
        } else if (config.provider === 'webrtc') {
          // WebRTC — replace the video sender's track with the screen track
          const pc = peerConnectionRef.current;
          if (pc) {
            const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(screenVideoTrack);
            }
          }
          screenTrackRef.current = screenVideoTrack;
          setLocalScreenTrack(screenStream);
        }

        setIsScreenSharing(true);

        // Handle user stopping via browser UI (e.g. clicking "Stop sharing" in the browser)
        screenVideoTrack.onended = async () => {
          console.log('[UnifiedCall] Screen share ended via browser UI');
          // Clean up directly instead of toggling (avoids stale closure issues)
          if (config.provider === 'agora' && agoraScreenClientRef.current) {
            try {
              if (screenTrackRef.current) {
                try { await agoraScreenClientRef.current.unpublish([screenTrackRef.current]); } catch (e) { /* already ended */ }
                try { screenTrackRef.current.close(); } catch (e) { /* already closed */ }
                screenTrackRef.current = null;
              }
              await agoraScreenClientRef.current.leave();
            } catch (e) {
              console.log('[UnifiedCall] Screen client cleanup:', e.message);
            }
            agoraScreenClientRef.current = null;
          } else if (config.provider === 'livekit' && screenTrackRef.current) {
            try {
              await roomRef.current?.localParticipant.unpublishTrack(screenTrackRef.current);
              screenTrackRef.current.stop();
            } catch (e) { /* already ended */ }
            screenTrackRef.current = null;
          } else if (config.provider === 'webrtc') {
            // Restore camera track
            screenTrackRef.current = null;
            const pc = peerConnectionRef.current;
            if (pc && localVideoTrack instanceof MediaStream) {
              const cameraTrack = localVideoTrack.getVideoTracks()[0];
              if (cameraTrack) {
                const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender) {
                  try { await videoSender.replaceTrack(cameraTrack); } catch (e) { /* ignore */ }
                }
              }
            }
          }
          setIsScreenSharing(false);
          setLocalScreenTrack(null);
        };
      }
    } catch (error) {
      console.error('[UnifiedCall] Screen share error:', error);
      if (!error.message?.includes('Permission denied') && !error.message?.includes('cancelled')) {
        alert('Failed to share screen: ' + error.message);
      }
    }
  };

  // Stop screen share handler (for ScreenShareView)
  const handleStopScreenShare = () => {
    handleToggleScreenShare();
  };

  const toggleTranscription = useCallback(async () => {
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
      // Stop consent-tracked transcription
      transcriptStoppedRef.current = true;
      stopConsentTranscription();
    } else {
      // Go through consent flow
      transcriptStoppedRef.current = false;
      const consentGranted = await requestConsent();
      if (!consentGranted) return;

      // For host mode, consent is immediate — start transcription
      if (config?.consentMode === 'host') {
        const started = startListening();
        if (started) setIsTranscribing(true);
      }
      // For mutual mode, transcription starts when consent-response arrives (see effect below)
    }
  }, [isTranscribing, startListening, stopListening, requestConsent, stopConsentTranscription, config?.consentMode]);

  // Track whether user intentionally stopped transcription (prevents auto-restart)
  const transcriptStoppedRef = useRef(false);

  // Start transcription when mutual consent is accepted (only on consent transition, not restarts)
  const prevConsentStatusRef = useRef(null);
  useEffect(() => {
    const justAccepted = consentStatus === 'accepted' && prevConsentStatusRef.current !== 'accepted';
    prevConsentStatusRef.current = consentStatus;

    if (justAccepted && !isTranscribing && !transcriptStoppedRef.current && config?.consentMode === 'mutual') {
      const started = startListening();
      if (started) setIsTranscribing(true);
    }
  }, [consentStatus, isTranscribing, startListening, config?.consentMode]);

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

    // Clear external audio track so Deepgram doesn't hold a stale reference
    setExternalAudioTrack(null);

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
    if (activeSpeakerTimeoutRef.current) {
      clearTimeout(activeSpeakerTimeoutRef.current);
      activeSpeakerTimeoutRef.current = null;
    }
    if (echoGuardTimeoutRef.current) {
      clearTimeout(echoGuardTimeoutRef.current);
      echoGuardTimeoutRef.current = null;
    }
    remoteSpeakingActiveRef.current = false;
    if (qualityMonitorRef.current) {
      clearInterval(qualityMonitorRef.current);
      qualityMonitorRef.current = null;
    }
    if (disconnectGraceRef.current) {
      clearTimeout(disconnectGraceRef.current);
      disconnectGraceRef.current = null;
    }
    if (config?.provider === 'webrtc') {
      if (localVideoTrack instanceof MediaStream) {
        localVideoTrack.getTracks().forEach(t => t.stop());
      }
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      if (signalingSocketRef.current) {
        if (signalingSocketRef.current._visibilityHandler) {
          document.removeEventListener('visibilitychange', signalingSocketRef.current._visibilityHandler);
        }
        signalingSocketRef.current.removeAllListeners();
        signalingSocketRef.current.disconnect();
        signalingSocketRef.current = null;
      }
      remotePeerIdRef.current = null;
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

  // Handle leave call — save transcript, generate AI recap only if last person
  const handleLeaveCall = async () => {
    // Step 1: Show "Ending call..." transition immediately
    setIsLeaving(true);

    // Write leave signal for live call detection
    const leaveRoomId = roomId?.includes('-') && roomId.split('-').length > 5
      ? roomId.replace(/^[a-z]+-/, '')
      : roomId;
    supabase.from('video_signals').insert({
      room_id: leaveRoomId,
      channel_name: roomId,
      sender_id: user?.id,
      type: 'leave',
      data: {},
    }).then(({ error }) => {
      if (error) console.warn('[UnifiedCall] Failed to write leave signal:', error);
    });

    // Capture state before cleanup
    // Use allParticipantIdsRef for complete list of everyone who ever joined
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    allParticipantIdsRef.current.add(user?.id); // Add self
    const participantIds = [...allParticipantIdsRef.current].filter(id => id && uuidRegex.test(id));
    const isLastPerson = remoteParticipants.length === 0;
    const currentTranscript = [...transcript];
    const currentMessages = [...messages];
    const startTime = callStartTimeRef.current || callStartTime;
    const endTime = new Date().toISOString();

    // Step 2: End room and cleanup video call
    await endRoom();
    await leaveCall();

    // Step 2b: Mark coffee chat as completed only if the call actually connected
    // and this is the last person leaving. If call never connected, keep 'accepted'
    // so the user can retry. Stale chats are auto-abandoned by cron after 2 hours.
    if (callType === 'coffee') {
      const chatId = roomId?.startsWith('coffee-') ? roomId.replace('coffee-', '') : roomId;
      const callConnected = participantIds.length > 1;
      if (isLastPerson && callConnected) {
        try {
          await completeCoffeeChat(supabase, chatId);
        } catch (e) {
          console.warn('[UnifiedCall] Failed to mark coffee chat completed:', e.message);
        }
      }
    }

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

    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 4: Fetch participant profiles
    let allParticipants = [];
    if (participantIds.length > 0) {
      const [{ data: profiles }, { data: mutualMatches }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, profile_picture, career')
          .in('id', participantIds),
        supabase.rpc('get_mutual_matches', { for_user_id: user?.id }),
      ]);
      const connectedIds = new Set((mutualMatches || []).map(m => m.matched_user_id));
      allParticipants = (profiles || []).map(p => ({
        ...p,
        connected: connectedIds.has(p.id),
      }));
    }

    // Get scheduled meeting info for duration clamping
    const schedDate = relatedData?.date || relatedData?.meetupDate || null;
    const schedTime = relatedData?.time || relatedData?.meetupTime || null;
    const schedDuration = relatedData?.duration || relatedData?.meetupDuration || null;

    // Step 5: Save this user's transcript to the recap
    let savedRecap = null;
    try {
      savedRecap = await saveCallRecap({
        channelName: roomId,
        callType: config.internalType,
        provider: config.provider,
        startedAt: startTime,
        endedAt: endTime,
        participants: allParticipants,
        transcript: currentTranscript,
        aiSummary: null,  // null = don't overwrite existing summary
        metrics: {},
        userId: user?.id,
        scheduledDate: schedDate,
        scheduledTime: schedTime,
        scheduledDuration: schedDuration,
      });
      console.log('[UnifiedCall] Transcript saved to database');
    } catch (saveErr) {
      console.error('[UnifiedCall] Failed to save transcript:', saveErr);
    }

    // Step 5b: Delete consent row AFTER recap save (ordering matters)
    await deleteConsentRow();

    // Step 6: Show recap screen immediately, generate AI summary in background
    const callDuration = startTime && endTime ? Math.floor((new Date(endTime) - new Date(startTime)) / 1000) : 0;

    setRecapData({
      startedAt: startTime,
      endedAt: endTime,
      duration: callDuration,
      participants: allParticipants,
    });

    // If recap already has an AI summary (generated recently), use it immediately
    if (savedRecap?.ai_summary) {
      try {
        setAiSummary(JSON.parse(savedRecap.ai_summary));
      } catch { /* ignore parse error */ }
    } else {
      setLoadingSummary(true);
    }

    setShowRecap(true);
    setIsLeaving(false);

    // Generate AI recap in background if needed
    // Regenerate if this user contributed new transcript content, even if a summary
    // already exists — the previous summary may be based on partial data (e.g. only
    // the first user's transcript). Skip only if this user had no new content.
    const hasNewContent = currentTranscript.length > 0 || currentMessages.length > 0;
    const summaryExistsAndNoNewContent = savedRecap?.ai_summary && !hasNewContent;

    if (hasNewContent && !summaryExistsAndNoNewContent) {
      console.log('[UnifiedCall] Generating AI recap in background...');

      // Fetch combined transcript from ALL sessions (no time filter)
      // so multi-session meetings (disconnect + reconnect) get a complete recap
      let combinedTranscript = currentTranscript;
      try {
        const { data: dbTranscripts } = await supabase
          .from('call_transcripts')
          .select('speaker_name, text, timestamp, user_id')
          .eq('channel_name', roomId)
          .order('timestamp', { ascending: true });

        if (dbTranscripts && dbTranscripts.length > 0) {
          combinedTranscript = dbTranscripts.map(t => ({
            speakerName: t.speaker_name || 'Speaker',
            text: t.text,
            timestamp: t.timestamp,
            speakerId: t.user_id
          }));
          console.log('[UnifiedCall] Combined transcript from all participants:', combinedTranscript.length, 'entries');
        }
      } catch (fetchErr) {
        console.warn('[UnifiedCall] Failed to fetch combined transcript, using local:', fetchErr);
      }

      // Generate AI summary and save via server API (bypasses RLS)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/generate-recap-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            transcript: combinedTranscript,
            messages: currentMessages,
            participants: allParticipants.map(p => p.name || p.email?.split('@')[0]),
            duration: callDuration,
            meetingTitle: relatedData?.topic || relatedData?.name || config.ui.title,
            meetingType: callType === 'coffee' ? '1:1 coffee chat' : callType === 'meetup' ? 'group meetup' : 'circle meeting'
          })
        });

        if (response.ok) {
          const summaryData = await response.json();
          setAiSummary(summaryData);
          setLoadingSummary(false);

          // Persist to database
          const recapId = savedRecap?.id;
          if (recapId) {
            const aiSummaryJson = JSON.stringify(summaryData);
            fetch('/api/save-recap-summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({ recapId, aiSummary: aiSummaryJson })
            }).then(() => console.log('[UnifiedCall] AI recap saved to database'))
              .catch(err => console.error('[UnifiedCall] Failed to save AI recap:', err));
          }
        } else {
          setLoadingSummary(false);
        }
      } catch (err) {
        console.error('[UnifiedCall] Failed to generate AI summary:', err);
        setLoadingSummary(false);
      }

      // Keep call_transcripts as permanent source of truth.
      // Other participants may still need them for their own recap generation,
      // and they serve as a backup if recap data needs to be rebuilt.
    } else {
      setLoadingSummary(false);
      if (summaryExistsAndNoNewContent) {
        console.log('[UnifiedCall] AI recap exists and no new transcript from this user — skipping regeneration');
      }
    }
  };

  const handleRecapClose = () => {
    // Navigate directly without setting showRecap to false
    // This prevents the video call UI from briefly showing during navigation
    router.push('/home');
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
          onScheduleFollowUp={() => router.push('/home')}
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
            onClick={() => router.push('/home')}
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
      if (!isJoined) return 'Connecting...';
      const partnerName = relatedData?.partner_name || 'Partner';
      const hasRemote = remoteParticipants.length > 0;
      const partnerDisconnected = remoteParticipants.some(p => p.isDisconnected);
      if (partnerDisconnected) return `${partnerName} disconnected`;
      if (!hasRemote) return `Waiting for ${partnerName} to join...`;
      return `Connected with ${partnerName}`;
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
        onToggleView={() => { setGridView(!gridView); autoSwitchedRef.current = true; }}
        meetingId={roomId}
        callDuration={callDuration}
        connectionQuality={connectionQuality}
        showTopics={showTopics}
        onToggleTopics={(config?.features.topics || config?.features.icebreakers) ? () => {
          setShowTopics(!showTopics);
          if (!showTopics) setActiveTab('topics');
        } : undefined}
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
      <div className={`flex-1 p-2 sm:p-3 relative transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''} flex justify-center`} style={{ minHeight: 0 }}>
      <div className="w-full h-full" style={{ maxWidth: '1200px' }}>
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
            activeSpeakerId={activeSpeakerId}
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

        {/* Transcript Consent Modal */}
        <TranscriptConsentModal
          requesterName={consentRequester}
          onAccept={() => respondToConsent(true)}
          onDecline={() => respondToConsent(false)}
          isVisible={consentStatus === 'incoming'}
        />

        {/* Transcript Consent Indicator */}
        <TranscriptIndicator
          status={consentStatus}
          mode={config?.consentMode || 'host'}
          onStop={() => {
            transcriptStoppedRef.current = true;
            stopListening();
            setIsTranscribing(false);
            stopConsentTranscription();
          }}
          isHost={callType !== 'coffee'}
        />

        {/* Transcript Overlay */}
        <TranscriptOverlay
          transcript={transcript}
          isTranscribing={isTranscribing}
          interimText={interimText}
          speakerName={user?.name || 'You'}
        />
      </div>
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
          consentStatus={consentStatus}
          consentMode={config?.consentMode}
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
              {/* Discussion Topics */}
              <div className="p-3.5 flex flex-col gap-2.5">
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: '#D4A574', letterSpacing: '1.2px' }}
                >
                  Suggested Topics
                </span>
                {!discussionTopics ? (
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212,165,116,0.15) 0%, rgba(139,94,60,0.12) 100%)',
                      border: '1px solid rgba(212,165,116,0.25)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span style={{ color: '#D4A574' }} className="text-sm">Loading topics...</span>
                    </div>
                  </div>
                ) : discussionTopics.length > 0 ? (
                  discussionTopics.map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-3 items-start rounded-xl p-3"
                      style={{
                        background: 'rgba(245,237,228,0.06)',
                        border: '1px solid rgba(245,237,228,0.05)',
                      }}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{item.emoji || '💡'}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: '#F5EDE4', margin: 0, lineHeight: 1.4 }}
                        >
                          {item.topic}
                        </p>
                        {item.reason && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: 'rgba(245,237,228,0.45)', margin: 0, lineHeight: 1.4 }}
                          >
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm" style={{ color: 'rgba(245,237,228,0.5)' }}>
                    No topics available for this event.
                  </p>
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
              isHost={isHost}
              onMuteAll={handleMuteAll}
              onUnmuteAll={handleUnmuteAll}
              onVideoOffAll={handleVideoOffAll}
              onVideoOnAll={handleVideoOnAll}
              transcriptionLanguage={transcriptionLanguage}
              onSetLanguageAll={handleSetLanguageAll}
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
