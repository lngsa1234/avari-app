// components/VideoCallButton.js
// WebRTC implementation using Supabase for signaling
'use client';

import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function VideoCallButton({ meetup }) {
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const channelRef = useRef(null); // Store channel reference
  const isMountedRef = useRef(true); // Track if component is mounted
  const roomId = meetup.id;

  // ICE servers configuration (STUN servers for NAT traversal)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  const startCall = async () => {
    try {
      setIsConnecting(true);
      console.log('🎥 Starting call for room:', roomId);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine if we're the caller or answerer based on requester_id
      const isCaller = meetup.requester_id === user.id;
      console.log('👤 Role:', isCaller ? 'CALLER' : 'ANSWERER');

      // Get local media stream
      console.log('📹 Requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      if (!isMountedRef.current) {
        console.warn('⚠️ Component unmounted, stopping stream');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      console.log('✅ Got local stream');
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      console.log('🔗 Creating peer connection...');
      const peerConnection = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = peerConnection;

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        console.log('🔌 Connection state:', peerConnection.connectionState);
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
      };

      peerConnection.onsignalingstatechange = () => {
        console.log('📡 Signaling state:', peerConnection.signalingState);
      };

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        console.log('📥 Received remote track:', event.track.kind);
        if (!isMountedRef.current) return;
        
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate');
          try {
            await supabase
              .from('video_signals')
              .insert({
                room_id: roomId,
                type: 'ice-candidate',
                data: event.candidate,
                sender_id: user.id
              });
          } catch (err) {
            console.error('❌ Error sending ICE candidate:', err);
          }
        } else {
          console.log('✅ All ICE candidates sent');
        }
      };

      // Poll for signals instead of using Realtime (more reliable)
      console.log('🔄 Starting signal polling...');
      const pollInterval = setInterval(async () => {
        if (!isMountedRef.current) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Get new signals since we started
          const { data: signals, error } = await supabase
            .from('video_signals')
            .select('*')
            .eq('room_id', roomId)
            .neq('sender_id', user.id)
            .order('created_at', { ascending: true });

          if (error) throw error;

          for (const signal of signals || []) {
            console.log('📨 Received signal:', signal.type);

            try {
              // Check if peer connection is still valid
              if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === 'closed') {
                console.warn('⚠️ Peer connection is closed, ignoring signal');
                continue;
              }

              if (signal.type === 'offer' && !isCaller && peerConnectionRef.current.signalingState === 'stable') {
                // Answerer receives offer
                console.log('📥 Setting remote description (offer)');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
                
                console.log('📤 Creating answer');
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                
                console.log('📤 Sending answer');
                await supabase
                  .from('video_signals')
                  .insert({
                    room_id: roomId,
                    type: 'answer',
                    data: answer,
                    sender_id: user.id
                  });
              } else if (signal.type === 'answer' && isCaller && peerConnectionRef.current.signalingState === 'have-local-offer') {
                // Caller receives answer
                console.log('📥 Setting remote description (answer)');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
              } else if (signal.type === 'ice-candidate') {
                console.log('🧊 Adding ICE candidate');
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
              }
            } catch (err) {
              console.error('❌ Error handling signal:', err);
            }
          }
        } catch (err) {
          console.error('❌ Error polling signals:', err);
        }
      }, 1000); // Poll every second

      // Store interval ref for cleanup
      channelRef.current = { unsubscribe: () => clearInterval(pollInterval) };

      if (!isMountedRef.current) {
        console.warn('⚠️ Component unmounted during setup');
        stream.getTracks().forEach(track => track.stop());
        peerConnection.close();
        clearInterval(channelRef.current?.unsubscribe);
        return;
      }

      // Check if peer connection is still valid before proceeding
      if (peerConnection.signalingState === 'closed') {
        throw new Error('Peer connection closed unexpectedly');
      }

      // If we're the caller, create and send offer
      if (isCaller) {
        console.log('📤 Creating offer (CALLER)...');
        const offer = await peerConnection.createOffer();
        
        console.log('📤 Setting local description...');
        await peerConnection.setLocalDescription(offer);
        
        console.log('📤 Sending offer to Supabase...');
        await supabase
          .from('video_signals')
          .insert({
            room_id: roomId,
            type: 'offer',
            data: offer,
            sender_id: user.id
          });
        
        console.log('✅ Offer sent successfully');
      } else {
        console.log('👂 Waiting for offer (ANSWERER)...');
      }

      if (!isMountedRef.current) {
        console.warn('⚠️ Component unmounted before completing');
        return;
      }

      setInCall(true);
      setIsConnecting(false);
      console.log('✅ Call setup complete');
    } catch (error) {
      console.error('❌ Error starting call:', error);
      if (isMountedRef.current) {
        alert('Error starting call: ' + error.message);
        setIsConnecting(false);
      }
      
      // Cleanup on error
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  };

  const endCall = () => {
    console.log('📞 Ending call');
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
    }
    
    // Stop polling
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      console.log('🔄 Stopped polling');
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      console.log('🔌 Closed peer connection');
    }

    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    console.log('✅ Call ended');
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
    }
  };

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      
      // Get current refs at cleanup time
      const currentStream = localVideoRef.current?.srcObject;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.close();
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  if (!inCall) {
    return (
      <button
        onClick={startCall}
        disabled={isConnecting}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-lg disabled:bg-gray-400"
      >
        <Video className="w-5 h-5 mr-2" />
        {isConnecting ? 'Connecting...' : 'Join Video Call'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video containers */}
      <div className="flex-1 relative">
        {/* Remote video (large) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local video (small, corner) */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
        />

        {/* Waiting message if no remote stream */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Waiting for partner to join...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4 flex justify-center gap-4">
        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white transition-colors`}
        >
          {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
        
        <button
          onClick={toggleAudio}
          className={`p-4 rounded-full ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white transition-colors`}
        >
          {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>
        
        <button
          onClick={endCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
