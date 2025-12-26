// app/meeting/[id]/page.js
// Create this folder and file: app/meeting/[id]/page.js

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
      } else {
        // Not logged in, redirect to home
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
      console.log('🎥 Initializing video call for meeting:', meetingId);
      
      // Get meeting info from database
      const { data: meeting } = await supabase
        .from('video_rooms')
        .select(`
          *,
          coffee_chats (
            requester_id,
            recipient_id,
            profiles!coffee_chats_requester_id_fkey (full_name),
            profiles!coffee_chats_recipient_id_fkey (full_name)
          )
        `)
        .eq('room_id', meetingId)
        .single();

      if (meeting?.coffee_chats) {
        // Determine partner name
        const isRequester = meeting.coffee_chats.requester_id === user.id;
        const partner = isRequester 
          ? meeting.coffee_chats.profiles[1] 
          : meeting.coffee_chats.profiles[0];
        setPartnerName(partner?.full_name || 'Partner');
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
      console.error('❌ Error initializing call:', error);
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
      console.log('🎉 Received remote track:', event.track.kind);
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
      console.log('💬 Chat channel opened');
    };
    
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setChatMessages(prev => [...prev, { ...message, sender: 'remote' }]);
    };
  };

  const setupRealtimeSignaling = () => {
    // Use Supabase Realtime for WebRTC signaling
    const channel = supabase.channel(`meeting:${meetingId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to signaling channel');
          
          // Update participants in database
          await supabase
            .from('video_rooms')
            .update({
              participants: supabase.rpc('array_append', {
                arr: 'participants',
                elem: { user_id: user.id, joined_at: new Date().toISOString() }
              })
            })
            .eq('room_id', meetingId);
          
          // Check if we should create offer (first person)
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
    // Save call end time
    await supabase
      .from('video_rooms')
      .update({ ended_at: new Date().toISOString() })
      .eq('room_id', meetingId);
    
    cleanup();
    router.push('/'); // Go back to Avari dashboard
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

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header - Avari Branded */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☕</span>
            <div>
              <h1 className="text-white font-bold text-xl">Avari Coffee Chat</h1>
              <p className="text-rose-100 text-sm">
                {isConnected ? `✓ Connected with ${partnerName}` : 'Connecting...'}
              </p>
            </div>
          </div>
          <button
            onClick={endCall}
            className="bg-white text-rose-600 hover:bg-rose-50 px-6 py-2 rounded-lg font-medium transition"
          >
            End Call
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex overflow-hidden">
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
            <button
              onClick={() => setShowChat(!showChat)}
              className="bg-gray-700 hover:bg-gray-600 text-white w-14 h-14 rounded-full text-2xl transition"
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
