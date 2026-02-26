'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for real-time transcription using Deepgram WebSocket API.
 * Drop-in replacement for useSpeechRecognition with the same return API.
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
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const keepaliveRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
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

  // Clean up WebSocket and keepalive
  const cleanupWebSocket = useCallback(() => {
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
    if (wsRef.current) {
      try {
        // Remove onclose to prevent reconnect during intentional close
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        if (wsRef.current.readyState === WebSocket.OPEN ||
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (e) { /* ignore */ }
      wsRef.current = null;
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

    cleanupWebSocket();
    cleanupAudio();

    setIsListening(false);
    isCleaningUpRef.current = false;
  }, [cleanupWebSocket, cleanupAudio]);

  const startListening = useCallback(async () => {
    console.log('[Deepgram] startListening called');

    // Clean up any previous session
    cleanupWebSocket();
    cleanupAudio();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setError(null);
    isCleaningUpRef.current = false;

    // 1. Fetch temporary Deepgram key
    let apiKey;
    try {
      const res = await fetch('/api/deepgram-token', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Token request failed (${res.status})`);
      }
      const data = await res.json();
      apiKey = data.key;
    } catch (e) {
      console.error('[Deepgram] Token fetch error:', e);
      setError('Failed to initialize transcription: ' + e.message);
      return false;
    }

    // 2. Get microphone stream
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

    // 3. Set up AudioContext to resample to 16kHz mono linear16
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

    processor.onaudioprocess = (e) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      let pcm16;
      if (nativeSampleRate === targetSampleRate) {
        pcm16 = float32ToInt16(inputData);
      } else {
        const resampled = downsample(inputData, nativeSampleRate, targetSampleRate);
        pcm16 = float32ToInt16(resampled);
      }

      wsRef.current.send(pcm16.buffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // 4. Open WebSocket to Deepgram
    const lang = languageRef.current || 'en-US';
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${lang}&punctuate=true&interim_results=true&smart_format=true&encoding=linear16&sample_rate=16000&channels=1`;

    try {
      const ws = new WebSocket(wsUrl, ['token', apiKey]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Deepgram] WebSocket connected');
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);

        // Keepalive: send empty buffer every 8s to prevent timeout
        keepaliveRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(new ArrayBuffer(0));
          }
        }, 8000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data?.channel?.alternatives?.[0]?.transcript;
          if (!transcript) return;

          const isFinal = data.is_final === true;
          const speechFinal = data.speech_final === true;

          if (isFinal && onTranscriptRef.current) {
            console.log('[Deepgram] Final:', transcript);
            onTranscriptRef.current({
              text: transcript,
              isFinal: true,
              timestamp: Date.now(),
            });
          } else if (!isFinal && interimResultsRef.current && onTranscriptRef.current) {
            onTranscriptRef.current({
              text: transcript,
              isFinal: false,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          console.warn('[Deepgram] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('[Deepgram] WebSocket closed, code:', event.code, 'reason:', event.reason);

        if (keepaliveRef.current) {
          clearInterval(keepaliveRef.current);
          keepaliveRef.current = null;
        }

        // Auto-reconnect if we should still be listening and this wasn't intentional
        if (isListeningRef.current && !isCleaningUpRef.current) {
          console.log('[Deepgram] Unexpected close, reconnecting in 1s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              // Clean up current resources before reconnecting
              cleanupWebSocket();
              cleanupAudio();
              startListening();
            }
          }, 1000);
        }
      };

      ws.onerror = (event) => {
        console.error('[Deepgram] WebSocket error:', event);
      };

      return true;
    } catch (e) {
      console.error('[Deepgram] WebSocket creation error:', e);
      cleanupAudio();
      setError('Failed to connect to transcription service');
      return false;
    }
  }, [cleanupWebSocket, cleanupAudio]);

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
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
      }
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
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
    isSupported: true, // Deepgram only needs getUserMedia + WebSocket
    isSafari: false,   // No Safari-specific workarounds needed
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
