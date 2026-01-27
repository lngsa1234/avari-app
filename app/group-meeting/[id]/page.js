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
  const [isVideoFrozen, setIsVideoFrozen] = useState(false);
  const lastTimeUpdateRef = useRef(Date.now());
  const frozenCheckIntervalRef = useRef(null);

  // Handle video track - use track SID for stable comparison
  useEffect(() => {
    let isMounted = true; // Track mount state to handle StrictMode
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

        // Safari needs explicit play() call
        videoElement.play().catch(e => {
          // Ignore AbortError - expected during StrictMode unmount
          if (e.name === 'AbortError') return;
          // Try muted playback for other autoplay restrictions
          if (isMounted) {
            videoElement.muted = true;
            videoElement.play().catch(() => {});
          }
        });
      } catch (e) {
        if (isMounted) {
          console.error('[LiveKit] Error attaching video track:', e);
        }
      }
    }

    return () => {
      isMounted = false;
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

  // Detect frozen video and attempt recovery
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      lastTimeUpdateRef.current = Date.now();
      if (isVideoFrozen) {
        setIsVideoFrozen(false);
        console.log('[LiveKit] Video recovered for', participant.name);
      }
    };

    const handleStalled = () => {
      console.log('[LiveKit] Video stalled for', participant.name);
      setIsVideoFrozen(true);
      // Try to recover by re-playing
      videoElement.play().catch(() => {});
    };

    const handleWaiting = () => {
      console.log('[LiveKit] Video waiting for', participant.name);
    };

    // Check for frozen video every 3 seconds
    frozenCheckIntervalRef.current = setInterval(() => {
      const timeSinceUpdate = Date.now() - lastTimeUpdateRef.current;
      if (timeSinceUpdate > 5000 && participant.videoTrack && !videoElement.paused) {
        console.log('[LiveKit] Video appears frozen for', participant.name, '- attempting recovery');
        setIsVideoFrozen(true);
        // Try to recover
        videoElement.play().catch(() => {});
      }
    }, 3000);

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('stalled', handleStalled);
    videoElement.addEventListener('waiting', handleWaiting);

    return () => {
      if (frozenCheckIntervalRef.current) {
        clearInterval(frozenCheckIntervalRef.current);
      }
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('stalled', handleStalled);
      videoElement.removeEventListener('waiting', handleWaiting);
    };
  }, [participant.name, participant.videoTrack, isVideoFrozen]);

  // Handle screen share track
  useEffect(() => {
    let isMounted = true;
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

        screenElement.play().catch(e => {
          if (e.name === 'AbortError') return;
          if (isMounted) {
            screenElement.muted = true;
            screenElement.play().catch(() => {});
          }
        });
      } catch (e) {
        if (isMounted) {
          console.error('[LiveKit] Error attaching screen track:', e);
        }
      }
    }

    return () => {
      isMounted = false;
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

      {/* Frozen video indicator */}
      {isVideoFrozen && participant.hasVideo && (
        <div className="absolute top-2 right-2 bg-red-500 bg-opacity-80 text-white px-2 py-1 rounded text-xs z-20 animate-pulse">
          ⚠️ Reconnecting...
        </div>
      )}

      {/* Connection quality indicator */}
      {participant.connectionQuality && participant.connectionQuality !== 'excellent' && (
        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs z-20 ${
          participant.connectionQuality === 'poor' ? 'bg-red-500 text-white' :
          participant.connectionQuality === 'fair' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
        }`}>
          {participant.connectionQuality === 'poor' ? '📶 Poor' :
           participant.connectionQuality === 'fair' ? '📶 Fair' : '📶 Good'}
        </div>
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
    prevProps.participant.screenTrack === nextProps.participant.screenTrack &&
    prevProps.participant.connectionQuality === nextProps.participant.connectionQuality
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
  const [isLocalMain, setIsLocalMain] = useState(false); // For 2-person PiP swap
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [metrics, setMetrics] = useState({
    connectionQuality: 'unknown',
    latency: 0,
    packetLoss: 0,
    bitrate: 0,
    videoResolution: 'N/A'
  });
  const [callStartTime, setCallStartTime] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState(
    process.env.NEXT_PUBLIC_TRANSCRIPTION_LANGUAGE || 'en-US'
  );
  const [pendingLanguageRestart, setPendingLanguageRestart] = useState(false);

  // Sidebar state - each panel can be toggled independently
  const [showMessages, setShowMessages] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('messages'); // Which tab is active when multiple are open
  const [currentTopic, setCurrentTopic] = useState(null);
  const [usedTopicIndices, setUsedTopicIndices] = useState(new Set());
  const [userVibeCategory, setUserVibeCategory] = useState('general');

  // Derived state: sidebar is open if any panel is enabled
  const showSidebar = showMessages || showTopics || showParticipants;
  // Count how many panels are enabled (to decide if we need tabs)
  const enabledPanelCount = [showMessages, showTopics, showParticipants].filter(Boolean).length;

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
  const metricsIntervalRef = useRef(null); // Interval for collecting metrics

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

  // Shuffle to next topic
  const shuffleTopic = useCallback(() => {
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
  }, [userVibeCategory, usedTopicIndices]);

  // Load user's vibe category
  useEffect(() => {
    if (user?.id) {
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
  }, [user?.id]);

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

  // Collect metrics periodically when connected
  useEffect(() => {
    if (!isConnected || !roomRef.current) {
      return;
    }

    const collectMetrics = async () => {
      const room = roomRef.current;
      if (!room || room.state === 'disconnected') return;

      try {
        // Get local video track stats
        const videoTrack = room.localParticipant?.getTrackPublication('camera')?.track;
        const audioTrack = room.localParticipant?.getTrackPublication('microphone')?.track;

        let videoResolution = 'N/A';
        let bitrate = 0;
        let packetLoss = 0;
        let latency = 0;

        // Try to get sender stats from video track
        if (videoTrack?.sender) {
          try {
            const stats = await videoTrack.sender.getStats();
            stats.forEach(report => {
              if (report.type === 'outbound-rtp' && report.kind === 'video') {
                // Calculate bitrate from bytes sent
                if (report.bytesSent && report.timestamp) {
                  bitrate = Math.round((report.bytesSent * 8) / 1000); // kbps total (approximate)
                }
                // Get resolution
                if (report.frameWidth && report.frameHeight) {
                  videoResolution = `${report.frameWidth}x${report.frameHeight}`;
                }
              }
              if (report.type === 'remote-inbound-rtp') {
                // Packet loss and round trip time
                if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                  const total = report.packetsLost + report.packetsReceived;
                  packetLoss = total > 0 ? (report.packetsLost / total) * 100 : 0;
                }
                if (report.roundTripTime !== undefined) {
                  latency = Math.round(report.roundTripTime * 1000); // Convert to ms
                }
              }
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.currentRoundTripTime !== undefined) {
                  latency = Math.round(report.currentRoundTripTime * 1000);
                }
              }
            });
          } catch (e) {
            // Stats not available
          }
        }

        // Also try to get stats from audio track for latency
        if (audioTrack?.sender && latency === 0) {
          try {
            const stats = await audioTrack.sender.getStats();
            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.currentRoundTripTime !== undefined) {
                  latency = Math.round(report.currentRoundTripTime * 1000);
                }
              }
            });
          } catch (e) {
            // Stats not available
          }
        }

        setMetrics(prev => ({
          ...prev,
          latency,
          packetLoss: parseFloat(packetLoss.toFixed(1)),
          bitrate,
          videoResolution
        }));
      } catch (e) {
        console.error('[LiveKit] Error collecting metrics:', e);
      }
    };

    // Collect metrics immediately and then every 5 seconds
    collectMetrics();
    metricsIntervalRef.current = setInterval(collectMetrics, 5000);

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    };
  }, [isConnected]);

  // Handle tab visibility changes - recover video streams when returning to tab
  useEffect(() => {
    if (!isConnected || !roomRef.current) {
      return;
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && roomRef.current) {
        console.log('[LiveKit] Tab became visible, recovering video streams...');

        const room = roomRef.current;

        // For each remote participant, request keyframe via PLI
        room.remoteParticipants.forEach((participant) => {
          const videoPublication = participant.getTrackPublication('camera');
          if (videoPublication?.track) {
            const track = videoPublication.track;

            // Try to request PLI (Picture Loss Indication) to get a keyframe faster
            // This is done via the RTCRtpReceiver
            if (track.receiver) {
              try {
                // Request keyframe by sending PLI
                // Note: This is handled automatically by WebRTC, but we can try to trigger it
                const receiver = track.receiver;
                if (receiver.transport?.iceTransport) {
                  // Connection is active, WebRTC should auto-recover
                }
              } catch (e) {
                // Ignore errors
              }
            }

            // Find video elements displaying this track and ensure they're playing
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
              const stream = video.srcObject;
              if (stream instanceof MediaStream) {
                const videoTracks = stream.getVideoTracks();
                const hasThisTrack = videoTracks.some(t => t.id === track.mediaStreamTrack?.id);

                if (hasThisTrack) {
                  // Force play to ensure video is running
                  video.play().catch(() => {});
                }
              }
            });
          }
        });

        // Give a moment for recovery, then force refresh all video elements
        setTimeout(() => {
          const videoElements = document.querySelectorAll('video');
          videoElements.forEach(video => {
            if (video.srcObject && video.paused) {
              video.play().catch(() => {});
            }
          });
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected]);

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
      } else {
        // Update remote participant's connection quality
        setRemoteParticipants(prev => prev.map(p =>
          p.id === participant.identity
            ? { ...p, connectionQuality: quality }
            : p
        ));
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
        connectionQuality: p.connectionQuality, // Track connection quality
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

    // Clear metrics collection interval
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
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
  const lastVideoElementRef = useRef(null); // Track which element has the track

  useEffect(() => {
    let isMounted = true; // Track mount state to handle StrictMode double-mount
    const videoElement = localVideoRef.current;
    const track = localVideoTrack;

    if (!videoElement) return;

    // Check if video element changed (e.g., view toggle)
    const elementChanged = lastVideoElementRef.current !== videoElement;

    // Detach from previous element if it changed or track changed
    if (localAttachedTrackRef.current && (elementChanged || localAttachedTrackRef.current !== track || isVideoOff)) {
      try {
        // Detach from the OLD element, not the new one
        if (lastVideoElementRef.current) {
          localAttachedTrackRef.current.detach(lastVideoElementRef.current);
        }
      } catch (e) {
        // Ignore detach errors
      }
      localAttachedTrackRef.current = null;
    }

    // Attach track to new element if video is on
    if (track && !isVideoOff && (!localAttachedTrackRef.current || elementChanged)) {
      try {
        track.attach(videoElement);
        localAttachedTrackRef.current = track;
        lastVideoElementRef.current = videoElement;

        // Safari needs explicit play() call
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            // Ignore AbortError - expected during StrictMode unmount/remount
            if (e.name === 'AbortError') return;
            if (isMounted) {
              console.log('[LiveKit] Local video autoplay prevented:', e.name);
            }
          });
        }
      } catch (e) {
        if (isMounted) {
          console.error('[LiveKit] Error attaching local video:', e);
        }
      }
    }

    return () => {
      isMounted = false;
      if (localAttachedTrackRef.current && lastVideoElementRef.current) {
        try {
          localAttachedTrackRef.current.detach(lastVideoElementRef.current);
        } catch (e) {
          // Ignore detach errors on cleanup
        }
        localAttachedTrackRef.current = null;
        lastVideoElementRef.current = null;
      }
    };
  }, [localVideoTrack, isVideoOff, gridView, remoteParticipants.length, isLocalMain]); // Re-run when view, participant count, or swap changes

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-stone-600 to-stone-700 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 100 100" className="text-white">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="220 60"/>
              <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fontWeight="bold" fill="currentColor">W</text>
            </svg>
            <div>
              <h1 className="text-white font-bold text-xl">CircleW Group Meetup</h1>
              <p className="text-stone-200 text-sm">
                {meetupInfo ? `${meetupInfo.date} at ${meetupInfo.time}` : 'Loading...'}
              </p>
              <p className="text-stone-200 text-xs">
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

      {/* Video Grid / Speaker View */}
      <div className={`flex-1 p-3 relative overflow-hidden transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`} style={{ minHeight: 0 }}>
        {/* For 2 participants: Render both videos once, swap via CSS only */}
        {remoteParticipants.length === 1 && (
          <>
            {/* Remote Video - single instance, CSS controls size/position */}
            <div
              className={`bg-gray-800 rounded-lg overflow-hidden absolute z-0 ${
                gridView
                  ? 'right-3 top-3 bottom-3 w-[calc(50%-6px)]'  // Grid: right half
                  : isLocalMain
                    ? 'top-4 right-4 w-36 h-28 md:w-48 md:h-36 shadow-xl z-10 cursor-pointer hover:ring-2 hover:ring-purple-500'
                    : 'inset-0'
              }`}
              onClick={!gridView && isLocalMain ? () => setIsLocalMain(false) : undefined}
            >
              <RemoteVideoPlayer key={remoteParticipants[0].id} participant={remoteParticipants[0]} />
              {!gridView && isLocalMain && (
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white px-1.5 py-0.5 rounded text-xs z-20">
                  {remoteParticipants[0].name}
                </div>
              )}
            </div>

            {/* Local Video - single instance, CSS controls size/position */}
            <div
              className={`bg-gray-800 rounded-lg overflow-hidden absolute z-0 ${
                gridView
                  ? 'left-3 top-3 bottom-3 w-[calc(50%-6px)]'  // Grid: left half
                  : isLocalMain
                    ? 'inset-0'
                    : 'top-4 right-4 w-36 h-28 md:w-48 md:h-36 shadow-xl z-10 cursor-pointer hover:ring-2 hover:ring-purple-500'
              }`}
              onClick={!gridView && !isLocalMain ? () => setIsLocalMain(true) : undefined}
            >
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`bg-rose-500 rounded-full flex items-center justify-center mx-auto ${
                      !gridView && !isLocalMain ? 'w-12 h-12' : 'w-20 h-20 mb-2'
                    }`}>
                      <span className={`text-white ${!gridView && !isLocalMain ? 'text-lg' : 'text-2xl'}`}>
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {(gridView || isLocalMain) && <p className="text-white text-sm">You (Camera off)</p>}
                  </div>
                </div>
              )}
              <div className={`absolute bg-black bg-opacity-60 text-white rounded z-20 ${
                !gridView && !isLocalMain
                  ? 'bottom-1 right-1 px-1.5 py-0.5 text-xs'
                  : 'bottom-2 left-2 px-2 py-1 text-xs'
              }`}>
                {!gridView && !isLocalMain ? 'You' : `You ${isMuted ? '🔇' : ''}`}
              </div>
            </div>
          </>
        )}

        {/* For 1 participant (alone) or 3+ participants: use original grid/speaker layouts */}
        {remoteParticipants.length !== 1 && (
          gridView ? (
            /* Grid View */
            <div
              className={`w-full h-full grid gap-2 auto-rows-fr ${
                participantCount === 1 ? 'grid-cols-1' :
                participantCount <= 4 ? 'grid-cols-2' :
                participantCount <= 6 ? 'grid-cols-3' :
                'grid-cols-4'
              }`}
            >
              {/* Local Video in Grid */}
              <div className="bg-gray-800 rounded-lg overflow-hidden relative w-full h-full min-h-0">
                {!isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl text-white">{user?.email?.charAt(0).toUpperCase()}</span>
                      </div>
                      <p className="text-white text-sm">You (Camera off)</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs z-20">
                  You {isMuted && '🔇'}
                </div>
              </div>

              {/* Remote Videos in Grid */}
              {remoteParticipants.map((participant) => (
                <RemoteVideoPlayer key={participant.id} participant={participant} />
              ))}
            </div>
          ) : remoteParticipants.length === 0 ? (
            /* Alone - full screen local */
            <div className="bg-gray-800 rounded-lg overflow-hidden absolute inset-0">
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl text-white">{user?.email?.charAt(0).toUpperCase()}</span>
                    </div>
                    <p className="text-white">You (Camera off)</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white px-3 py-1.5 rounded text-sm z-20">
                You {isMuted && '🔇'}
              </div>
            </div>
          ) : (
            /* 3+ participants: Thumbnails on top */
            <div className="w-full h-full flex flex-col">
              <div className="flex gap-2 h-24 flex-shrink-0 overflow-x-auto pb-2">
                {/* Local video thumbnail */}
                <div className="bg-gray-800 rounded-lg overflow-hidden relative h-full aspect-video flex-shrink-0">
                  {!isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                      <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center">
                        <span className="text-sm text-white">{user?.email?.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white px-1.5 py-0.5 rounded text-xs z-20">
                    You {isMuted && '🔇'}
                  </div>
                </div>
                {/* Other remote participant thumbnails */}
                {remoteParticipants.slice(1).map((participant) => (
                  <div key={participant.id} className="h-full aspect-video flex-shrink-0">
                    <RemoteVideoPlayer participant={participant} />
                  </div>
                ))}
              </div>
              {/* Main speaker */}
              <div className="flex-1 min-h-0">
                <RemoteVideoPlayer key={remoteParticipants[0].id} participant={remoteParticipants[0]} />
              </div>
            </div>
          )
        )}

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
      <div className={`bg-gray-800 py-3 px-4 flex-shrink-0 transition-all duration-300 ${showSidebar ? 'md:mr-80' : ''}`}>
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

            {/* Topics toggle */}
            <button
              onClick={() => {
                setShowTopics(!showTopics);
                if (!showTopics) setActiveTab('topics');
              }}
              className={`${showTopics ? 'bg-amber-500' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title="Toggle topics"
            >
              💡
            </button>

            {/* Messages toggle */}
            <button
              onClick={() => {
                setShowMessages(!showMessages);
                if (!showMessages) setActiveTab('messages');
              }}
              className={`${showMessages ? 'bg-purple-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center relative`}
              title="Toggle messages"
            >
              💬
              {messages.length > 0 && !showMessages && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {messages.length}
                </span>
              )}
            </button>

            {/* Participants toggle */}
            <button
              onClick={() => {
                setShowParticipants(!showParticipants);
                if (!showParticipants) setActiveTab('participants');
              }}
              className={`${showParticipants ? 'bg-green-600' : 'bg-gray-700'} hover:bg-gray-600 text-white w-12 h-12 rounded-full text-xl transition flex items-center justify-center`}
              title="Toggle participants"
            >
              👥
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

      {/* Sidebar - shows when Messages, Topics, and/or Participants is enabled */}
      {showSidebar && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-50">
          {/* Sidebar Header */}
          <div className="border-b border-gray-700">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-white font-semibold">
                {enabledPanelCount > 1 ? 'Meeting Panel' :
                  showMessages ? 'Messages' :
                  showTopics ? 'Topics' : 'Participants'}
              </h3>
              <button
                onClick={() => {
                  setShowMessages(false);
                  setShowTopics(false);
                  setShowParticipants(false);
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Tabs - only show when more than one panel is enabled */}
            {enabledPanelCount > 1 && (
              <div className="flex">
                {showMessages && (
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'messages'
                        ? 'text-purple-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    💬 Messages
                    {messages.length > 0 && activeTab !== 'messages' && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full text-[10px]">
                        {messages.length > 9 ? '9+' : messages.length}
                      </span>
                    )}
                    {activeTab === 'messages' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
                    )}
                  </button>
                )}
                {showTopics && (
                  <button
                    onClick={() => setActiveTab('topics')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'topics'
                        ? 'text-amber-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    💡 Topics
                    {activeTab === 'topics' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                    )}
                  </button>
                )}
                {showParticipants && (
                  <button
                    onClick={() => setActiveTab('participants')}
                    className={`flex-1 py-3 text-sm font-medium transition relative ${
                      activeTab === 'participants'
                        ? 'text-green-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    👥 People
                    {activeTab === 'participants' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Messages Content - show when messages is enabled AND (only one panel OR activeTab is messages) */}
          {showMessages && (enabledPanelCount === 1 || activeTab === 'messages') && (
            <>
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
            </>
          )}

          {/* Topics Content - show when topics is enabled AND (only one panel OR activeTab is topics) */}
          {showTopics && (enabledPanelCount === 1 || activeTab === 'topics') && (
            <>
              {/* Language Toggle */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-2">
                  <span className="text-gray-300 text-sm">Language</span>
                  <div className="flex items-center bg-gray-600 rounded-lg p-0.5">
                    <button
                      onClick={() => transcriptionLanguage !== 'en-US' && handleLanguageChange('en-US')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                        transcriptionLanguage === 'en-US'
                          ? 'bg-amber-500 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => transcriptionLanguage !== 'zh-CN' && handleLanguageChange('zh-CN')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                        transcriptionLanguage === 'zh-CN'
                          ? 'bg-amber-500 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      中
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Topic Card */}
              <div className="p-4 border-b border-gray-700">
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
                      <span className="text-white text-lg">🔀</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {userVibeCategory === 'advice' && 'Mentorship focused'}
                    {userVibeCategory === 'vent' && 'Support focused'}
                    {userVibeCategory === 'grow' && 'Growth focused'}
                    {userVibeCategory === 'general' && 'General networking'}
                  </p>
                </div>
              </div>

              {/* Live Transcript */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-gray-300 text-sm font-medium">Live Transcript</span>
                  </div>
                  {speechError && (
                    <span className="text-xs text-red-400">{speechError}</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {transcript.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-3 block">🎤</span>
                      <p className="text-gray-400 text-sm">
                        {isTranscribing
                          ? 'Listening... Start speaking!'
                          : isSpeechSupported
                            ? 'Transcript will appear when you speak'
                            : 'Speech recognition not supported'}
                      </p>
                    </div>
                  ) : (
                    transcript.map((entry, idx) => (
                      <div key={idx} className="group">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium bg-purple-500 text-white">
                            {(entry.speakerName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 mb-0.5">
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
                </div>
              </div>

              {/* Transcript Controls */}
              <div className="p-4 border-t border-gray-700">
                <button
                  onClick={toggleTranscription}
                  disabled={!isSpeechSupported}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isTranscribing
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  🎤 {isTranscribing ? 'Stop Transcription' : 'Start Transcription'}
                </button>
              </div>
            </>
          )}

          {/* Participants Content - show when participants is enabled AND (only one panel OR activeTab is participants) */}
          {showParticipants && (enabledPanelCount === 1 || activeTab === 'participants') && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">
                {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
              </p>

              {/* Current User */}
              <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user?.email?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {user?.email?.split('@')[0] || 'You'}
                  </p>
                  <p className="text-gray-400 text-xs">You (Host)</p>
                </div>
                <div className="flex items-center gap-1">
                  {!isMuted && <span className="text-green-400 text-sm">🎤</span>}
                  {!isVideoOff && <span className="text-green-400 text-sm">📹</span>}
                </div>
              </div>

              {/* Remote Participants */}
              {remoteParticipants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {(participant.name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {participant.name || 'Anonymous'}
                    </p>
                    {participant.connectionQuality && participant.connectionQuality !== 'excellent' && (
                      <p className={`text-xs ${
                        participant.connectionQuality === 'poor' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {participant.connectionQuality === 'poor' ? '⚠️ Poor connection' : '📶 Fair connection'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {participant.hasAudio && <span className="text-green-400 text-sm">🎤</span>}
                    {participant.hasVideo && <span className="text-green-400 text-sm">📹</span>}
                    {participant.hasScreen && <span className="text-blue-400 text-sm">🖥️</span>}
                    {participant.isSpeaking && <span className="text-amber-400 text-sm animate-pulse">🔊</span>}
                  </div>
                </div>
              ))}

              {remoteParticipants.length === 0 && (
                <p className="text-gray-400 text-sm text-center mt-4">
                  Waiting for others to join...
                </p>
              )}
            </div>
          )}
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
