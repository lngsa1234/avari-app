import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSignalingParams {
  userId: string;
  matchId: string;
  enabled?: boolean;
}

interface SignalingCallbacks {
  onOffer?: (offer: RTCSessionDescriptionInit, from: string) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit, from: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit, from: string) => void;
  onIncomingCall?: (from: string) => void;
  onCallAccepted?: (from: string) => void;
  onCallRejected?: (from: string, reason?: string) => void;
  onCallEnded?: (from: string) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  onError?: (error: { type: string; message: string }) => void;
}

/**
 * CircleW Signaling Hook - Socket.IO Version
 * 
 * Production-ready WebRTC signaling for CircleW video calls
 * Features:
 * - Automatic reconnection
 * - Connection state management
 * - Error handling
 * - Participant tracking
 */
export const useSignaling = (
  { userId, matchId, enabled = true }: UseSignalingParams,
  callbacks: SignalingCallbacks
) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!enabled || !userId || !matchId) {
      return;
    }

    const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';
    
    console.log('[CircleW] Connecting to:', serverUrl);
    setIsConnecting(true);
    
    // Detect if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('[CircleW] Device type:', isMobile ? 'Mobile' : 'Desktop');
    
    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'], // Polling first on mobile for reliability
      reconnection: true,
      reconnectionDelay: isMobile ? 500 : 1000, // Faster reconnect on mobile
      reconnectionDelayMax: isMobile ? 3000 : 5000,
      reconnectionAttempts: isMobile ? 10 : 5, // More attempts on mobile
      timeout: isMobile ? 30000 : 20000, // Longer timeout for mobile networks
      forceNew: false,
      upgrade: true, // Allow upgrading from polling to websocket
      rememberUpgrade: true,
      path: '/socket.io/',
      autoConnect: true,
    });

    socketRef.current = socket;

    // ================================================
    // CONNECTION EVENTS
    // ================================================

    socket.on('connect', () => {
      console.log('[CircleW] Connected to signaling server');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      
      // Register with server
      socket.emit('register', { userId, matchId });
    });

    socket.on('disconnect', (reason) => {
      console.log('[CircleW] Disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[CircleW] Connection error:', error);
      setIsConnecting(false);
      setConnectionError(error.message);
      callbacks.onError?.({ 
        type: 'connection', 
        message: 'Failed to connect to server' 
      });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[CircleW] Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionError(null);
      
      // Re-register after reconnection
      socket.emit('register', { userId, matchId });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[CircleW] Reconnection attempt ${attemptNumber}`);
      setIsConnecting(true);
    });

    socket.on('reconnect_error', (error) => {
      console.error('[CircleW] Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[CircleW] Reconnection failed after all attempts');
      setConnectionError('Failed to reconnect');
      callbacks.onError?.({ 
        type: 'reconnection', 
        message: 'Could not reconnect to server' 
      });
    });

    // ================================================
    // ROOM/MATCH EVENTS
    // ================================================

    socket.on('joined', ({ matchId: joinedMatchId, participants: roomParticipants }) => {
      console.log(`[CircleW] Joined match ${joinedMatchId}`);
      console.log('[CircleW] Participants:', roomParticipants);
      setParticipants(roomParticipants);
    });

    socket.on('user-joined', ({ userId: joinedUserId }) => {
      console.log('[CircleW] User joined:', joinedUserId);
      setParticipants(prev => {
        if (prev.includes(joinedUserId)) return prev;
        return [...prev, joinedUserId];
      });
      callbacks.onUserJoined?.(joinedUserId);
    });

    socket.on('user-left', ({ userId: leftUserId }) => {
      console.log('[CircleW] User left:', leftUserId);
      setParticipants(prev => prev.filter(id => id !== leftUserId));
      callbacks.onUserLeft?.(leftUserId);
    });

    // ================================================
    // CALL CONTROL EVENTS
    // ================================================

    socket.on('incoming-call', ({ from }) => {
      console.log('[CircleW] Incoming call from:', from);
      callbacks.onIncomingCall?.(from);
    });

    socket.on('call-accepted', ({ from }) => {
      console.log('[CircleW] Call accepted by:', from);
      callbacks.onCallAccepted?.(from);
    });

    socket.on('call-rejected', ({ from, reason }) => {
      console.log('[CircleW] Call rejected by:', from, 'Reason:', reason);
      callbacks.onCallRejected?.(from, reason);
    });

    socket.on('call-ended', ({ from }) => {
      console.log('[CircleW] Call ended by:', from);
      callbacks.onCallEnded?.(from);
    });

    // ================================================
    // WEBRTC SIGNALING EVENTS
    // ================================================

    socket.on('offer', ({ offer, from }) => {
      console.log('[CircleW] Received offer from:', from);
      callbacks.onOffer?.(offer, from);
    });

    socket.on('answer', ({ answer, from }) => {
      console.log('[CircleW] Received answer from:', from);
      callbacks.onAnswer?.(answer, from);
    });

    socket.on('ice-candidate', ({ candidate, from }) => {
      console.log('[CircleW] Received ICE candidate from:', from);
      callbacks.onIceCandidate?.(candidate, from);
    });

    // ================================================
    // ERROR EVENTS
    // ================================================

    socket.on('error', ({ type, message }) => {
      console.error('[CircleW] Server error:', type, message);
      callbacks.onError?.({ type, message });
    });

    socket.on('server-shutdown', ({ message }) => {
      console.warn('[CircleW] Server shutting down:', message);
      callbacks.onError?.({ 
        type: 'server_shutdown', 
        message 
      });
    });

    // ================================================
    // MOBILE: HANDLE VISIBILITY CHANGES
    // ================================================
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[CircleW] App went to background (mobile)');
        // Don't disconnect, but log it
      } else {
        console.log('[CircleW] App came to foreground (mobile)');
        // Reconnect if disconnected
        if (!socket.connected) {
          console.log('[CircleW] Reconnecting after coming to foreground');
          socket.connect();
        }
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !socket.connected) {
        console.log('[CircleW] Page restored from cache, reconnecting');
        socket.connect();
      }
    };

    // Mobile-specific event listeners
    if (isMobile) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handlePageShow as any);
      
      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat', { userId, matchId });
        }
      }, 5000); // Every 5 seconds

      // Store for cleanup
      (socket as any)._heartbeatInterval = heartbeatInterval;
    }

    // ================================================
    // CLEANUP
    // ================================================

    return () => {
      console.log('[CircleW] Cleaning up socket connection');
      
      // Clean up mobile event listeners
      if (isMobile) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow as any);
        
        if ((socket as any)._heartbeatInterval) {
          clearInterval((socket as any)._heartbeatInterval);
        }
      }
      
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, matchId, enabled]);

  // ================================================
  // SIGNALING METHODS
  // ================================================

  const sendMessage = useCallback((event: string, data: any) => {
    if (!socketRef.current?.connected) {
      console.error('[CircleW] Cannot send message - not connected');
      return false;
    }
    socketRef.current.emit(event, data);
    return true;
  }, []);

  const sendOffer = useCallback((offer: RTCSessionDescriptionInit, to: string) => {
    console.log('[CircleW] Sending offer to:', to);
    return sendMessage('offer', { offer, to });
  }, [sendMessage]);

  const sendAnswer = useCallback((answer: RTCSessionDescriptionInit, to: string) => {
    console.log('[CircleW] Sending answer to:', to);
    return sendMessage('answer', { answer, to });
  }, [sendMessage]);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidateInit, to: string) => {
    return sendMessage('ice-candidate', { candidate, to });
  }, [sendMessage]);

  const initiateCall = useCallback((to: string) => {
    console.log('[CircleW] Initiating call to:', to);
    return sendMessage('initiate-call', { to });
  }, [sendMessage]);

  const acceptCall = useCallback((to: string) => {
    console.log('[CircleW] Accepting call from:', to);
    return sendMessage('accept-call', { to });
  }, [sendMessage]);

  const rejectCall = useCallback((to: string, reason?: string) => {
    console.log('[CircleW] Rejecting call from:', to);
    return sendMessage('reject-call', { to, reason });
  }, [sendMessage]);

  const endCall = useCallback((to?: string) => {
    console.log('[CircleW] Ending call');
    return sendMessage('end-call', { to });
  }, [sendMessage]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    
    // Participants
    participants,
    
    // Signaling methods
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    
    // Call control
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
};
