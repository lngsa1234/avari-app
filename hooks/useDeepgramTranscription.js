'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook for real-time transcription using Deepgram via Socket.IO backend proxy.
 * Audio is captured in the browser and streamed to the backend over Socket.IO,
 * which forwards it to Deepgram and relays transcription results back.
 */
export default function useDeepgramTranscription({
  onTranscript,
  language = 'en-US',
  continuous = true,
  interimResults = true,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  const isListeningRef = useRef(false);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);

  // Stable refs for callback and options
  const onTranscriptRef = useRef(onTranscript);
  const languageRef = useRef(language);
  const interimResultsRef = useRef(interimResults);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { interimResultsRef.current = interimResults; }, [interimResults]);

  // Clean up audio resources (mic stream, AudioContext, processor)
  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) { /* ignore */ }
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) { /* ignore */ }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Clean up Socket.IO connection
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.emit('transcription:stop');
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      } catch (e) { /* ignore */ }
      socketRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    console.log('[Deepgram] stopListening called');
    isListeningRef.current = false;
    isCleaningUpRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    cleanupSocket();
    cleanupAudio();

    setIsListening(false);
    isCleaningUpRef.current = false;
  }, [cleanupSocket, cleanupAudio]);

  const startListening = useCallback(async () => {
    console.log('[Deepgram] startListening called');

    // Clean up any previous session
    cleanupSocket();
    cleanupAudio();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setError(null);
    isCleaningUpRef.current = false;

    // 1. Get microphone stream
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
    } catch (e) {
      console.error('[Deepgram] getUserMedia error:', e);
      if (e.name === 'NotAllowedError') {
        setError('Microphone permission denied');
      } else {
        setError('No microphone detected');
      }
      return false;
    }

    // 2. Set up AudioContext to resample to 16kHz mono linear16
    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;
    } catch (e) {
      // Fallback: create without specifying sample rate; we'll resample manually
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
    }

    const source = audioContext.createMediaStreamSource(stream);
    // ScriptProcessorNode: 4096 buffer, 1 input channel, 1 output channel
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const nativeSampleRate = audioContext.sampleRate;
    const targetSampleRate = 16000;

    let audioSendCount = 0;
    processor.onaudioprocess = (e) => {
      if (!isListeningRef.current || !socketRef.current?.connected) return;

      const inputData = e.inputBuffer.getChannelData(0);

      let pcm16;
      if (nativeSampleRate === targetSampleRate) {
        pcm16 = float32ToInt16(inputData);
      } else {
        const resampled = downsample(inputData, nativeSampleRate, targetSampleRate);
        pcm16 = float32ToInt16(resampled);
      }

      socketRef.current.emit('audio-chunk', pcm16.buffer);
      audioSendCount++;
      if (audioSendCount <= 3 || audioSendCount % 100 === 0) {
        console.log(`[Deepgram] Audio sent #${audioSendCount}, bytes: ${pcm16.buffer.byteLength}, sampleRate: ${nativeSampleRate}`);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // 3. Connect to Socket.IO backend and start transcription
    const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';
    // Use Deepgram's multi-language auto-detection
    const lang = 'multi';

    try {
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // We handle reconnection ourselves
        path: '/socket.io/',
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Deepgram] Socket.IO connected, requesting transcription');
        socket.emit('transcription:start', { language: lang });
      });

      socket.on('transcription:ready', () => {
        console.log('[Deepgram] Transcription ready — streaming audio');
        reconnectAttemptsRef.current = 0;
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);
      });

      socket.on('transcription:result', ({ text, isFinal, timestamp }) => {
        if (!text) return;

        if (isFinal && onTranscriptRef.current) {
          console.log('[Deepgram] Final:', text);
          onTranscriptRef.current({ text, isFinal: true, timestamp });
        } else if (!isFinal && interimResultsRef.current && onTranscriptRef.current) {
          onTranscriptRef.current({ text, isFinal: false, timestamp });
        }
      });

      socket.on('transcription:closed', ({ code, reason }) => {
        console.log('[Deepgram] Transcription closed, code:', code, 'reason:', reason);

        // Auto-reconnect with exponential backoff
        if (isListeningRef.current && !isCleaningUpRef.current) {
          const attempt = reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
          console.log(`[Deepgram] Reconnecting in ${delay}ms (attempt ${attempt + 1})...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              cleanupSocket();
              cleanupAudio();
              startListening();
            }
          }, delay);
        }
      });

      socket.on('transcription:error', ({ message }) => {
        console.error('[Deepgram] Server error:', message);
        setError('Transcription error: ' + message);
      });

      socket.on('connect_error', (err) => {
        console.error('[Deepgram] Socket.IO connection error:', err.message);
        setError('Failed to connect to transcription server');
      });

      socket.on('disconnect', (reason) => {
        console.log('[Deepgram] Socket.IO disconnected:', reason);

        if (isListeningRef.current && !isCleaningUpRef.current) {
          const attempt = reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
          console.log(`[Deepgram] Socket disconnected, reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              cleanupSocket();
              cleanupAudio();
              startListening();
            }
          }, delay);
        }
      });

      return true;
    } catch (e) {
      console.error('[Deepgram] Socket.IO creation error:', e);
      cleanupAudio();
      setError('Failed to connect to transcription service');
      return false;
    }
  }, [cleanupSocket, cleanupAudio]);

  const restartListening = useCallback(() => {
    console.log('[Deepgram] restartListening called');
    stopListening();
    setTimeout(() => {
      startListening();
    }, 200);
  }, [stopListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      isCleaningUpRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        try {
          socketRef.current.emit('transcription:stop');
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        } catch (e) { /* ignore */ }
      }
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isListening,
    isSupported: true,
    isSafari: false,
    error,
    startListening,
    stopListening,
    restartListening,
  };
}

/** Convert Float32Array audio samples to Int16Array (linear16 PCM) */
function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

/** Downsample audio from sourceSampleRate to targetSampleRate */
function downsample(buffer, sourceSampleRate, targetSampleRate) {
  if (targetSampleRate >= sourceSampleRate) return buffer;
  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const index = i * ratio;
    const low = Math.floor(index);
    const high = Math.min(low + 1, buffer.length - 1);
    const frac = index - low;
    result[i] = buffer[low] * (1 - frac) + buffer[high] * frac;
  }
  return result;
}
