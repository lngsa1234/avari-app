'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCallTypeConfig, isValidCallType } from '@/lib/video/callTypeConfig';
import { useCallRoom } from '@/hooks/useCallRoom';
import { useRecording } from '@/hooks/useRecording';
import useTranscription from '@/hooks/useTranscription';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
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

// Topic suggestions for meetups
const TOPIC_SUGGESTIONS = {
  advice: [
    "What's the best career advice you've received?",
    "How do you handle difficult conversations at work?",
    "What strategies help you with work-life balance?",
  ],
  vent: [
    "What's been challenging for you lately?",
    "How do you decompress after a tough day?",
    "What support do you wish you had more of?",
  ],
  grow: [
    "What are you currently learning or developing?",
    "What's a skill you'd like to master this year?",
    "How do you approach professional development?",
  ],
  general: [
    "What brought you to this industry?",
    "What's your proudest professional achievement?",
    "How do you approach networking authentically?",
  ]
};

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
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);

  // Control state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [isLocalMain, setIsLocalMain] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('en-US');
  const [pendingLanguageRestart, setPendingLanguageRestart] = useState(false);

  // Topics state (for meetups)
  const [currentTopic, setCurrentTopic] = useState(null);
  const [usedTopicIndices, setUsedTopicIndices] = useState(new Set());
  const [userVibeCategory, setUserVibeCategory] = useState('general');

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

  // Provider-specific refs
  const roomRef = useRef(null); // LiveKit room
  const peerConnectionRef = useRef(null); // WebRTC
  const realtimeChannelRef = useRef(null); // Supabase channel
  const agoraClientRef = useRef(null); // Agora client
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
    toggleBlur: toggleBlurHook
  } = useBackgroundBlur(config?.provider || 'webrtc');

  // Transcription handler
  const handleTranscript = useCallback(({ text, isFinal, timestamp }) => {
    if (isFinal && text.trim()) {
      const entry = {
        speakerId: user?.id || 'local',
        speakerName: user?.name || 'You',
        text: text.trim(),
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
        }).catch(e => console.error('Failed to save transcript:', e));
      }
    }
  }, [user, roomId]);

  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    isSafari,
    error: speechError,
    startListening,
    stopListening
  } = useTranscription({
    onTranscript: handleTranscript,
    language: transcriptionLanguage,
    continuous: true,
    interimResults: false
  });

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

  // Initialize call when user is ready
  useEffect(() => {
    if (user && config && !hasInitialized.current && !isInitializing.current) {
      initializeCall();
    }

    return () => {
      if (hasInitialized.current) {
        leaveCall();
      }
    };
  }, [user, config]);

  // Load messages
  useEffect(() => {
    if (!roomId || !user) return;

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

    // Subscribe to new messages
    const channel = supabase
      .channel(`call-messages-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_messages',
        filter: `channel_name=eq.${roomId}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  // Load user vibe category for topics
  useEffect(() => {
    if (user?.id && config?.features.topics) {
      supabase
        .from('profiles')
        .select('vibe_category')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.vibe_category) {
            setUserVibeCategory(data.vibe_category);
          }
        });
    }
  }, [user?.id, config?.features.topics]);

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

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteParticipants([{
          id: 'remote',
          name: relatedData?.partner_name || 'Partner',
          videoTrack: event.streams[0].getVideoTracks()[0],
          audioTrack: event.streams[0].getAudioTracks()[0],
          hasVideo: event.streams[0].getVideoTracks().length > 0,
          hasAudio: event.streams[0].getAudioTracks().length > 0,
        }]);
      }
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

    // Setup signaling channel
    const channel = supabase.channel(`meeting:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleWebRTCSignal(payload, pc);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setTimeout(() => createWebRTCOffer(pc), 1000);
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
      await client.subscribe(remoteUser, mediaType);
      updateAgoraParticipants(client);
    });

    client.on('user-unpublished', () => updateAgoraParticipants(client));
    client.on('user-joined', () => updateAgoraParticipants(client));
    client.on('user-left', () => updateAgoraParticipants(client));

    // Generate numeric UID from user ID
    const numericUid = Math.abs(user.id.split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0));

    await client.join(appId, roomId, null, numericUid);

    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
    await client.publish([audioTrack, videoTrack]);

    setLocalVideoTrack(videoTrack);
    setLocalAudioTrack(audioTrack);

    if (localVideoRef.current) {
      videoTrack.play(localVideoRef.current);
    }
  };

  // Update LiveKit participants
  const updateLiveKitParticipants = (room) => {
    if (!room || room.state === 'disconnected') return;

    const participants = Array.from(room.remoteParticipants.values()).map(p => {
      const videoPublication = p.getTrackPublication('camera');
      const audioPublication = p.getTrackPublication('microphone');
      const screenPublication = p.getTrackPublication('screen_share');

      return {
        id: p.identity,
        name: p.name || p.identity,
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
  };

  // Update Agora participants
  const updateAgoraParticipants = (client) => {
    if (!client) return;

    const participants = client.remoteUsers.map(u => ({
      id: u.uid,
      uid: u.uid,
      name: `User ${u.uid}`,
      videoTrack: u.videoTrack,
      audioTrack: u.audioTrack,
      hasVideo: !!u.videoTrack,
      hasAudio: !!u.audioTrack,
      _videoEnabled: u._videoEnabled !== false,
      _lastUpdate: Date.now(),
    }));

    setRemoteParticipants(participants);
  };

  // WebRTC signaling handlers
  const handleWebRTCSignal = async (signal, pc) => {
    try {
      switch (signal.type) {
        case 'offer':
          if (pc.signalingState !== 'stable') return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          realtimeChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', answer: pc.localDescription }
          });
          break;

        case 'answer':
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
          }
          break;

        case 'ice-candidate':
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          break;
      }
    } catch (error) {
      console.error('[WebRTC] Signal error:', error);
    }
  };

  const createWebRTCOffer = async (pc) => {
    if (!pc || pc.signalingState !== 'stable') return;
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
    if (localVideoTrack) {
      await toggleBlurHook(localVideoTrack);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop sharing
        if (config.provider === 'livekit' && screenTrackRef.current) {
          await roomRef.current?.localParticipant.unpublishTrack(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        } else if (config.provider === 'agora' && agoraClientRef.current && screenTrackRef.current) {
          await agoraClientRef.current.unpublish([screenTrackRef.current]);
          screenTrackRef.current.close();
          screenTrackRef.current = null;
        }
        setIsScreenSharing(false);
      } else {
        // Start sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        if (config.provider === 'livekit') {
          const { LocalVideoTrack, Track } = await import('livekit-client');
          const screenTrack = new LocalVideoTrack(screenStream.getVideoTracks()[0]);
          screenTrackRef.current = screenTrack;
          await roomRef.current?.localParticipant.publishTrack(screenTrack, {
            name: 'screen',
            source: Track.Source.ScreenShare
          });
        } else if (config.provider === 'agora') {
          const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
          const screenTrack = AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: screenStream.getVideoTracks()[0]
          });
          screenTrackRef.current = screenTrack;
          await agoraClientRef.current?.publish([screenTrack]);
        }

        setIsScreenSharing(true);

        // Handle user stopping via browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };
      }
    } catch (error) {
      console.error('[UnifiedCall] Screen share error:', error);
      alert('Failed to share screen: ' + error.message);
    }
  };

  const toggleTranscription = useCallback(() => {
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
    } else {
      const started = startListening();
      if (started) setIsTranscribing(true);
    }
  }, [isTranscribing, startListening, stopListening]);

  // Shuffle topic (for meetups)
  const shuffleTopic = useCallback(() => {
    const topics = TOPIC_SUGGESTIONS[userVibeCategory] || TOPIC_SUGGESTIONS.general;
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
  }, [userVibeCategory, usedTopicIndices]);

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
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
    }

    if (isRecording) {
      stopRecording();
    }

    // Cleanup based on provider
    if (config?.provider === 'webrtc') {
      if (localVideoTrack instanceof MediaStream) {
        localVideoTrack.getTracks().forEach(t => t.stop());
      }
      peerConnectionRef.current?.close();
      realtimeChannelRef.current?.unsubscribe();
    } else if (config?.provider === 'livekit') {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      await roomRef.current?.disconnect();
      roomRef.current = null;
    } else if (config?.provider === 'agora') {
      if (localVideoTrack?.close) localVideoTrack.close();
      if (localAudioTrack?.close) localAudioTrack.close();
      await agoraClientRef.current?.leave();
      agoraClientRef.current = null;
    }

    hasInitialized.current = false;
    isInitializing.current = false;
    setIsJoined(false);
  };

  // Handle leave call and show recap
  const handleLeaveCall = async () => {
    const participantIds = [user?.id, ...remoteParticipants.map(p => p.id)].filter(Boolean);

    await endRoom();
    await leaveCall();

    // Get profiles for recap
    let allParticipants = [];
    if (participantIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, profile_picture, career')
        .in('id', participantIds);
      allParticipants = profiles || [];
    }

    const endTime = new Date().toISOString();
    const startTime = callStartTimeRef.current || callStartTime;

    setRecapData({
      channelName: roomId,
      callType: config.internalType,
      provider: config.provider,
      startedAt: startTime,
      endedAt: endTime,
      duration: startTime && endTime ? Math.floor((new Date(endTime) - new Date(startTime)) / 1000) : 0,
      participants: allParticipants,
      transcript,
      messages,
    });
    setShowRecap(true);

    // Generate AI summary
    setLoadingSummary(true);
    try {
      const duration = startTime && endTime ? Math.floor((new Date(endTime) - new Date(startTime)) / 1000) : 0;
      const response = await fetch('/api/generate-recap-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          messages,
          participants: allParticipants.map(p => p.name || p.email?.split('@')[0]),
          duration,
          meetingTitle: relatedData?.topic || relatedData?.name || config.ui.title,
          meetingType: callType === 'coffee' ? '1:1 coffee chat' : callType === 'meetup' ? 'group meetup' : 'circle meeting'
        })
      });

      if (response.ok) {
        const summaryData = await response.json();
        setAiSummary(summaryData);
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRecapClose = () => {
    setShowRecap(false);
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
        />
      </div>
    );
  }

  // Invalid call type
  if (!config) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
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
      return relatedData.name;
    }
    return isJoined ? 'Connected' : 'Connecting...';
  };

  return (
    <div className="h-screen bg-stone-900 flex flex-col overflow-hidden">
      {/* Agora global styles */}
      {config.provider === 'agora' && (
        <style jsx global>{`
          [class*="agora_video"] video,
          div[id*="video"] video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}</style>
      )}

      {/* Header */}
      <VideoHeader
        title={config.ui.title}
        brandName={config.ui.brandName}
        subtitle={getSubtitle()}
        emoji={config.ui.emoji}
        gradient={config.ui.gradient}
        participantCount={participantCount}
        providerBadge={config.provider === 'livekit' ? 'LiveKit' : undefined}
        isConnecting={isConnecting}
        isTranscribing={isTranscribing && callType === 'coffee'}
        gridView={gridView}
        showGridToggle={remoteParticipants.length > 0}
        onToggleView={() => setGridView(!gridView)}
        onLeave={handleLeaveCall}
      />

      {/* Video Area */}
      <div className={`flex-1 p-3 relative overflow-hidden transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`} style={{ minHeight: 0 }}>
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
          />
        )}

        {/* Transcript Overlay */}
        <TranscriptOverlay
          transcript={transcript}
          isTranscribing={isTranscribing}
        />
      </div>

      {/* Controls */}
      <div className={`transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`}>
        <ControlBar
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isBlurEnabled={isBlurEnabled}
          isBlurSupported={isBlurSupported}
          isBlurLoading={blurLoading}
          isScreenSharing={isScreenSharing}
          isRecording={isRecording}
          recordingTime={recordingTime}
          isTranscribing={isTranscribing}
          isSpeechSupported={isSpeechSupported}
          isSafari={isSafari}
          showChat={showChat}
          showTopics={showTopics}
          showParticipants={showParticipants}
          messagesCount={messages.length}
          transcriptionLanguage={transcriptionLanguage}
          features={config.features}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleBlur={handleToggleBlur}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleRecording={() => isRecording ? stopRecording() : startRecording()}
          onToggleTranscription={toggleTranscription}
          onToggleChat={() => {
            setShowChat(!showChat);
            if (!showChat) setActiveTab('messages');
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

      {/* Sidebar */}
      {showSidebar && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-stone-800 border-l border-stone-700 flex flex-col z-50">
          {/* Sidebar Header */}
          <div className="border-b border-stone-700">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-white font-semibold">
                {enabledPanels.length > 1 ? 'Meeting Panel' :
                  showChat ? 'Chat' :
                  showTopics ? 'Topics' : 'Participants'}
              </h3>
              <button
                onClick={() => {
                  setShowChat(false);
                  setShowTopics(false);
                  setShowParticipants(false);
                }}
                className="text-stone-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            {enabledPanels.length > 1 && (
              <div className="flex">
                {showChat && (
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'messages' ? 'text-amber-400' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    💬 Messages
                    {activeTab === 'messages' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
                  </button>
                )}
                {showTopics && (
                  <button
                    onClick={() => setActiveTab('topics')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'topics' ? 'text-amber-400' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    💡 Topics
                    {activeTab === 'topics' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
                  </button>
                )}
                {showParticipants && (
                  <button
                    onClick={() => setActiveTab('participants')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'participants' ? 'text-amber-400' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    👥 People
                    {activeTab === 'participants' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
                  </button>
                )}
              </div>
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
              accentColor={config.ui.accentColor}
            />
          )}

          {/* Topics Content */}
          {showTopics && (enabledPanels.length === 1 || activeTab === 'topics') && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Topic Card */}
              <div className="p-4 border-b border-stone-700">
                <div className="bg-gradient-to-r from-amber-800/30 to-amber-700/20 rounded-xl p-4 border border-amber-600/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-1">
                        Current Topic
                      </p>
                      <p className="text-white font-medium leading-relaxed">
                        {currentTopic || 'Click shuffle to get a conversation starter!'}
                      </p>
                    </div>
                    <button
                      onClick={shuffleTopic}
                      className="p-2 bg-amber-700 hover:bg-amber-600 rounded-lg transition-all hover:scale-105"
                      title="Shuffle topic"
                    >
                      <span className="text-white text-lg">🔀</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Transcript */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-amber-400 animate-pulse' : 'bg-stone-500'}`} />
                    <span className="text-stone-300 text-sm font-medium">Live Transcript</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {transcript.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-3 block">🎤</span>
                      <p className="text-stone-400 text-sm">
                        {isTranscribing ? 'Listening... Start speaking!' : 'Transcript will appear when you speak'}
                      </p>
                    </div>
                  ) : (
                    transcript.map((entry, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-amber-700 text-white">
                          {(entry.speakerName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-stone-400 mb-0.5">{entry.speakerName}</p>
                          <p className="text-white text-sm leading-relaxed">{entry.text}</p>
                        </div>
                      </div>
                    ))
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
              participantCount={participantCount}
              accentColor={config.ui.accentColor}
            />
          )}
        </div>
      )}
    </div>
  );
}
