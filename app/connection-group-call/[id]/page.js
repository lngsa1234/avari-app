'use client';

import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAgora } from '@/hooks/useAgora';
import { useRecording } from '@/hooks/useRecording';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import {
  getConnectionGroupRoomByChannel,
  startConnectionGroupRoom,
  endConnectionGroupRoom,
  getConnectionGroupRecapData
} from '@/lib/connectionGroupHelpers';
import CallRecap from '@/components/CallRecap';

/**
 * Convert UUID string to a numeric UID for Agora
 * Agora recommends using numeric UIDs for better performance
 */
function generateNumericUid(uuidString) {
  // Simple hash function to convert UUID to a number
  let hash = 0;
  for (let i = 0; i < uuidString.length; i++) {
    const char = uuidString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return absolute value to ensure positive number
  return Math.abs(hash);
}

/**
 * Component to render a remote user's video
 * Memoized to prevent unnecessary re-renders that cause video flickering
 * Uses proper video element attributes for Safari compatibility
 */
const RemoteVideoPlayer = memo(function RemoteVideoPlayer({ remoteUser }) {
  const videoRef = useRef(null);
  const attachedTrackRef = useRef(null);
  const lastEnabledRef = useRef(true); // Track previous enabled state, default to true
  const [hasVideo, setHasVideo] = useState(!!remoteUser.videoTrack && remoteUser._videoEnabled !== false);

  useEffect(() => {
    const videoElement = videoRef.current;
    const track = remoteUser.videoTrack;
    const isEnabled = remoteUser._videoEnabled !== false; // Default to true if not set
    const wasEnabled = lastEnabledRef.current;

    // Update hasVideo state
    setHasVideo(!!track && isEnabled);

    // Check if this is an unmute transition (was disabled, now enabled)
    const justUnmuted = !wasEnabled && isEnabled;

    // Update the ref for next render
    lastEnabledRef.current = isEnabled;

    // If track is null/undefined, clean up
    if (!track) {
      if (attachedTrackRef.current) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }
      return;
    }

    // Skip if no video element
    if (!videoElement) return;

    // Only play if video is enabled
    if (!isEnabled) {
      return;
    }

    // Play the track - always replay when transitioning from disabled to enabled
    try {
      // Skip if this exact track is already attached to prevent duplicate play() calls
      if (attachedTrackRef.current === track && !justUnmuted) {
        return;
      }

      // Stop existing track if we just unmuted or if it's a different track
      if (attachedTrackRef.current && (justUnmuted || attachedTrackRef.current !== track)) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }

      track.play(videoElement, { fit: 'contain' });
      attachedTrackRef.current = track;
    } catch (e) {
      console.error('[Agora] Error playing video track:', e);
    }

    return () => {
      if (attachedTrackRef.current && videoElement) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }
    };
  }, [remoteUser.videoTrack, remoteUser.uid, remoteUser._lastUpdate, remoteUser._videoEnabled]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden relative w-full h-full min-h-0">
      {/* Always render video div so ref is available - use layering instead of display:none */}
      <div
        ref={videoRef}
        className="absolute inset-0"
        style={{
          backgroundColor: '#1f2937',
          zIndex: hasVideo ? 10 : 1
        }}
      />
      {/* Show placeholder when no video - rendered below video layer */}
      <div
        className="absolute inset-0 bg-gray-700 flex items-center justify-center"
        style={{ zIndex: hasVideo ? 1 : 10 }}
      >
        <div className="text-center">
          <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl text-white">
              {String(remoteUser.uid).charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-white text-sm">User {remoteUser.uid}</p>
          <p className="text-white text-xs opacity-70">Camera off</p>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
        User {remoteUser.uid}
      </div>
    </div>
  );
});

/**
 * Large version for speaker view
 * Memoized to prevent unnecessary re-renders
 * Uses proper video element attributes for Safari compatibility
 */
const RemoteVideoPlayerLarge = memo(function RemoteVideoPlayerLarge({ remoteUser }) {
  const videoRef = useRef(null);
  const attachedTrackRef = useRef(null);
  const lastEnabledRef = useRef(true); // Track previous enabled state, default to true
  const [hasVideo, setHasVideo] = useState(!!remoteUser.videoTrack && remoteUser._videoEnabled !== false);

  useEffect(() => {
    const videoElement = videoRef.current;
    const track = remoteUser.videoTrack;
    const isEnabled = remoteUser._videoEnabled !== false;
    const wasEnabled = lastEnabledRef.current;

    // Update hasVideo state
    setHasVideo(!!track && isEnabled);

    // Check if this is an unmute transition
    const justUnmuted = !wasEnabled && isEnabled;

    // Update the ref for next render
    lastEnabledRef.current = isEnabled;

    // If track is null/undefined, clean up
    if (!track) {
      if (attachedTrackRef.current) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }
      return;
    }

    // Skip if no video element
    if (!videoElement) return;

    // Only play if video is enabled
    if (!isEnabled) {
      return;
    }

    // Play the track - always replay when transitioning from disabled to enabled
    try {
      // Skip if this exact track is already attached to prevent duplicate play() calls
      if (attachedTrackRef.current === track && !justUnmuted) {
        return;
      }

      // Stop existing track if we just unmuted or if it's a different track
      if (attachedTrackRef.current && (justUnmuted || attachedTrackRef.current !== track)) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }

      track.play(videoElement, { fit: 'contain' });
      attachedTrackRef.current = track;
    } catch (e) {
      console.error('[Agora] Error playing video track (large):', e);
    }

    return () => {
      if (attachedTrackRef.current && videoElement) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        attachedTrackRef.current = null;
      }
    };
  }, [remoteUser.videoTrack, remoteUser.uid, remoteUser._lastUpdate, remoteUser._videoEnabled]);

  // Use absolute positioning to fill parent since h-full doesn't work with flex parents
  return (
    <>
      {/* Always render video div so ref is available - use layering instead of display:none */}
      <div
        ref={videoRef}
        className="absolute inset-0"
        style={{
          backgroundColor: '#1f2937',
          zIndex: hasVideo ? 10 : 1
        }}
      />
      {/* Show placeholder when no video - rendered below video layer */}
      <div
        className="absolute inset-0 bg-gray-700 flex items-center justify-center"
        style={{ zIndex: hasVideo ? 1 : 10 }}
      >
        <div className="text-center">
          <div className="w-32 h-32 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-5xl text-white">
              {String(remoteUser.uid).charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-white text-xl">User {remoteUser.uid}</p>
          <p className="text-white text-sm opacity-70">Camera off</p>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded z-20">
        User {remoteUser.uid}
      </div>
    </>
  );
});

/**
 * Thumbnail version for speaker view
 * Memoized to prevent unnecessary re-renders
 */
const RemoteVideoThumbnail = memo(function RemoteVideoThumbnail({ remoteUser }) {
  const videoRef = useRef(null);
  const attachedTrackRef = useRef(null);
  const lastEnabledRef = useRef(true);
  const [hasVideo, setHasVideo] = useState(!!remoteUser.videoTrack && remoteUser._videoEnabled !== false);

  useEffect(() => {
    const videoElement = videoRef.current;
    const track = remoteUser.videoTrack;
    const isEnabled = remoteUser._videoEnabled !== false;
    const wasEnabled = lastEnabledRef.current;

    setHasVideo(!!track && isEnabled);

    const justUnmuted = !wasEnabled && isEnabled;
    lastEnabledRef.current = isEnabled;

    if (!track || !videoElement || !isEnabled) return;

    try {
      // Skip if this exact track is already attached to prevent duplicate play() calls
      if (attachedTrackRef.current === track && !justUnmuted) {
        return;
      }

      // Stop existing track if we just unmuted or if it's a different track
      if (attachedTrackRef.current && (justUnmuted || attachedTrackRef.current !== track)) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {}
        attachedTrackRef.current = null;
      }

      track.play(videoElement, { fit: 'cover' });
      attachedTrackRef.current = track;
    } catch (e) {
      console.error('[Agora] Error playing thumbnail:', e);
    }

    return () => {
      if (attachedTrackRef.current && videoElement) {
        try {
          attachedTrackRef.current.stop();
        } catch (e) {}
        attachedTrackRef.current = null;
      }
    };
  }, [remoteUser.videoTrack, remoteUser.uid, remoteUser._lastUpdate, remoteUser._videoEnabled]);

  return (
    <div className="w-48 h-36 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative">
      {/* Always render video div so ref is available - use layering instead of display:none */}
      <div
        ref={videoRef}
        className="w-full h-full absolute inset-0"
        style={{
          backgroundColor: '#1f2937',
          zIndex: hasVideo ? 10 : 1
        }}
      />
      {/* Show placeholder when no video - rendered below video layer */}
      <div
        className="w-full h-full bg-gray-700 flex items-center justify-center absolute inset-0"
        style={{ zIndex: hasVideo ? 1 : 10 }}
      >
        <div className="text-center">
          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-1">
            <span className="text-sm text-white">
              {String(remoteUser.uid).charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-white text-xs">Camera off</span>
        </div>
      </div>
      <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
        User {remoteUser.uid}
      </div>
    </div>
  );
});

export default function ConnectionGroupVideoCall() {
  const params = useParams();
  const router = useRouter();
  const channelName = params.id; // This will be like "connection-group-123"

  const {
    localAudioTrack,
    localVideoTrack,
    localScreenTrack,
    remoteUsers,
    isJoined,
    isScreenSharing,
    join,
    leave,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare
  } = useAgora();

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
    toggleBlur
  } = useBackgroundBlur('agora');

  const [user, setUser] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [gridView, setGridView] = useState(true); // Grid vs speaker view
  const [showChat, setShowChat] = useState(false); // Toggle chat panel
  const [messages, setMessages] = useState([]); // Chat messages
  const [newMessage, setNewMessage] = useState(''); // Current message being typed
  const [showRecap, setShowRecap] = useState(false); // Show post-call recap
  const [recapData, setRecapData] = useState(null); // Recap data
  const localVideoRef = useRef(null);
  const localVideoThumbnailRef = useRef(null); // Separate ref for thumbnail in speaker view
  const hasInitialized = useRef(false); // Prevent double initialization
  const messagesEndRef = useRef(null); // For auto-scroll chat

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
    // Prevent duplicate initialization (React Strict Mode runs effects twice)
    if (channelName && user && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeGroupCall();
    }

    // Cleanup only on actual unmount, not Strict Mode re-render
    // We keep hasInitialized.current = true to prevent re-joining after cleanup
    return () => {
      // Only leave if we were actually joined
      if (hasInitialized.current) {
        leave();
      }
    };
  }, [channelName, user]);

  // Play local video when track is available
  useEffect(() => {
    if (localVideoTrack) {
      const remoteUsersArray = Object.values(remoteUsers);

      // In grid view, play in main ref
      if (gridView && localVideoRef.current) {
        console.log('🎬 Playing local video in grid view');
        localVideoTrack.play(localVideoRef.current);
      }
      // In speaker view, decide based on remote users
      else if (!gridView) {
        const hasRemoteVideo = remoteUsersArray.length > 0 && remoteUsersArray[0].videoTrack;

        if (hasRemoteVideo && localVideoThumbnailRef.current) {
          // Show local in thumbnail
          console.log('🎬 Playing local video in thumbnail');
          localVideoTrack.play(localVideoThumbnailRef.current);
        } else if (!hasRemoteVideo && localVideoRef.current) {
          // Show local in main area
          console.log('🎬 Playing local video in main area');
          localVideoTrack.play(localVideoRef.current);
        }
      }
    }
  }, [localVideoTrack, gridView, remoteUsers]);

  // Update participant count
  useEffect(() => {
    const count = Object.keys(remoteUsers).length + (isJoined ? 1 : 0);
    setParticipantCount(count);
    console.log('👥 Participant count:', count);
    console.log('👥 Remote users:', Object.keys(remoteUsers));
  }, [remoteUsers, isJoined]);

  const initializeGroupCall = async () => {
    try {
      console.log('🎥 Initializing connection group video call for channel:', channelName);

      // Get room and group info
      const room = await getConnectionGroupRoomByChannel(channelName);
      if (room && room.group) {
        setGroupInfo(room.group);
      }

      // Get Agora App ID from environment
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        alert('❌ Configuration Error\n\nAgora App ID not configured. Please add NEXT_PUBLIC_AGORA_APP_ID to your .env.local file.');
        return;
      }

      console.log('✅ Agora App ID found:', appId.substring(0, 8) + '...');

      // Test camera/microphone permissions first
      console.log('🎤 Checking camera and microphone permissions...');
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log('✅ Camera and microphone permissions granted');
        // Stop test stream
        testStream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('❌ Permission error:', permError);
        let errorMsg = '❌ Camera/Microphone Access Denied\n\n';

        if (permError.name === 'NotAllowedError') {
          errorMsg += 'Please allow camera and microphone access in your browser settings.\n\n';
          errorMsg += '1. Click the camera icon in your browser address bar\n';
          errorMsg += '2. Select "Allow" for camera and microphone\n';
          errorMsg += '3. Reload the page';
        } else if (permError.name === 'NotFoundError') {
          errorMsg += 'No camera or microphone found. Please connect a webcam and microphone.';
        } else if (permError.name === 'NotReadableError') {
          errorMsg += 'Camera or microphone is already in use by another application.\n\n';
          errorMsg += 'Please close other apps using your camera/microphone and try again.';
        } else {
          errorMsg += 'Error: ' + permError.message;
        }

        alert(errorMsg);
        return;
      }

      // Join Agora channel
      // Convert user ID to number (Agora prefers numeric UIDs)
      const numericUid = generateNumericUid(user.id);
      console.log('📡 Joining Agora channel:', channelName, 'with UID:', numericUid);
      await join(appId, channelName, null, numericUid);

      // Mark room as started
      await startConnectionGroupRoom(channelName);

      console.log('✅ Successfully joined connection group call');

    } catch (error) {
      console.error('❌ Error initializing connection group call:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      let errorMsg = '❌ Failed to Join Video Call\n\n';

      if (error.message && error.message.includes('INVALID_PARAMS')) {
        errorMsg += 'Invalid Agora configuration. Please check your App ID.';
      } else if (error.message && error.message.includes('NETWORK_ERROR')) {
        errorMsg += 'Network error. Please check your internet connection.';
      } else if (error.code === 'PGRST116') {
        errorMsg += 'Video room not found. The room may have been deleted.';
      } else {
        errorMsg += 'Error: ' + (error.message || 'Unknown error');
        errorMsg += '\n\nPlease check the browser console for more details.';
      }

      alert(errorMsg);
    }
  };

  const handleToggleMute = async () => {
    const newState = await toggleMute();
    setIsMuted(!newState);
  };

  const handleToggleVideo = async () => {
    const newState = await toggleVideo();
    setIsVideoOff(!newState);
  };

  const handleToggleBlur = async () => {
    if (localVideoTrack) {
      await toggleBlur(localVideoTrack);
    }
  };

  const handleLeaveCall = async () => {
    console.log('👋 Leaving connection group call...');

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Stop screen sharing if active
    if (isScreenSharing) {
      await stopScreenShare();
    }

    await endConnectionGroupRoom(channelName);
    await leave();

    // Get recap data and show recap screen
    const groupId = groupInfo?.id || channelName.replace('connection-group-', '');
    const recap = await getConnectionGroupRecapData(channelName, groupId);
    setRecapData({
      ...recap,
      startedAt: recap.startedAt || groupInfo?.started_at,
      endedAt: new Date().toISOString()
    });
    setShowRecap(true);
  };

  const handleRecapClose = () => {
    setShowRecap(false);
    router.push('/');
  };

  const handleConnectFromRecap = async (userId) => {
    try {
      // Express interest in the user
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: user.id,
          interested_in_user_id: userId
        });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        console.error('Error expressing interest:', error);
      }
      alert('Connection request sent!');
    } catch (err) {
      console.error('Error connecting:', err);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      alert('Failed to toggle screen share: ' + error.message);
    }
  };

  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        stopRecording();
      } else {
        // Get the canvas stream for recording (captures the local video)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1280;
        canvas.height = 720;

        const stream = canvas.captureStream(30);

        // Add audio from local track
        if (localAudioTrack) {
          const audioStream = localAudioTrack.getMediaStreamTrack();
          stream.addTrack(audioStream);
        }

        await startRecording(stream);
      }
    } catch (error) {
      alert('Failed to toggle recording: ' + error.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      console.log('📤 Sending message to channel:', channelName);
      const { data, error } = await supabase
        .from('call_messages')
        .insert({
          channel_name: channelName,
          user_id: user.id,
          user_name: user.email || 'Anonymous',
          message: newMessage.trim()
        })
        .select();

      if (error) throw error;

      console.log('✅ Message sent:', data);
      setNewMessage('');

      // If real-time isn't working, manually add the message
      if (data && data[0]) {
        setMessages(prev => {
          // Check if message already exists (from real-time)
          const exists = prev.some(m => m.id === data[0].id);
          if (!exists) {
            console.log('📝 Adding message manually (real-time may not be enabled)');
            return [...prev, data[0]];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message: ' + error.message);
    }
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!channelName || !user) return;

    // Load existing messages
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('call_messages')
        .select('*')
        .eq('channel_name', channelName)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data) {
        setMessages(data);
      }
    };

    loadMessages();

    // Subscribe to new messages
    console.log('🔌 Setting up real-time subscription for channel:', channelName);
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
          console.log('📨 Real-time message received:', payload.new);
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(m => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from real-time channel');
      supabase.removeChannel(channel);
    };
  }, [channelName, user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert remoteUsers object to array for rendering
  const remoteUsersList = Object.values(remoteUsers);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Global styles for Agora video elements */}
      <style jsx global>{`
        /* Ensure Agora video elements fill their containers */
        [class*="agora_video"] video,
        div[id*="video"] video,
        div[id*="agora"] video,
        video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        /* Ensure Agora's container divs also fill their parents */
        [class*="agora_video"],
        div[id*="video_"],
        div[id*="agora-video"] {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👥</span>
            <div>
              <h1 className="text-white font-bold text-xl">Connection Group</h1>
              <p className="text-purple-100 text-sm">
                {groupInfo ? groupInfo.name : 'Loading...'}
              </p>
              <p className="text-purple-100 text-xs">
                {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGridView(!gridView)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              {gridView ? '👤 Speaker' : '📱 Grid'}
            </button>
            <button
              onClick={handleLeaveCall}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-3" style={{ display: 'flex', flexDirection: 'column' }}>
        {gridView ? (
          // Grid View - Show all participants in a grid
          <div
            className={`w-full flex-1 grid gap-2 ${
              participantCount === 1 ? 'grid-cols-1' :
              participantCount === 2 ? 'grid-cols-2' :
              participantCount <= 4 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}
            style={{
              gridTemplateRows: participantCount === 1 ? '1fr' :
                               participantCount === 2 ? '1fr' :
                               participantCount <= 4 ? 'repeat(2, 1fr)' :
                               'repeat(2, 1fr)',
              minHeight: 0
            }}
          >
            {/* Local Video */}
            <div className="bg-gray-800 rounded-lg overflow-hidden relative w-full h-full min-h-0">
              <div
                ref={localVideoRef}
                className="absolute inset-0"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-700 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-2xl text-white">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-white text-sm">You (Camera off)</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
                You {isMuted && '🔇'}
              </div>
            </div>

            {/* Remote Videos */}
            {remoteUsersList.map((remoteUser) => (
              <RemoteVideoPlayer
                key={remoteUser.uid}
                remoteUser={remoteUser}
              />
            ))}
          </div>
        ) : (
          // Speaker View - Main speaker + thumbnails
          <div className="flex-1 flex flex-col gap-2 relative min-h-0">
            {/* Main Speaker (first remote user or local) */}
            <div className="flex-1 min-h-0 bg-gray-800 rounded-lg overflow-hidden relative">
              {remoteUsersList.length > 0 ? (
                // Show first remote user - component handles camera off state
                <RemoteVideoPlayerLarge remoteUser={remoteUsersList[0]} />
              ) : (
                // No remote users, show local
                <>
                  {isVideoOff ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-32 h-32 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <span className="text-5xl text-white">
                            {user?.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white text-xl">You (Camera off)</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={localVideoRef}
                      className="w-full h-full"
                    />
                  )}
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded">
                    You {isMuted && '🔇'}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ minHeight: '144px' }}>
              {/* Local thumbnail - show if remote user is in main area */}
              {remoteUsersList.length > 0 && (
                <div className="w-48 h-36 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                  {isVideoOff ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-1">
                          <span className="text-lg text-white">
                            {user?.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white text-xs">Camera off</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full" ref={localVideoThumbnailRef} />
                  )}
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                    You {isMuted && '🔇'}
                  </div>
                </div>
              )}

              {/* Remote thumbnails */}
              {remoteUsersList.slice(1).map((remoteUser) => (
                <RemoteVideoThumbnail key={remoteUser.uid} remoteUser={remoteUser} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 py-3 px-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left side - Recording indicator */}
          <div className="w-32">
            {isRecording && (
              <div className="flex items-center text-red-500 text-sm">
                <span className="animate-pulse mr-2">⏺</span>
                {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {/* Center - Main controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMute}
              className={`${
                isMuted ? 'bg-red-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`${
                isVideoOff ? 'bg-red-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              📹
            </button>

            {isBlurSupported && (
              <button
                onClick={handleToggleBlur}
                disabled={blurLoading || isVideoOff}
                className={`${
                  isBlurEnabled ? 'bg-blue-600' : 'bg-gray-700'
                } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
              >
                {blurLoading ? '⏳' : '🌫️'}
              </button>
            )}

            <button
              onClick={handleToggleScreenShare}
              className={`${
                isScreenSharing ? 'bg-blue-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              🖥️
            </button>

            <button
              onClick={handleToggleRecording}
              className={`${
                isRecording ? 'bg-red-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              ⏺
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className={`${
                showChat ? 'bg-purple-600' : 'bg-gray-700'
              } hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center relative`}
              title="Toggle chat"
            >
              💬
              {messages.length > 0 && !showChat && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {messages.length}
                </span>
              )}
            </button>

            <button
              onClick={handleLeaveCall}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-medium transition"
            >
              Leave
            </button>
          </div>

          {/* Right side - Spacer */}
          <div className="w-32"></div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-50">
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
                    msg.user_id === user?.id
                      ? 'ml-auto bg-purple-600'
                      : 'mr-auto bg-gray-700'
                  } max-w-[85%] rounded-lg p-3`}
                >
                  <p className="text-xs text-gray-300 mb-1">
                    {msg.user_id === user?.id ? 'You' : msg.user_name}
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

      {/* Post-Call Recap */}
      {showRecap && recapData && (
        <CallRecap
          channelName={channelName}
          startedAt={recapData.startedAt}
          endedAt={recapData.endedAt}
          participants={recapData.participants}
          currentUserId={user?.id}
          onClose={handleRecapClose}
          onConnect={handleConnectFromRecap}
        />
      )}
    </div>
  );
}
