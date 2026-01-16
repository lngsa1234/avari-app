// app/meeting/[id]/page.js
// 1:1 Coffee Chat with Speech-to-Text and AI Recap

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import CallRecap from '@/components/CallRecap';

export default function VideoMeeting() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id;

  const [localStream, setLocalStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [user, setUser] = useState(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [partnerId, setPartnerId] = useState(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [callStartTime, setCallStartTime] = useState(null);

  // Recap state
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  // Handle transcript from speech recognition
  const handleTranscript = useCallback(async ({ text, isFinal, timestamp }) => {
    if (isFinal && text.trim() && user) {
      const entry = {
        speakerId: user.id,
        speakerName: user.email?.split('@')[0] || 'You',
        text: text.trim(),
        timestamp,
        isFinal: true
      };

      // Add to local state
      setTranscript(prev => [...prev, entry]);
      console.log('[Transcription]', text);

      // Save to Supabase for shared access
      try {
        await supabase.from('call_transcripts').insert({
          channel_name: meetingId,
          user_id: user.id,
          speaker_name: entry.speakerName,
          text: entry.text,
          timestamp: entry.timestamp,
          is_final: true
        });
      } catch (e) {
        console.error('Failed to save transcript:', e);
      }
    }
  }, [user, meetingId]);

  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    error: speechError,
    startListening,
    stopListening
  } = useSpeechRecognition({
    onTranscript: handleTranscript,
    continuous: true,
    interimResults: false
  });

  // Toggle transcription
  const toggleTranscription = useCallback(() => {
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
      console.log('[Transcription] Stopped');
    } else {
      const started = startListening();
      if (started) {
        setIsTranscribing(true);
        console.log('[Transcription] Started');
      }
    }
  }, [isTranscribing, startListening, stopListening]);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
      } else {
        router.push('/');
      }
    });
  }, [router]);

  useEffect(() => {
    if (meetingId && user) {
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, [meetingId, user]);

  const initializeCall = async () => {
    try {
      console.log('Initializing video call for meeting:', meetingId);
      setCallStartTime(new Date().toISOString());

      // Get meeting info from database
      const { data: meeting } = await supabase
        .from('video_rooms')
        .select(`
          *,
          coffee_chats (
            requester_id,
            recipient_id
          )
        `)
        .eq('room_id', meetingId)
        .single();

      if (meeting?.coffee_chats) {
        // Determine partner ID
        const isRequester = meeting.coffee_chats.requester_id === user.id;
        const partnerUserId = isRequester
          ? meeting.coffee_chats.recipient_id
          : meeting.coffee_chats.requester_id;

        // Fetch partner profile separately
        if (partnerUserId) {
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('id, name, email, profile_picture, career')
            .eq('id', partnerUserId)
            .single();

          if (partnerProfile) {
            setPartnerName(partnerProfile.name || partnerProfile.email?.split('@')[0] || 'Partner');
            setPartnerId(partnerProfile.id);
          }
        }
      }

      // Get media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup WebRTC
      setupPeerConnection(stream);

      // Setup Supabase Realtime for signaling
      setupRealtimeSignaling();

    } catch (error) {
      console.error('Error initializing call:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const setupPeerConnection = (stream) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    // Add tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (pc.connectionState === 'failed') {
        alert('Connection failed. Please try refreshing.');
      }
    };

    // Setup data channel for chat
    const dataChannel = pc.createDataChannel('chat');
    setupDataChannel(dataChannel);

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };
  };

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log('Chat channel opened');
    };

    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setChatMessages(prev => [...prev, { ...message, sender: 'remote' }]);
    };
  };

  const setupRealtimeSignaling = () => {
    const channel = supabase.channel(`meeting:${meetingId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to signaling channel');
          setTimeout(() => createOffer(), 1000);
        }
      });

    realtimeChannelRef.current = channel;
  };

  const sendSignal = (signal) => {
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal
      });
    }
  };

  const createOffer = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || pc.signalingState !== 'stable') return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal({
        type: 'offer',
        offer: pc.localDescription
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleSignal = async (signal) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      switch (signal.type) {
        case 'offer':
          if (pc.signalingState !== 'stable') return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({
            type: 'answer',
            answer: pc.localDescription
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
      console.error('Error handling signal:', error);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const sendChatMessage = () => {
    if (!messageInput.trim() || !dataChannelRef.current) return;

    const message = {
      text: messageInput,
      timestamp: new Date().toISOString()
    };

    if (dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
      setChatMessages(prev => [...prev, { ...message, sender: 'local' }]);
      setMessageInput('');
    }
  };

  const endCall = async () => {
    // Stop transcription
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
    }

    const endTime = new Date().toISOString();

    // Save call end time
    await supabase
      .from('video_rooms')
      .update({ ended_at: endTime })
      .eq('room_id', meetingId);

    // Fetch ALL transcripts for this call (both participants)
    let allTranscripts = [];
    try {
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('*')
        .eq('channel_name', meetingId)
        .order('timestamp', { ascending: true });

      if (transcripts) {
        allTranscripts = transcripts.map(t => ({
          speakerId: t.user_id,
          speakerName: t.speaker_name,
          text: t.text,
          timestamp: t.timestamp,
          isFinal: t.is_final
        }));
      }
    } catch (e) {
      console.error('Failed to fetch transcripts:', e);
      allTranscripts = transcript; // Fall back to local transcript
    }

    // Get partner profile for recap
    let participants = [];
    if (partnerId) {
      try {
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('id, name, email, profile_picture, career')
          .eq('id', partnerId)
          .single();

        if (partnerProfile) {
          participants = [partnerProfile];
        }
      } catch (e) {
        console.error('Failed to fetch partner profile:', e);
      }
    }

    // Prepare recap data
    setRecapData({
      channelName: meetingId,
      callType: '1on1',
      provider: 'webrtc',
      startedAt: callStartTime,
      endedAt: endTime,
      participants,
      transcript: allTranscripts,
      messages: chatMessages.map(m => ({
        user_name: m.sender === 'local' ? (user?.email?.split('@')[0] || 'You') : partnerName,
        message: m.text,
        created_at: m.timestamp
      }))
    });

    cleanup();
    setShowRecap(true);
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

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }
  };

  // Show recap screen
  if (showRecap && recapData) {
    return (
      <CallRecap
        channelName={recapData.channelName}
        callType={recapData.callType}
        provider={recapData.provider}
        startedAt={recapData.startedAt}
        endedAt={recapData.endedAt}
        participants={recapData.participants}
        currentUserId={user?.id}
        transcript={recapData.transcript}
        onClose={handleRecapClose}
        onConnect={handleConnectFromRecap}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☕</span>
            <div>
              <h1 className="text-white font-bold text-xl">Avari Coffee Chat</h1>
              <p className="text-rose-100 text-sm">
                {isConnected ? `Connected with ${partnerName}` : 'Connecting...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isTranscribing && (
              <span className="text-white text-sm flex items-center">
                <span className="animate-pulse mr-2">📝</span>
                Transcribing
              </span>
            )}
            <button
              onClick={endCall}
              className="bg-white text-rose-600 hover:bg-rose-50 px-6 py-2 rounded-lg font-medium transition"
            >
              End Call
            </button>
          </div>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Video */}
        <div className="flex-1 relative bg-black">
          {/* Local Video (You) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            You
          </div>

          {/* Remote Video (Partner) - Picture-in-Picture */}
          <div className="absolute top-4 right-4 w-72 h-52 bg-gray-800 rounded-xl overflow-hidden border-2 border-white shadow-2xl">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
              {partnerName}
            </div>
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-white text-center">
                  <div className="animate-spin text-4xl mb-2">⏳</div>
                  <p>Waiting for {partnerName}...</p>
                </div>
              </div>
            )}
          </div>

          {/* Live Transcript Overlay */}
          {isTranscribing && transcript.length > 0 && (
            <div className="absolute bottom-24 left-4 right-4 pointer-events-none">
              <div className="bg-black bg-opacity-70 rounded-lg p-3 max-h-24 overflow-hidden">
                <div className="space-y-1">
                  {transcript.slice(-3).map((entry, idx) => (
                    <p key={idx} className="text-white text-sm">
                      <span className="text-green-400 font-medium">{entry.speakerName}: </span>
                      {entry.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
            <button
              onClick={toggleMute}
              className={`${
                isMuted ? 'bg-red-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-14 h-14 rounded-full text-2xl transition`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={toggleVideo}
              className={`${
                isVideoOff ? 'bg-red-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-14 h-14 rounded-full text-2xl transition`}
              title={isVideoOff ? 'Turn on video' : 'Turn off video'}
            >
              📹
            </button>

            {/* Transcription toggle */}
            {isSpeechSupported && (
              <button
                onClick={toggleTranscription}
                className={`${
                  isTranscribing ? 'bg-green-600' : 'bg-gray-700'
                } hover:bg-gray-600 text-white w-14 h-14 rounded-full text-2xl transition relative`}
                title={isTranscribing ? 'Stop transcription' : 'Start transcription'}
              >
                📝
                {isTranscribing && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                )}
              </button>
            )}

            <button
              onClick={() => setShowChat(!showChat)}
              className={`${
                showChat ? 'bg-purple-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-14 h-14 rounded-full text-2xl transition`}
              title="Toggle chat"
            >
              💬
            </button>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-96 bg-white flex flex-col border-l-4 border-rose-500">
            <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-pink-50">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 mt-8">
                  <p className="text-4xl mb-2">💬</p>
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.sender === 'local' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender === 'local'
                          ? 'bg-rose-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  onClick={sendChatMessage}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
