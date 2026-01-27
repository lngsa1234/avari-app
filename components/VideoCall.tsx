import { useEffect, useRef, useState, useCallback } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useIceServers } from '@/hooks/useIceServers';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useRecording } from '@/hooks/useRecording';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { supabase } from '@/lib/supabase';

interface RecapData {
  startedAt: string | null;
  endedAt: string;
  participants: any[];
  transcript: TranscriptEntry[];
  messages: any[];
  metrics?: any;
  topic?: string | null;
}

interface VideoCallProps {
  matchId: string;
  userId: string;
  otherUserId: string;
  otherUserName: string;
  onEndCall: (recapData?: RecapData) => void;
}

interface Message {
  id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface TranscriptEntry {
  id: string;
  speaker: 'local' | 'remote';
  speakerName: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

// Topic suggestions organized by vibe category
const TOPIC_SUGGESTIONS = {
  advice: [
    "What's the best career advice you've received?",
    "How do you handle difficult conversations at work?",
    "What strategies help you with work-life balance?",
    "How did you navigate a major career transition?",
    "What skills do you wish you'd developed earlier?",
  ],
  vent: [
    "What's been challenging for you lately?",
    "How do you decompress after a tough day?",
    "What support do you wish you had more of?",
    "How do you set boundaries at work?",
    "What helps you stay motivated during setbacks?",
  ],
  grow: [
    "What are you currently learning or developing?",
    "What's a skill you'd like to master this year?",
    "How do you approach professional development?",
    "What inspires you in your industry right now?",
    "What's a project you're excited to work on?",
  ],
  general: [
    "What brought you to this industry?",
    "What's your proudest professional achievement?",
    "How do you approach networking authentically?",
    "What does success look like to you?",
    "Who has been a mentor or inspiration to you?",
  ]
};

export default function VideoCall({
  matchId,
  userId,
  otherUserId,
  otherUserName,
  onEndCall,
}: VideoCallProps) {
  // State
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [callStartTime, setCallStartTime] = useState<string | null>(null);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [isLocalVideoMain, setIsLocalVideoMain] = useState(false); // Speaker view: false = remote is main
  const [isHandRaised, setIsHandRaised] = useState(false); // Hand raise feature
  const [remoteHandRaised, setRemoteHandRaised] = useState(false); // Other user's hand raise
  const [showReactions, setShowReactions] = useState(false); // Reactions panel
  const [activeReaction, setActiveReaction] = useState<string | null>(null); // Current reaction emoji
  const [remoteReaction, setRemoteReaction] = useState<string | null>(null); // Other user's reaction

  // Topic Sidebar state
  const [showTopicSidebar, setShowTopicSidebar] = useState(true); // Show by default
  const [transcriptLanguage, setTranscriptLanguage] = useState<'en-US' | 'zh-CN'>('en-US');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [usedTopicIndices, setUsedTopicIndices] = useState<Set<number>>(new Set());
  const [userVibeCategory, setUserVibeCategory] = useState<'advice' | 'vent' | 'grow' | 'general'>('general');
  const [showCaptions, setShowCaptions] = useState(true); // Closed captions overlay

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const interimTranscriptRef = useRef<string>(''); // Track interim transcript for updates

  // Hooks
  const { iceServers, loading: iceServersLoading } = useIceServers();

  // Keep screen awake during call (mobile)
  useWakeLock(true);

  // Recording hook
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    formatTime
  } = useRecording();

  // Background blur hook
  const {
    isBlurEnabled,
    isBlurSupported,
    isLoading: blurLoading,
    toggleBlur
  } = useBackgroundBlur('webrtc');

  // Transcript callback for speech recognition
  const handleTranscript = useCallback((data: { text: string; isFinal: boolean; timestamp: number }) => {
    if (data.isFinal && data.text.trim()) {
      // Add final transcript entry
      const newEntry: TranscriptEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        speaker: 'local',
        speakerName: currentUserName || 'You',
        text: data.text.trim(),
        timestamp: data.timestamp,
        isFinal: true
      };
      setTranscriptEntries(prev => [...prev, newEntry]);
      interimTranscriptRef.current = '';
    } else if (!data.isFinal) {
      // Update interim transcript for captions
      interimTranscriptRef.current = data.text.trim();
    }
  }, [currentUserName]);

  // Speech recognition hook
  const {
    isListening: isTranscribing,
    isSupported: isTranscriptionSupported,
    error: transcriptionError,
    startListening: startTranscription,
    stopListening: stopTranscription
  } = useSpeechRecognition({
    onTranscript: handleTranscript,
    language: transcriptLanguage,
    continuous: true,
    interimResults: true
  });

  const {
    isConnected,
    isConnecting,
    connectionError,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall: endSignalingCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  } = useSignaling(
    { userId, matchId, enabled: true },
    {
      onOffer: async (offer, from) => {
        if (from !== otherUserId) return;
        await handleRemoteOffer(offer);
      },
      onAnswer: async (answer, from) => {
        if (from !== otherUserId) return;
        await handleRemoteAnswer(answer);
      },
      onIceCandidate: async (candidate, from) => {
        if (from !== otherUserId) return;
        await handleRemoteIceCandidate(candidate);
      },
      onIncomingCall: async (from) => {
        if (from !== otherUserId) return;
        console.log('[CircleW] Incoming call - auto-accepting');
        setCallState('ringing');
        
        // Auto-accept and get camera
        try {
          await getLocalStream();
          initializePeerConnection();
          acceptCall(otherUserId);
        } catch (error) {
          console.error('[CircleW] Error accepting call:', error);
          setError('Failed to accept call: ' + (error as Error).message);
        }
      },
      onCallAccepted: (from) => {
        if (from !== otherUserId) return;
        startCall();
      },
      onCallRejected: (from, reason) => {
        setError(`Call rejected: ${reason}`);
        setCallState('ended');
        cleanup();
      },
      onCallEnded: (from) => {
        console.log('[CircleW] Call ended by other party');
        setCallState('ended');
        cleanup();
        stopTranscription();
        // Pass recap data to parent
        onEndCall({
          startedAt: callStartTime,
          endedAt: new Date().toISOString(),
          participants: otherUserProfile ? [otherUserProfile] : [{ id: otherUserId, name: otherUserName }],
          transcript: transcriptEntries,
          messages: messages.map(m => ({
            user_name: m.user_name,
            message: m.message,
            created_at: m.created_at
          })),
          topic: currentTopic
        });
      },
      onError: (error) => {
        console.error('[CircleW] Signaling error:', error);
        setError(error.message);
      },
    }
  );

  // Initialize peer connection
  const initializePeerConnection = () => {
    if (peerConnectionRef.current || iceServersLoading) return;

    console.log('[CircleW] Initializing peer connection with ICE servers:', iceServers);
    const peerConnection = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = peerConnection;

    // ICE candidate handler
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[CircleW] Sending ICE candidate');
        sendIceCandidate(event.candidate.toJSON(), otherUserId);
      }
    };

    // Remote stream handler
    peerConnection.ontrack = (event) => {
      console.log('[CircleW] Received remote track:', event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        // Force play for Safari compatibility
        remoteVideoRef.current.play().catch(err => {
          console.log('[CircleW] Remote video autoplay prevented (will retry):', err);
        });
      }
    };

    // Connection state handler
    peerConnection.onconnectionstatechange = () => {
      console.log('[CircleW] Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        setCallState('connected');
        setError(null);
        if (!callStartTime) {
          setCallStartTime(new Date().toISOString());
        }
      } else if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        setError('Connection lost');
        handleEndCall();
      }
    };

    // ICE connection state handler
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[CircleW] ICE connection state:', peerConnection.iceConnectionState);
    };

    // Add pending ICE candidates
    pendingCandidatesRef.current.forEach(async (candidate) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[CircleW] Error adding pending ICE candidate:', err);
      }
    });
    pendingCandidatesRef.current = [];
  };

  // Get local media stream
  const getLocalStream = async () => {
    try {
      console.log('[CircleW] Getting local media stream');
      const stream = await navigator.mediaDevices.getUserMedia({
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

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Force video to play
        localVideoRef.current.play().catch(err => {
          console.log('[CircleW] Video autoplay prevented (normal):', err);
        });
      }

      // Add tracks to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, stream);
        });
      }

      return stream;
    } catch (err) {
      console.error('[CircleW] Error getting local stream:', err);
      setError('Could not access camera/microphone');
      throw err;
    }
  };

  // Start call (create offer)
  const startCall = async () => {
    try {
      console.log('[CircleW] Starting call');
      setCallState('calling');

      initializePeerConnection();
      await getLocalStream();

      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);

      console.log('[CircleW] Sending offer');
      sendOffer(offer, otherUserId);
    } catch (err) {
      console.error('[CircleW] Error starting call:', err);
      setError('Failed to start call');
      setCallState('idle');
    }
  };

  // Handle incoming call (answer)
  const handleAnswer = async () => {
    try {
      console.log('[CircleW] Answering call');
      acceptCall(otherUserId);

      initializePeerConnection();
      await getLocalStream();
    } catch (err) {
      console.error('[CircleW] Error answering call:', err);
      setError('Failed to answer call');
    }
  };

  // Handle remote offer
  const handleRemoteOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      console.log('[CircleW] Handling remote offer');
      
      if (!peerConnectionRef.current) {
        initializePeerConnection();
        await getLocalStream();
      }

      await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnectionRef.current!.createAnswer();
      await peerConnectionRef.current!.setLocalDescription(answer);

      console.log('[CircleW] Sending answer');
      sendAnswer(answer, otherUserId);
      setCallState('connected');
    } catch (err) {
      console.error('[CircleW] Error handling remote offer:', err);
      setError('Failed to establish connection');
    }
  };

  // Handle remote answer
  const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      console.log('[CircleW] Handling remote answer');
      
      if (!peerConnectionRef.current) {
        console.error('[CircleW] No peer connection');
        return;
      }

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('connected');
    } catch (err) {
      console.error('[CircleW] Error handling remote answer:', err);
      setError('Failed to establish connection');
    }
  };

  // Handle remote ICE candidate
  const handleRemoteIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (!peerConnectionRef.current) {
        console.log('[CircleW] Queueing ICE candidate');
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[CircleW] Error adding ICE candidate:', err);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Toggle background blur
  const handleToggleBlur = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        await toggleBlur(videoTrack);
      }
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // Replace with camera
        if (peerConnectionRef.current && localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }

        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: false
        });

        screenStreamRef.current = screenStream;

        // Replace camera with screen
        if (peerConnectionRef.current) {
          const screenTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          }
        }

        // Handle user stopping share via browser button
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('[CircleW] Error toggling screen share:', error);
      setError('Failed to share screen');
    }
  };

  // Toggle recording
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        stopRecording();
      } else {
        // Get stream to record (local video)
        if (localStreamRef.current) {
          await startRecording(localStreamRef.current);
        }
      }
    } catch (error) {
      console.error('[CircleW] Error toggling recording:', error);
      setError('Failed to start recording');
    }
  };

  // Shuffle to next topic
  const shuffleTopic = () => {
    const topics = TOPIC_SUGGESTIONS[userVibeCategory] || TOPIC_SUGGESTIONS.general;
    const availableIndices = topics
      .map((_, index) => index)
      .filter(index => !usedTopicIndices.has(index));

    // Reset if all topics used
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
  };

  // Toggle transcript language
  const toggleTranscriptLanguage = () => {
    const newLang = transcriptLanguage === 'en-US' ? 'zh-CN' : 'en-US';
    setTranscriptLanguage(newLang);

    // Restart transcription with new language if active
    if (isTranscribing) {
      stopTranscription();
      // Small delay to allow cleanup
      setTimeout(() => {
        startTranscription();
      }, 100);
    }
  };

  // Toggle closed captions
  const toggleCaptions = () => {
    setShowCaptions(!showCaptions);
    if (!showCaptions && !isTranscribing && callState === 'connected') {
      // Auto-start transcription when enabling captions
      startTranscription();
    }
  };

  // Toggle hand raise
  const toggleHandRaise = async () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);

    // Send hand raise status via call_messages as a system message
    try {
      await supabase
        .from('call_messages')
        .insert({
          channel_name: `video-${matchId}`,
          user_id: userId,
          user_name: currentUserName,
          message: newState ? '✋ raised their hand' : '✋ lowered their hand'
        });
    } catch (error) {
      console.error('[CircleW] Error sending hand raise:', error);
    }
  };

  // Send reaction
  const sendReaction = async (emoji: string) => {
    setActiveReaction(emoji);
    setShowReactions(false);

    // Clear reaction after 3 seconds
    setTimeout(() => setActiveReaction(null), 3000);

    // Send reaction via call_messages
    try {
      await supabase
        .from('call_messages')
        .insert({
          channel_name: `video-${matchId}`,
          user_id: userId,
          user_name: currentUserName,
          message: `reacted with ${emoji}`
        });
    } catch (error) {
      console.error('[CircleW] Error sending reaction:', error);
    }
  };

  // Format meeting time for header
  const formatMeetingTime = () => {
    if (!callStartTime) {
      return new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date(callStartTime).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { data, error } = await supabase
        .from('call_messages')
        .insert({
          channel_name: `video-${matchId}`,
          user_id: userId,
          user_name: currentUserName,
          message: newMessage.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setNewMessage('');

      // Manually add if real-time doesn't work
      if (data) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.id);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('[CircleW] Error sending message:', error);
    }
  };

  // Handle end call - pass recap data to parent
  const handleEndCall = () => {
    console.log('[CircleW] Ending call');

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Stop screen sharing if active
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    }

    endSignalingCall(otherUserId);
    setCallState('ended');
    cleanup();

    // Pass recap data to parent (VideoCallButton handles showing the recap)
    onEndCall({
      startedAt: callStartTime,
      endedAt: new Date().toISOString(),
      participants: otherUserProfile ? [otherUserProfile] : [{ id: otherUserId, name: otherUserName }],
      transcript: transcriptEntries,
      messages: messages.map(m => ({
        user_name: m.user_name,
        message: m.message,
        created_at: m.created_at
      })),
      topic: currentTopic
    });
  };

  // Handle reject call
  const handleRejectCall = () => {
    console.log('[CircleW] Rejecting call');
    rejectCall(otherUserId, 'User declined');
    setCallState('ended');
    cleanup();
    onEndCall();
  };

  // Cleanup
  const cleanup = () => {
    console.log('[CircleW] Cleaning up resources');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    pendingCandidatesRef.current = [];
  };

  // Initialize call on mount - AUTO START VERSION
  useEffect(() => {
    if (!isConnected || iceServersLoading) {
      console.log('[CircleW] Not ready to start call:', { isConnected, iceServersLoading });
      return;
    }

    if (peerConnectionRef.current || localStreamRef.current) {
      console.log('[CircleW] Call already started');
      return;
    }

    console.log('[CircleW] Auto-starting call setup');

    // Auto-start the call immediately (no manual accept needed)
    const autoStartCall = async () => {
      try {
        // 1. Send signaling message
        initiateCall(otherUserId);
        
        // 2. Get camera/microphone
        await getLocalStream();
        
        // 3. Initialize peer connection
        initializePeerConnection();
        
        // 4. Small delay to let peer connection initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 5. Create and send offer (first user to connect becomes caller)
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState === 'stable') {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          console.log('[CircleW] Sending offer');
          sendOffer(offer, otherUserId);
          setCallState('calling');
        }
      } catch (error) {
        console.error('[CircleW] Error auto-starting call:', error);
        setError('Failed to start call: ' + (error as Error).message);
      }
    };

    autoStartCall();
  }, [isConnected, iceServersLoading]);

  // Load current user name and other user profile
  useEffect(() => {
    const loadUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();

        setCurrentUserName(profile?.name || profile?.email || 'Anonymous');
      }
    };

    const loadOtherUserProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, profile_picture, career')
        .eq('id', otherUserId)
        .single();

      if (profile) {
        setOtherUserProfile(profile);
      }
    };

    loadUserName();
    loadOtherUserProfile();
  }, [otherUserId]);

  // Load and subscribe to messages
  useEffect(() => {
    const channelName = `video-${matchId}`;

    // Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('call_messages')
        .select('*')
        .eq('channel_name', channelName)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        setMessages(data);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`call-messages-${channelName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_messages',
          filter: `channel_name=eq.${channelName}`
        },
        (payload) => {
          console.log('[CircleW] New message:', payload.new);
          setMessages(prev => {
            const exists = prev.some(m => m.id === payload.new.id);
            if (!exists) {
              return [...prev, payload.new as Message];
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptEntries]);

  // Load user's vibe category for topic suggestions
  useEffect(() => {
    const loadUserVibeCategory = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('vibe_category')
        .eq('id', userId)
        .single();

      if (profile?.vibe_category) {
        setUserVibeCategory(profile.vibe_category as 'advice' | 'vent' | 'grow');
      }
    };

    loadUserVibeCategory();
  }, [userId]);

  // Set initial topic and auto-start transcription when call connects
  useEffect(() => {
    if (callState === 'connected') {
      // Set initial topic if not set
      if (!currentTopic) {
        shuffleTopic();
      }

      // Auto-start transcription if supported
      if (isTranscriptionSupported && !isTranscribing) {
        startTranscription();
      }
    }

    // Stop transcription when call ends
    if (callState === 'ended' && isTranscribing) {
      stopTranscription();
    }
  }, [callState, isTranscriptionSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      stopTranscription();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          {/* CircleW Logo */}
          <svg width="28" height="28" viewBox="0 0 100 100" className="text-white">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="220 60"/>
            <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="currentColor">W</text>
          </svg>
          <div>
            <h1 className="text-white font-semibold">Coffee Chat</h1>
            <p className="text-slate-400 text-xs">
              {formatMeetingTime()} · 2 participants
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Three-dot menu */}
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {/* Leave button */}
          <button
            onClick={handleEndCall}
            className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(error || connectionError) && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-50 max-w-md text-center">
          {error || connectionError}
        </div>
      )}

      {/* Connection status */}
      {isConnecting && (
        <div className="absolute top-16 left-4 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm z-40">
          Connecting to server...
        </div>
      )}

      {/* Topic Sidebar (Right) - Same side as chat for consistency */}
      {showTopicSidebar && (
        <div className="fixed right-0 top-[52px] bottom-0 w-full md:w-80 bg-slate-800 border-l border-slate-700 flex flex-col z-[60]">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-white font-semibold">Topics</h3>
              </div>
              <button
                onClick={() => setShowTopicSidebar(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2">
              <span className="text-slate-300 text-sm">Language</span>
              <div className="flex items-center bg-slate-600 rounded-lg p-0.5">
                <button
                  onClick={() => transcriptLanguage !== 'en-US' && toggleTranscriptLanguage()}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                    transcriptLanguage === 'en-US'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => transcriptLanguage !== 'zh-CN' && toggleTranscriptLanguage()}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                    transcriptLanguage === 'zh-CN'
                      ? 'bg-amber-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  中
                </button>
              </div>
            </div>
          </div>

          {/* Current Topic Card */}
          <div className="p-4 border-b border-slate-700">
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 border border-amber-500/30">
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
                  className="p-2 bg-amber-500 hover:bg-amber-600 rounded-lg transition-all hover:scale-105"
                  title="Shuffle topic"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {userVibeCategory === 'advice' && 'Mentorship focused'}
                {userVibeCategory === 'vent' && 'Support focused'}
                {userVibeCategory === 'grow' && 'Growth focused'}
                {userVibeCategory === 'general' && 'General networking'}
              </p>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-slate-300 text-sm font-medium">Live Transcript</span>
              </div>
              {transcriptionError && (
                <span className="text-xs text-red-400">{transcriptionError}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcriptEntries.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <p className="text-slate-400 text-sm">
                    {isTranscribing
                      ? 'Listening... Start speaking!'
                      : isTranscriptionSupported
                        ? 'Transcript will appear when you speak'
                        : 'Speech recognition not supported in this browser'}
                  </p>
                </div>
              ) : (
                transcriptEntries.map((entry) => (
                  <div key={entry.id} className="group">
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                        entry.speaker === 'local'
                          ? 'bg-purple-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {entry.speakerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5">
                          {entry.speakerName}
                        </p>
                        <p className="text-white text-sm leading-relaxed">
                          {entry.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Transcript Controls */}
          <div className="p-4 border-t border-slate-700 flex items-center justify-between">
            <button
              onClick={() => isTranscribing ? stopTranscription() : startTranscription()}
              disabled={!isTranscriptionSupported}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isTranscribing
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {isTranscribing ? 'Stop' : 'Start'}
            </button>

            <button
              onClick={toggleCaptions}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                showCaptions
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
              }`}
              title={showCaptions ? 'Hide captions' : 'Show captions'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              CC
            </button>
          </div>
        </div>
      )}

      {/* Video containers */}
      <div className={`flex-1 relative transition-all duration-300 ${(showChat || showTopicSidebar) ? 'md:mr-80' : ''}`}>
        {/* Remote video (main) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`object-cover transition-all duration-300 ${
            isLocalVideoMain
              ? 'absolute top-4 right-4 w-48 h-36 rounded-lg shadow-xl z-10'
              : 'w-full h-full'
          }`}
        />

        {/* Remote participant name label (on main video) */}
        {!isLocalVideoMain && callState === 'connected' && (
          <div className="absolute bottom-20 left-4 z-20">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-white font-medium">{otherUserName}</span>
              {remoteHandRaised && <span className="text-lg">✋</span>}
            </div>
          </div>
        )}

        {/* Remote reaction overlay */}
        {remoteReaction && !isLocalVideoMain && (
          <div className="absolute bottom-32 left-4 z-20 animate-bounce">
            <span className="text-5xl">{remoteReaction}</span>
          </div>
        )}

        {/* Local video (PIP) */}
        <video
          ref={localVideoRef}
          key={localStreamRef.current ? 'has-stream' : 'no-stream'}
          autoPlay
          playsInline
          muted
          className={`object-cover transition-all duration-300 ${
            isLocalVideoMain
              ? 'w-full h-full'
              : 'absolute top-4 right-4 w-48 h-36 rounded-lg shadow-xl z-10 border-2 border-slate-600'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Local participant name label (on PIP) */}
        {!isLocalVideoMain && (
          <div className="absolute top-[148px] right-4 z-20">
            <div className="bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-xs text-white">
              You {isHandRaised && '✋'}
            </div>
          </div>
        )}

        {/* Local reaction overlay */}
        {activeReaction && (
          <div className={`absolute z-30 animate-bounce ${isLocalVideoMain ? 'bottom-32 left-4' : 'top-20 right-8'}`}>
            <span className="text-4xl">{activeReaction}</span>
          </div>
        )}

        {/* Clickable overlay on small video to swap */}
        <div
          className="absolute top-4 right-4 w-48 h-36 cursor-pointer hover:ring-2 hover:ring-amber-400 rounded-lg transition-all z-20"
          onClick={() => setIsLocalVideoMain(!isLocalVideoMain)}
          title="Tap to swap videos"
        />

        {/* Closed Captions Overlay */}
        {showCaptions && callState === 'connected' && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30 max-w-2xl w-full px-4">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
              {transcriptEntries.length > 0 ? (
                <p className="text-white text-lg leading-relaxed">
                  {transcriptEntries[transcriptEntries.length - 1]?.text}
                </p>
              ) : interimTranscriptRef.current ? (
                <p className="text-white/70 text-lg leading-relaxed italic">
                  {interimTranscriptRef.current}
                </p>
              ) : (
                <p className="text-slate-400 text-sm">
                  {isTranscribing ? 'Listening...' : 'Captions paused'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Call state overlay */}
        {callState !== 'connected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center text-white">
              {otherUserProfile?.profile_picture ? (
                <img
                  src={otherUserProfile.profile_picture}
                  alt={otherUserName}
                  className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-600"
                />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-slate-700 flex items-center justify-center text-3xl font-bold">
                  {otherUserName.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-2xl font-semibold mb-2">{otherUserName}</p>
              {callState === 'idle' && <p className="text-slate-400">Preparing call...</p>}
              {callState === 'calling' && (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <p className="text-slate-400">Calling...</p>
                </div>
              )}
              {callState === 'ringing' && <p className="text-slate-400">Incoming call...</p>}
              {callState === 'ended' && <p className="text-slate-400">Call ended</p>}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        {/* AI Recap indicator */}
        <div className="absolute bottom-20 left-4 flex items-center gap-2 bg-slate-700/80 backdrop-blur-sm rounded-lg px-3 py-2 z-30">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-white text-sm font-medium">AI Recap is on</p>
            <p className="text-slate-400 text-xs">We'll summarize key points & next steps for you</p>
          </div>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute bottom-32 left-4 flex items-center text-red-400 text-sm bg-slate-700/80 backdrop-blur-sm px-3 py-2 rounded-lg z-30">
            <span className="animate-pulse mr-2">⏺</span>
            {formatTime(recordingTime)}
          </div>
        )}

        {/* Reactions Panel */}
        {showReactions && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-700 rounded-xl p-3 flex gap-2 shadow-xl z-40">
            {['👍', '❤️', '😂', '👏', '🎉', '🤔'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-2xl hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
          {callState === 'ringing' ? (
            <>
              <button
                onClick={handleRejectCall}
                className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition"
                title="Reject call"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={handleAnswer}
                className="p-4 bg-green-500 hover:bg-green-600 rounded-full transition"
                title="Accept call"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* Microphone toggle */}
              <button
                onClick={toggleAudio}
                className={`p-3.5 rounded-full transition ${
                  isAudioEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'
                }`}
                title={isAudioEnabled ? 'Mute' : 'Unmute'}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isAudioEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>

              {/* Camera toggle */}
              <button
                onClick={toggleVideo}
                className={`p-3.5 rounded-full transition ${
                  isVideoEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isVideoEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  )}
                </svg>
              </button>

              {/* Hand raise toggle */}
              <button
                onClick={toggleHandRaise}
                className={`p-3.5 rounded-full transition ${
                  isHandRaised ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={isHandRaised ? 'Lower hand' : 'Raise hand'}
              >
                <span className="text-xl">✋</span>
              </button>

              {/* Reactions toggle */}
              <button
                onClick={() => setShowReactions(!showReactions)}
                className={`p-3.5 rounded-full transition ${
                  showReactions ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title="Reactions"
              >
                <span className="text-xl">😊</span>
              </button>

              {/* Background blur toggle */}
              {isBlurSupported && (
                <button
                  onClick={handleToggleBlur}
                  disabled={blurLoading || !isVideoEnabled}
                  className={`p-3.5 rounded-full transition ${
                    isBlurEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
                >
                  <span className="text-xl">{blurLoading ? '⏳' : '🌫️'}</span>
                </button>
              )}

              {/* Screen share toggle */}
              <button
                onClick={toggleScreenShare}
                className={`p-3.5 rounded-full transition ${
                  isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Topic Sidebar toggle */}
              <button
                onClick={() => {
                  if (!showTopicSidebar) setShowChat(false); // Close chat when opening topic sidebar
                  setShowTopicSidebar(!showTopicSidebar);
                }}
                className={`p-3.5 rounded-full transition ${
                  showTopicSidebar ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title="Toggle topic sidebar"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </button>

              {/* Closed Captions toggle */}
              <button
                onClick={toggleCaptions}
                className={`p-3.5 rounded-full transition ${
                  showCaptions ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={showCaptions ? 'Hide captions' : 'Show captions'}
              >
                <span className="text-white text-sm font-bold">CC</span>
              </button>

              {/* Chat toggle */}
              <button
                onClick={() => {
                  if (!showChat) setShowTopicSidebar(false); // Close topic sidebar when opening chat
                  setShowChat(!showChat);
                }}
                className={`p-3.5 rounded-full transition relative ${
                  showChat ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title="Toggle chat"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {messages.length > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {messages.length > 9 ? '9+' : messages.length}
                  </span>
                )}
              </button>

              {/* End call */}
              <button
                onClick={handleEndCall}
                className="p-3.5 bg-red-500 hover:bg-red-600 rounded-full transition"
                title="End call"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-slate-800 border-l border-slate-700 flex flex-col z-50">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-white font-semibold">Chat</h3>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-slate-400 text-sm text-center mt-8">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => {
                // Check if this is a system message (hand raise or reaction)
                const isSystemMessage = msg.message.includes('raised their hand') ||
                                        msg.message.includes('lowered their hand') ||
                                        msg.message.includes('reacted with');

                if (isSystemMessage) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="text-slate-500 text-xs bg-slate-700/50 px-2 py-1 rounded">
                        {msg.user_id === userId ? 'You' : msg.user_name} {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`${
                      msg.user_id === userId
                        ? 'ml-auto bg-purple-600'
                        : 'mr-auto bg-slate-700'
                    } max-w-[85%] rounded-lg p-3`}
                  >
                    <p className="text-xs text-slate-300 mb-1">
                      {msg.user_id === userId ? 'You' : msg.user_name}
                    </p>
                    <p className="text-white text-sm break-words">{msg.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
