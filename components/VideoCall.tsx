import { useEffect, useRef, useState } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useIceServers } from '@/hooks/useIceServers';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useRecording } from '@/hooks/useRecording';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import { supabase } from '@/lib/supabase';

interface RecapData {
  startedAt: string | null;
  endedAt: string;
  participants: any[];
  transcript: any[];
  messages: any[];
  metrics?: any;
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

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        // Pass recap data to parent
        onEndCall({
          startedAt: callStartTime,
          endedAt: new Date().toISOString(),
          participants: otherUserProfile ? [otherUserProfile] : [{ id: otherUserId, name: otherUserName }],
          transcript: [],
          messages: messages.map(m => ({
            user_name: m.user_name,
            message: m.message,
            created_at: m.created_at
          }))
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
      transcript: [],
      messages: messages.map(m => ({
        user_name: m.user_name,
        message: m.message,
        created_at: m.created_at
      }))
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Error banner */}
      {(error || connectionError) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-50 max-w-md text-center">
          {error || connectionError}
        </div>
      )}

      {/* Connection status */}
      {isConnecting && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm">
          Connecting to server...
        </div>
      )}

      {/* Video containers */}
      <div className={`flex-1 relative transition-all duration-300 ${showChat ? 'md:mr-80' : ''}`}>
        {/* Remote video */}
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

        {/* Local video */}
        <video
          ref={localVideoRef}
          key={localStreamRef.current ? 'has-stream' : 'no-stream'}
          autoPlay
          playsInline
          muted
          className={`object-cover transition-all duration-300 ${
            isLocalVideoMain
              ? 'w-full h-full'
              : 'absolute top-4 right-4 w-48 h-36 rounded-lg shadow-xl z-10'
          }`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Clickable overlay on small video to swap */}
        <div
          className="absolute top-4 right-4 w-48 h-36 cursor-pointer hover:ring-2 hover:ring-purple-500 rounded-lg transition-all z-20"
          onClick={() => setIsLocalVideoMain(!isLocalVideoMain)}
          title="Tap to swap videos"
        >
          {/* Swap indicator */}
          <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 rounded px-1.5 py-0.5 text-xs text-white">
            {isLocalVideoMain ? otherUserName : 'You'}
          </div>
        </div>

        {/* Call state overlay */}
        {callState !== 'connected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center text-white">
              <p className="text-2xl font-semibold mb-2">{otherUserName}</p>
              {callState === 'idle' && <p>Preparing call...</p>}
              {callState === 'calling' && <p>Calling...</p>}
              {callState === 'ringing' && <p>Incoming call...</p>}
              {callState === 'ended' && <p>Call ended</p>}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6">
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute bottom-24 left-4 flex items-center text-red-500 text-sm bg-black bg-opacity-75 px-3 py-2 rounded">
            <span className="animate-pulse mr-2">⏺</span>
            {formatTime(recordingTime)}
          </div>
        )}

        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
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
                className={`p-4 rounded-full transition ${
                  isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                }`}
                title={isAudioEnabled ? 'Mute' : 'Unmute'}
              >
                {isAudioEnabled ? '🎤' : '🔇'}
              </button>

              {/* Camera toggle */}
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition ${
                  isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                📹
              </button>

              {/* Background blur toggle */}
              {isBlurSupported && (
                <button
                  onClick={handleToggleBlur}
                  disabled={blurLoading || !isVideoEnabled}
                  className={`p-4 rounded-full transition ${
                    isBlurEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
                >
                  {blurLoading ? '⏳' : '🌫️'}
                </button>
              )}

              {/* Screen share toggle */}
              <button
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition ${
                  isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                🖥️
              </button>

              {/* Recording toggle */}
              <button
                onClick={toggleRecording}
                className={`p-4 rounded-full transition ${
                  isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isRecording ? 'Stop recording' : 'Start recording'}
              >
                ⏺
              </button>

              {/* Chat toggle */}
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-4 rounded-full transition relative ${
                  showChat ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title="Toggle chat"
              >
                💬
                {messages.length > 0 && !showChat && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                    {messages.length}
                  </span>
                )}
              </button>

              {/* End call */}
              <button
                onClick={handleEndCall}
                className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition"
                title="End call"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-50">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-8">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${
                    msg.user_id === userId
                      ? 'ml-auto bg-purple-600'
                      : 'mr-auto bg-gray-700'
                  } max-w-[85%] rounded-lg p-3`}
                >
                  <p className="text-xs text-gray-300 mb-1">
                    {msg.user_id === userId ? 'You' : msg.user_name}
                  </p>
                  <p className="text-white text-sm break-words">{msg.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connection indicator */}
      <div className="absolute bottom-24 left-4 text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
        {!isConnected && <p>{isConnecting ? 'Connecting...' : 'Disconnected'}</p>}
        {isConnected && callState === 'calling' && <p>Calling...</p>}
        {isConnected && callState === 'connected' && <p>Connected</p>}
      </div>
    </div>
  );
}
