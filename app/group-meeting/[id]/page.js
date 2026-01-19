'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecording } from '@/hooks/useRecording';
import useTranscription from '@/hooks/useTranscription';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import { getAgoraRoomByChannel, startAgoraRoom, endAgoraRoom, getCallRecapData } from '@/lib/agoraHelpers';
import { saveCallRecap, saveProviderMetrics } from '@/lib/callRecapHelpers';
import CallRecap from '@/components/CallRecap';

/**
 * Remote Video Player Component - Memoized to prevent re-renders
 * Defined outside main component to maintain stable refs
 */
const RemoteVideoPlayer = memo(function RemoteVideoPlayer({ participant }) {
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const audioRef = useRef(null);
  const attachedVideoTrackRef = useRef(null);
  const attachedScreenTrackRef = useRef(null);
  const attachedAudioTrackRef = useRef(null);
  const videoTrackSid = useRef(null);
  const screenTrackSid = useRef(null);
  const audioTrackSid = useRef(null);

  // Handle video track - use track SID for stable comparison
  useEffect(() => {
    const videoElement = videoRef.current;
    const track = participant.videoTrack;
    const trackSid = track?.sid || track?.mediaStreamTrack?.id;

    // Skip if no video element or same track already attached
    if (!videoElement) return;
    if (trackSid && trackSid === videoTrackSid.current) return;

    // Detach previous track if different
    if (attachedVideoTrackRef.current && attachedVideoTrackRef.current !== track) {
      try {
        attachedVideoTrackRef.current.detach(videoElement);
      } catch (e) {
        // Ignore detach errors
      }
      attachedVideoTrackRef.current = null;
      videoTrackSid.current = null;
    }

    // Attach new track
    if (track && track !== attachedVideoTrackRef.current) {
      try {
        track.attach(videoElement);
        attachedVideoTrackRef.current = track;
        videoTrackSid.current = trackSid;

        // Safari needs explicit play() call - only call once
        videoElement.play().catch(() => {
          videoElement.muted = true;
          videoElement.play().catch(() => {});
        });
      } catch (e) {
        console.error('[LiveKit] Error attaching video track:', e);
      }
    }

    return () => {
      if (attachedVideoTrackRef.current && videoElement) {
        try {
          attachedVideoTrackRef.current.detach(videoElement);
        } catch (e) {
          // Ignore detach errors
        }
        attachedVideoTrackRef.current = null;
        videoTrackSid.current = null;
      }
    };
  }, [participant.videoTrack]);

  // Handle screen share track
  useEffect(() => {
    const screenElement = screenRef.current;
    const track = participant.screenTrack;
    const trackSid = track?.sid || track?.mediaStreamTrack?.id;

    // Skip if no screen element or same track already attached
    if (!screenElement) return;
    if (trackSid && trackSid === screenTrackSid.current) return;

    // Detach previous track if different
    if (attachedScreenTrackRef.current && attachedScreenTrackRef.current !== track) {
      try {
        attachedScreenTrackRef.current.detach(screenElement);
      } catch (e) {
        // Ignore detach errors
      }
      attachedScreenTrackRef.current = null;
      screenTrackSid.current = null;
    }

    // Attach new track
    if (track && track !== attachedScreenTrackRef.current) {
      try {
        track.attach(screenElement);
        attachedScreenTrackRef.current = track;
        screenTrackSid.current = trackSid;

        screenElement.play().catch(() => {
          screenElement.muted = true;
          screenElement.play().catch(() => {});
        });
      } catch (e) {
        console.error('[LiveKit] Error attaching screen track:', e);
      }
    }

    return () => {
      if (attachedScreenTrackRef.current && screenElement) {
        try {
          attachedScreenTrackRef.current.detach(screenElement);
        } catch (e) {
          // Ignore detach errors
        }
        attachedScreenTrackRef.current = null;
        screenTrackSid.current = null;
      }
    };
  }, [participant.screenTrack]);

  // Handle audio track
  useEffect(() => {
    const audioElement = audioRef.current;
    const track = participant.audioTrack;
    const trackSid = track?.sid || track?.mediaStreamTrack?.id;

    // Skip if no audio element or same track already attached
    if (!audioElement) return;
    if (trackSid && trackSid === audioTrackSid.current) return;

    // Detach previous track if different
    if (attachedAudioTrackRef.current && attachedAudioTrackRef.current !== track) {
      try {
        attachedAudioTrackRef.current.detach(audioElement);
      } catch (e) {
        // Ignore detach errors
      }
      attachedAudioTrackRef.current = null;
      audioTrackSid.current = null;
    }

    // Attach new track
    if (track && track !== attachedAudioTrackRef.current) {
      try {
        track.attach(audioElement);
        attachedAudioTrackRef.current = track;
        audioTrackSid.current = trackSid;
      } catch (e) {
        console.error('[LiveKit] Error attaching audio track:', e);
      }
    }

    return () => {
      if (attachedAudioTrackRef.current && audioElement) {
        try {
          attachedAudioTrackRef.current.detach(audioElement);
        } catch (e) {
          // Ignore detach errors
        }
        attachedAudioTrackRef.current = null;
        audioTrackSid.current = null;
      }
    };
  }, [participant.audioTrack]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden relative w-full h-full min-h-0">
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Screen share takes priority when available */}
      {participant.hasScreen ? (
        <video
          ref={screenRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
          style={{ backgroundColor: '#1f2937' }}
        />
      ) : participant.hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#1f2937' }}
        />
      ) : (
        <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl text-white">
                {(participant.name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-white text-sm">{participant.name}</p>
            <p className="text-white text-xs opacity-70">Camera off</p>
          </div>
        </div>
      )}

      {/* Hidden video element for camera when screen sharing (keeps track attached) */}
      {participant.hasScreen && participant.hasVideo && (
        <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      )}

      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
        {participant.name} {participant.isSpeaking && '🔊'} {participant.hasScreen && '🖥️'}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these change
  return (
    prevProps.participant.id === nextProps.participant.id &&
    prevProps.participant.hasVideo === nextProps.participant.hasVideo &&
    prevProps.participant.hasAudio === nextProps.participant.hasAudio &&
    prevProps.participant.hasScreen === nextProps.participant.hasScreen &&
    prevProps.participant.videoTrack === nextProps.participant.videoTrack &&
    prevProps.participant.audioTrack === nextProps.participant.audioTrack &&
    prevProps.participant.screenTrack === nextProps.participant.screenTrack
  );
});

/**
 * Group Video Meeting - Uses LiveKit for large meetups
 *
 * Provider: LiveKit (configured in lib/videoProviders/index.js)
 */
export default function GroupVideoMeeting() {
  const params = useParams();
  const router = useRouter();
  const channelName = params.id;

  // LiveKit state
  const [room, setRoom] = useState(null);
  const [localParticipant, setLocalParticipant] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Track state
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // UI state
  const [user, setUser] = useState(null);
  const [meetupInfo, setMeetupInfo] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [gridView, setGridView] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState(
    process.env.NEXT_PUBLIC_TRANSCRIPTION_LANGUAGE || 'en-US'
  );
  const [pendingLanguageRestart, setPendingLanguageRestart] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const hasInitialized = useRef(false);
  const isInitializing = useRef(false);
  const messagesEndRef = useRef(null);
  const roomRef = useRef(null);
  const participantTracksRef = useRef(new Map()); // Stable track storage
  const callStartTimeRef = useRef(null); // Store start time in ref for reliable access
  const updateDebounceRef = useRef(null); // Debounce timer for participant updates
  const screenTrackRef = useRef(null); // Store screen share track for cleanup

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
  } = useBackgroundBlur('livekit');

  // Handle transcript from speech recognition
  const handleTranscript = useCallback(({ text, isFinal, timestamp }) => {
    if (isFinal && text.trim()) {
      setTranscript(prev => [...prev, {
        speakerId: user?.id || 'local',
        speakerName: user?.email?.split('@')[0] || 'You',
        text: text.trim(),
        timestamp,
        isFinal: true
      }]);
      console.log('[Transcription]', text);
    }
  }, [user]);

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
    interimResults: false // Only capture final results for cleaner transcript
  });

  // Handle language change - restart transcription if active
  const handleLanguageChange = useCallback((newLanguage) => {
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
      setPendingLanguageRestart(true);
    }
    setTranscriptionLanguage(newLanguage);
  }, [isTranscribing, stopListening]);

  // Restart transcription after language change (runs after re-render with new language)
  useEffect(() => {
    if (pendingLanguageRestart) {
      setPendingLanguageRestart(false);
      const started = startListening();
      if (started) {
        setIsTranscribing(true);
        console.log('[Transcription] Restarted with language:', transcriptionLanguage);
      }
    }
  }, [pendingLanguageRestart, startListening, transcriptionLanguage]);

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

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
      } else {
        router.push('/');
      }
    });
  }, [router]);

  // Initialize LiveKit call
  useEffect(() => {
    if (channelName && user && !hasInitialized.current && !isInitializing.current) {
      initializeLiveKitCall();
    }

    return () => {
      // Only cleanup if we actually initialized
      if (hasInitialized.current) {
        leaveCall();
      }
    };
  }, [channelName, user]);

  const initializeLiveKitCall = async () => {
    // Prevent double initialization (React StrictMode)
    if (isInitializing.current || hasInitialized.current) {
      console.log('[LiveKit] Skipping duplicate initialization');
      return;
    }
    isInitializing.current = true;

    try {
      setIsConnecting(true);
      console.log('[LiveKit] Initializing group video call for channel:', channelName);

      // Get room info
      const roomInfo = await getAgoraRoomByChannel(channelName);
      if (roomInfo && roomInfo.meetups) {
        setMeetupInfo(roomInfo.meetups);
      }

      // Check for LiveKit URL
      const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!liveKitUrl) {
        throw new Error('LiveKit URL not configured. Please add NEXT_PUBLIC_LIVEKIT_URL to your .env.local file.');
      }

      // Check camera/microphone permissions
      console.log('[LiveKit] Checking camera and microphone permissions...');
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        testStream.getTracks().forEach(track => track.stop());
        console.log('[LiveKit] Camera and microphone permissions granted');
      } catch (permError) {
        handlePermissionError(permError);
        return;
      }

      // Dynamic import LiveKit
      const { Room, RoomEvent, VideoPresets } = await import('livekit-client');

      // Create room instance
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      roomRef.current = newRoom;
      setRoom(newRoom);

      // Set up event handlers
      setupRoomEventHandlers(newRoom, RoomEvent);

      // Get token from API
      console.log('[LiveKit] Fetching access token...');
      const tokenResponse = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: channelName,
          participantId: user.id,
          participantName: user.email || 'Anonymous'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token } = await tokenResponse.json();

      // Connect to room
      console.log('[LiveKit] Connecting to room:', channelName);
      await newRoom.connect(liveKitUrl, token);

      setLocalParticipant(newRoom.localParticipant);
      const startTime = new Date().toISOString();
      setCallStartTime(startTime);
      callStartTimeRef.current = startTime; // Also store in ref for reliable access

      // Enable camera and microphone
      console.log('[LiveKit] Enabling camera and microphone...');
      await newRoom.localParticipant.enableCameraAndMicrophone();

      // Get local tracks
      const camTrack = newRoom.localParticipant.getTrackPublication('camera');
      const micTrack = newRoom.localParticipant.getTrackPublication('microphone');

      if (camTrack?.track) setLocalVideoTrack(camTrack.track);
      if (micTrack?.track) setLocalAudioTrack(micTrack.track);

      setIsConnected(true);
      setIsConnecting(false);
      hasInitialized.current = true;
      isInitializing.current = false;

      // Mark room as started in database
      await startAgoraRoom(channelName);

      console.log('[LiveKit] Successfully joined group call');

      // Auto-enable transcription for recap summary (skip Safari - doesn't work well)
      if (isSpeechSupported && !isSafari) {
        const started = startListening();
        if (started) {
          setIsTranscribing(true);
          console.log('[Transcription] Auto-started for recap');
        }
      } else if (isSafari) {
        console.log('[Transcription] Skipped auto-start on Safari (limited support)');
      }

    } catch (error) {
      console.error('[LiveKit] Error initializing call:', error);
      setIsConnecting(false);
      isInitializing.current = false;
      alert('Failed to join video call: ' + error.message);
    }
  };

  const setupRoomEventHandlers = (room, RoomEvent) => {
    // Participant connected
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('[LiveKit] Participant connected:', participant.identity);
      updateParticipantsList(room);
    });

    // Participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('[LiveKit] Participant disconnected:', participant.identity);
      updateParticipantsList(room);
    });

    // Track subscribed
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity);
      updateParticipantsList(room);
    });

    // Track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('[LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity);
      updateParticipantsList(room);
    });

    // Active speakers changed
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      // Could be used for speaker view highlighting
    });

    // Data received (for transcription)
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'transcription') {
          setTranscript(prev => [...prev, {
            speakerId: participant?.identity || 'unknown',
            speakerName: participant?.name || 'Unknown',
            text: data.text,
            timestamp: Date.now(),
            isFinal: data.isFinal
          }]);
        }
      } catch (e) {
        // Not JSON or not transcription
      }
    });

    // Connection quality changed
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === room.localParticipant) {
        setMetrics(prev => ({
          ...prev,
          connectionQuality: quality
        }));
      }
    });

    // Disconnected
    room.on(RoomEvent.Disconnected, (reason) => {
      console.log('[LiveKit] Disconnected:', reason);
      setIsConnected(false);
    });

    // Reconnecting
    room.on(RoomEvent.Reconnecting, () => {
      console.log('[LiveKit] Reconnecting...');
    });

    // Reconnected
    room.on(RoomEvent.Reconnected, () => {
      console.log('[LiveKit] Reconnected - refreshing participants');
      setIsConnected(true);
      // Force refresh participant list after reconnection
      updateParticipantsList(room);
    });

    // Track muted/unmuted - refresh participant state
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      console.log('[LiveKit] Track muted:', publication.kind, 'from', participant.identity);
      updateParticipantsList(room);
    });

    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('[LiveKit] Track unmuted:', publication.kind, 'from', participant.identity);
      updateParticipantsList(room);
    });
  };

  // Core function to update participants list
  const doUpdateParticipantsList = useCallback((room) => {
    if (!room || room.state === 'disconnected') {
      return;
    }

    const participants = Array.from(room.remoteParticipants.values()).map(p => {
      const videoPublication = p.getTrackPublication('camera');
      const audioPublication = p.getTrackPublication('microphone');
      const screenPublication = p.getTrackPublication('screen_share');

      // Store tracks in ref for stability
      const existingTracks = participantTracksRef.current.get(p.identity) || {};
      const videoTrack = videoPublication?.track || existingTracks.videoTrack;
      const audioTrack = audioPublication?.track || existingTracks.audioTrack;
      const screenTrack = screenPublication?.track || existingTracks.screenTrack;

      participantTracksRef.current.set(p.identity, { videoTrack, audioTrack, screenTrack });

      return {
        id: p.identity,
        name: p.name || p.identity,
        videoTrack,
        audioTrack,
        screenTrack,
        isSpeaking: p.isSpeaking,
        // Track publication state for UI
        hasVideo: !!videoPublication?.track,
        hasAudio: !!audioPublication?.track,
        hasScreen: !!screenPublication?.track
      };
    });

    // Clean up tracks for participants that left
    const currentIds = new Set(participants.map(p => p.id));
    for (const id of participantTracksRef.current.keys()) {
      if (!currentIds.has(id)) {
        participantTracksRef.current.delete(id);
      }
    }

    // Only update state if participants actually changed to prevent video flickering
    setRemoteParticipants(prev => {
      // Check if participant list changed
      if (prev.length !== participants.length) {
        return participants;
      }

      // Check if any participant's key properties changed
      const hasChanges = participants.some((p, i) => {
        const existing = prev[i];
        return !existing ||
               existing.id !== p.id ||
               existing.hasVideo !== p.hasVideo ||
               existing.hasAudio !== p.hasAudio ||
               existing.hasScreen !== p.hasScreen;
      });

      return hasChanges ? participants : prev;
    });

    setParticipantCount(participants.length + 1);
  }, []);

  // Debounced wrapper to batch rapid track events
  const updateParticipantsList = useCallback((room) => {
    if (!room || room.state === 'disconnected') {
      console.log('[LiveKit] Skipping participant update - room disconnected');
      return;
    }

    // Clear any pending update
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current);
    }

    // Debounce updates to prevent flickering during initial connection
    updateDebounceRef.current = setTimeout(() => {
      doUpdateParticipantsList(room);
      updateDebounceRef.current = null;
    }, 100); // 100ms debounce
  }, [doUpdateParticipantsList]);

  const handlePermissionError = (permError) => {
    let errorMsg = 'Camera/Microphone Access Denied\n\n';
    if (permError.name === 'NotAllowedError') {
      errorMsg += 'Please allow camera and microphone access in your browser settings.';
    } else if (permError.name === 'NotFoundError') {
      errorMsg += 'No camera or microphone found.';
    } else if (permError.name === 'NotReadableError') {
      errorMsg += 'Camera or microphone is already in use.';
    } else {
      errorMsg += permError.message;
    }
    alert(errorMsg);
    setIsConnecting(false);
    isInitializing.current = false;
  };

  const leaveCall = async () => {
    console.log('[LiveKit] Leaving call, cleaning up...');

    // Clear any pending debounced update
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current);
      updateDebounceRef.current = null;
    }

    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (e) {
        console.error('[LiveKit] Error disconnecting:', e);
      }
      roomRef.current = null;
    }

    // Clear track references
    participantTracksRef.current.clear();

    // Reset initialization flags
    hasInitialized.current = false;
    isInitializing.current = false;

    setRoom(null);
    setLocalParticipant(null);
    setRemoteParticipants([]);
    setIsConnected(false);
  };

  const handleToggleMute = async () => {
    if (localParticipant) {
      const newState = !isMuted;
      await localParticipant.setMicrophoneEnabled(!newState);
      setIsMuted(newState);
    }
  };

  const handleToggleVideo = async () => {
    if (localParticipant) {
      const newState = !isVideoOff;
      await localParticipant.setCameraEnabled(!newState);
      setIsVideoOff(newState);
    }
  };

  const handleToggleBlur = async () => {
    if (localVideoTrack) {
      await toggleBlur(localVideoTrack);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!localParticipant) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenTrackRef.current) {
          await localParticipant.unpublishTrack(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current = null;
        }
        setIsScreenSharing(false);
      } else {
        // Start screen sharing - manually request permission first for better browser compatibility
        // This ensures getDisplayMedia is called directly in the click handler
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        // Now publish the screen track to LiveKit
        const { LocalVideoTrack, Track } = await import('livekit-client');
        const screenTrack = new LocalVideoTrack(screenStream.getVideoTracks()[0]);
        screenTrackRef.current = screenTrack;
        await localParticipant.publishTrack(screenTrack, {
          name: 'screen',
          source: Track.Source.ScreenShare
        });

        setIsScreenSharing(true);
        console.log('[LiveKit] Screen share published successfully');

        // Handle when user stops sharing via browser UI
        screenStream.getVideoTracks()[0].onended = async () => {
          console.log('[LiveKit] Screen share stopped by user');
          if (screenTrackRef.current) {
            await localParticipant.unpublishTrack(screenTrackRef.current);
            screenTrackRef.current = null;
          }
          setIsScreenSharing(false);
        };
      }
    } catch (error) {
      console.error('[LiveKit] Screen share error:', error);

      if (error.name === 'NotAllowedError') {
        const isMac = navigator.platform?.toUpperCase().includes('MAC');
        if (isMac) {
          alert('Screen sharing requires permission.\n\nGo to: System Settings → Privacy & Security → Screen Recording\n\nEnable your browser and restart it.');
        } else {
          alert('Screen sharing was blocked. Please allow screen sharing when prompted.');
        }
      } else {
        alert('Failed to share screen: ' + error.message);
      }
    }
  };

  const handleLeaveCall = async () => {
    console.log('[LiveKit] Leaving group call...');

    if (isRecording) {
      stopRecording();
    }

    // Stop screen sharing if active
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    // Stop transcription if active
    if (isTranscribing) {
      stopListening();
      setIsTranscribing(false);
    }

    // Capture LiveKit participants BEFORE leaving the call (include current user)
    const liveKitParticipantIds = [
      user?.id,  // Include current user
      ...remoteParticipants.map(p => p.id)
    ].filter(Boolean);
    console.log('[LiveKit] Captured participant IDs for recap:', liveKitParticipantIds);

    await endAgoraRoom(channelName);
    await leaveCall();

    // Prepare recap data
    const meetupId = meetupInfo?.id || channelName.replace('meetup-', '');
    const recap = await getCallRecapData(channelName, meetupId);

    // Fetch profile data for LiveKit participants if not already in recap
    let allParticipants = recap.participants || [];
    if (liveKitParticipantIds.length > 0) {
      const existingIds = new Set(allParticipants.map(p => p.id));
      const newIds = liveKitParticipantIds.filter(id => !existingIds.has(id));

      if (newIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, profile_picture, career')
            .in('id', newIds);

          if (profiles) {
            allParticipants = [...allParticipants, ...profiles];
          }
        } catch (e) {
          console.error('Failed to fetch participant profiles:', e);
        }
      }
    }

    const endTime = new Date().toISOString();

    // Use ref value for reliable start time (state might be stale in closure)
    const actualStartTime = callStartTimeRef.current || callStartTime || recap.startedAt;
    console.log('[Recap] Start time:', actualStartTime, 'End time:', endTime);
    console.log('[Recap] Transcript entries:', transcript.length);

    setRecapData({
      ...recap,
      participants: allParticipants,
      callType: 'meetup',
      provider: 'livekit',
      startedAt: actualStartTime,
      endedAt: endTime,
      transcript: transcript,
      metrics: metrics
    });

    // Save recap to database
    let savedRecapId = null;
    try {
      const savedRecap = await saveCallRecap({
        channelName,
        callType: 'meetup',
        provider: 'livekit',
        startedAt: actualStartTime,
        endedAt: endTime,
        participants: allParticipants,
        transcript: transcript,
        metrics: metrics,
        userId: user?.id
      });
      savedRecapId = savedRecap?.id;
    } catch (e) {
      console.error('Failed to save recap:', e);
    }

    // Generate AI connection and group recommendations
    if (allParticipants.length >= 2) {
      try {
        // Fetch full profiles for recommendation generation
        const participantIds = allParticipants.map(p => p.id).filter(Boolean);
        const { data: fullProfiles } = await supabase
          .from('profiles')
          .select('id, name, email, career, bio, profile_picture')
          .in('id', participantIds);

        // Fetch existing connection groups for join recommendations
        const { data: existingGroups } = await supabase
          .from('connection_groups')
          .select('id, name, creator_id, is_active')
          .eq('is_active', true)
          .limit(50);

        // Call recommendations API
        await fetch('/api/generate-connection-recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callRecapId: savedRecapId,
            meetupId: meetupInfo?.id || meetupId,
            channelName,
            transcript: transcript,
            participants: fullProfiles || allParticipants,
            existingGroups: existingGroups || []
          })
        });
        console.log('[LiveKit] Connection recommendations generated');
      } catch (e) {
        console.error('Failed to generate recommendations:', e);
      }
    }

    setShowRecap(true);
  };

  const handleRecapClose = () => {
    setShowRecap(false);
    router.push('/');
  };

  const handleConnectFromRecap = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_interests')
        .insert({
          user_id: user.id,
          interested_in_user_id: userId
        });

      if (error && error.code !== '23505') {
        console.error('Error expressing interest:', error);
      }
      alert('Connection request sent!');
    } catch (err) {
      console.error('Error connecting:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
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
      setNewMessage('');

      if (data && data[0]) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data[0].id);
          if (!exists) return [...prev, data[0]];
          return prev;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load and subscribe to messages
  useEffect(() => {
    if (!channelName || !user) return;

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

    const channel = supabase
      .channel(`call-messages-${channelName}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_messages',
        filter: `channel_name=eq.${channelName}`
      }, (payload) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, user]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Play local video with Safari support
  const localAttachedTrackRef = useRef(null);

  useEffect(() => {
    const videoElement = localVideoRef.current;
    const track = localVideoTrack;

    if (!videoElement) return;

    // Detach previous track if different or video turned off
    if (localAttachedTrackRef.current && (localAttachedTrackRef.current !== track || isVideoOff)) {
      try {
        localAttachedTrackRef.current.detach(videoElement);
      } catch (e) {
        console.log('[LiveKit] Error detaching local video:', e);
      }
      localAttachedTrackRef.current = null;
    }

    // Attach new track if video is on
    if (track && !isVideoOff && track !== localAttachedTrackRef.current) {
      try {
        track.attach(videoElement);
        localAttachedTrackRef.current = track;

        // Safari needs explicit play() call
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.log('[LiveKit] Local video autoplay prevented:', e);
          });
        }
      } catch (e) {
        console.error('[LiveKit] Error attaching local video:', e);
      }
    }

    return () => {
      if (localAttachedTrackRef.current && videoElement) {
        try {
          localAttachedTrackRef.current.detach(videoElement);
        } catch (e) {
          console.log('[LiveKit] Error detaching local video on cleanup:', e);
        }
        localAttachedTrackRef.current = null;
      }
    };
  }, [localVideoTrack, isVideoOff]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☕</span>
            <div>
              <h1 className="text-white font-bold text-xl">Avari Group Meetup</h1>
              <p className="text-rose-100 text-sm">
                {meetupInfo ? `${meetupInfo.date} at ${meetupInfo.time}` : 'Loading...'}
              </p>
              <p className="text-rose-100 text-xs">
                {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
                <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">LiveKit</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnecting && (
              <span className="text-white text-sm animate-pulse">Connecting...</span>
            )}
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
      <div className="flex-1 p-3 relative" style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className={`w-full flex-1 grid gap-2 ${
            participantCount === 1 ? 'grid-cols-1' :
            participantCount === 2 ? 'grid-cols-2' :
            participantCount <= 4 ? 'grid-cols-2' :
            participantCount <= 6 ? 'grid-cols-3' :
            'grid-cols-4'
          }`}
          style={{ minHeight: 0 }}
        >
          {/* Local Video */}
          <div className="bg-gray-800 rounded-lg overflow-hidden relative w-full h-full min-h-0">
            {!isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
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
          {remoteParticipants.map((participant) => (
            <RemoteVideoPlayer
              key={participant.id}
              participant={participant}
            />
          ))}
        </div>

        {/* Live Transcript Overlay */}
        {isTranscribing && transcript.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
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
      </div>

      {/* Controls */}
      <div className="bg-gray-800 py-3 px-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="w-40">
            {isRecording && (
              <div className="flex items-center text-red-500 text-sm">
                <span className="animate-pulse mr-2">⏺</span>
                {formatTime(recordingTime)}
              </div>
            )}
            {isTranscribing && !isRecording && (
              <div className="flex items-center text-green-400 text-sm">
                <span className="animate-pulse mr-2">📝</span>
                Transcribing...
              </div>
            )}
            {isTranscribing && isRecording && (
              <div className="flex items-center text-green-400 text-xs mt-1">
                <span className="mr-1">📝</span>
                + Transcribing
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMute}
              className={`${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              📹
            </button>

            {isBlurSupported && (
              <button
                onClick={handleToggleBlur}
                disabled={blurLoading || isVideoOff}
                className={`${isBlurEnabled ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isBlurEnabled ? 'Disable blur' : 'Enable background blur'}
              >
                {blurLoading ? '⏳' : '🌫️'}
              </button>
            )}

            <button
              onClick={handleToggleScreenShare}
              className={`${isScreenSharing ? 'bg-blue-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              🖥️
            </button>

            {/* Transcription toggle with language selector */}
            {isSpeechSupported && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (isSafari && !isTranscribing) {
                      alert('⚠️ Safari has limited speech recognition support. Transcription may not work properly. For best results, use Chrome.');
                    }
                    toggleTranscription();
                  }}
                  className={`${isTranscribing ? 'bg-green-600' : isSafari ? 'bg-yellow-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center relative`}
                  title={isSafari ? 'Transcription (limited on Safari)' : isTranscribing ? 'Stop transcription' : 'Start transcription'}
                >
                  📝
                  {isTranscribing && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  )}
                  {isSafari && !isTranscribing && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" title="Limited support on Safari"></span>
                  )}
                </button>
                <select
                  value={transcriptionLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-gray-700 text-white text-xs rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                  title="Transcription language"
                >
                  <option value="en-US">EN</option>
                  <option value="zh-CN">中文</option>
                </select>
              </div>
            )}

            <button
              onClick={() => setShowChat(!showChat)}
              className={`${showChat ? 'bg-purple-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center relative`}
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

          <div className="w-32"></div>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-50">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-8">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${msg.user_id === user?.id ? 'ml-auto bg-purple-600' : 'mr-auto bg-gray-700'} max-w-[85%] rounded-lg p-3`}
                >
                  <p className="text-xs text-gray-300 mb-1">
                    {msg.user_id === user?.id ? 'You' : msg.user_name}
                  </p>
                  <p className="text-white text-sm break-words">{msg.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

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
          callType="meetup"
          provider="livekit"
          startedAt={recapData.startedAt}
          endedAt={recapData.endedAt}
          participants={recapData.participants}
          currentUserId={user?.id}
          transcript={recapData.transcript}
          metrics={recapData.metrics}
          onClose={handleRecapClose}
          onConnect={handleConnectFromRecap}
          meetupId={meetupInfo?.id}
        />
      )}
    </div>
  );
}
