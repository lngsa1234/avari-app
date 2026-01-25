'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for client-side speech recognition using Web Speech API
 *
 * Supports Chrome, Safari, and Edge browsers
 * Falls back gracefully if not supported
 *
 * Note: Safari has limited support - continuous mode doesn't work well
 */
export default function useSpeechRecognition({
  onTranscript,
  language = 'en-US',
  continuous = true,
  interimResults = true
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const [isSafari, setIsSafari] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const instanceIdRef = useRef(0); // Track recognition instance to prevent stale restarts
  const errorCountRef = useRef(0); // Track consecutive errors for backoff
  const lastErrorRef = useRef(null); // Track last error type
  const MAX_CONSECUTIVE_ERRORS = 5; // Stop retrying after this many errors
  const BASE_RESTART_DELAY = 100; // Base delay in ms

  // Check browser support and detect Safari
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Detect Safari
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);

    if (isSafariBrowser) {
      console.log('[SpeechRecognition] Safari detected - continuous mode disabled');
    }

    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      console.log('[SpeechRecognition] Not supported in this browser');
    } else {
      console.log('[SpeechRecognition] Supported in this browser');
    }
  }, []);

  // Initialize recognition
  const initRecognition = useCallback((instanceId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    // Detect Safari for special handling
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    const recognition = new SpeechRecognition();
    // Safari doesn't support continuous mode well, so disable it
    recognition.continuous = isSafariBrowser ? false : continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    console.log('[SpeechRecognition] Created instance', instanceId, 'with language:', language);

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started - continuous:', recognition.continuous, 'lang:', recognition.lang);
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended for instance', instanceId);

      // Only handle if this is still the current instance
      if (instanceId !== instanceIdRef.current) {
        console.log('[SpeechRecognition] Ignoring onend for old instance', instanceId, '(current:', instanceIdRef.current, ')');
        return;
      }

      setIsListening(false);

      // Check if we've hit too many consecutive errors
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        console.log('[SpeechRecognition] Max consecutive errors reached, stopping auto-restart');
        isListeningRef.current = false;
        setError('Speech recognition temporarily unavailable. Please try again later.');
        return;
      }

      // Auto-restart if we're supposed to be listening
      if (isListeningRef.current && recognitionRef.current) {
        // Calculate backoff delay: 100ms, 200ms, 400ms, 800ms, 1600ms...
        const backoffDelay = lastErrorRef.current
          ? Math.min(BASE_RESTART_DELAY * Math.pow(2, errorCountRef.current), 5000)
          : BASE_RESTART_DELAY;

        console.log('[SpeechRecognition] Auto-restarting in', backoffDelay, 'ms (error count:', errorCountRef.current, ')');

        restartTimeoutRef.current = setTimeout(() => {
          // Double-check instance is still current
          if (isListeningRef.current && recognitionRef.current && instanceId === instanceIdRef.current) {
            try {
              recognitionRef.current.start();
              // Clear last error on successful restart attempt
              lastErrorRef.current = null;
            } catch (e) {
              console.log('[SpeechRecognition] Restart error:', e.message);
              errorCountRef.current += 1;
            }
          }
        }, backoffDelay);
      }
    };

    recognition.onerror = (event) => {
      console.log('[SpeechRecognition] Error:', event.error, '(count:', errorCountRef.current + 1, ')');

      // Track error for backoff logic
      lastErrorRef.current = event.error;

      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
          // This is normal, just means silence was detected - don't count as error
          lastErrorRef.current = null;
          break;
        case 'audio-capture':
          setError('No microphone detected');
          errorCountRef.current += 1;
          break;
        case 'not-allowed':
          setError('Microphone permission denied');
          isListeningRef.current = false;
          errorCountRef.current = MAX_CONSECUTIVE_ERRORS; // Stop retrying
          break;
        case 'network':
          // Network errors are common and recoverable - increment count for backoff
          errorCountRef.current += 1;
          if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
            setError('Network connection issues. Speech recognition paused.');
          }
          // Don't show error for first few network errors (they'll auto-recover)
          break;
        case 'aborted':
          // User or system aborted, don't show error or count
          lastErrorRef.current = null;
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
          errorCountRef.current += 1;
      }
    };

    recognition.onresult = (event) => {
      // Reset error count on successful result - connection is working
      if (errorCountRef.current > 0) {
        console.log('[SpeechRecognition] Resetting error count after successful result');
        errorCountRef.current = 0;
        lastErrorRef.current = null;
        setError(null);
      }

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      // Call the callback with transcript data
      if (finalTranscript && onTranscript) {
        console.log('[SpeechRecognition] Final transcript:', finalTranscript.trim());
        onTranscript({
          text: finalTranscript.trim(),
          isFinal: true,
          timestamp: Date.now()
        });
      }

      // Optionally send interim results too
      if (interimTranscript && onTranscript && interimResults) {
        console.log('[SpeechRecognition] Interim transcript:', interimTranscript.trim());
        onTranscript({
          text: interimTranscript.trim(),
          isFinal: false,
          timestamp: Date.now()
        });
      }
    };

    return recognition;
  }, [continuous, interimResults, language, onTranscript]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      return false;
    }

    // Clear any existing timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Reset error tracking for fresh start
    errorCountRef.current = 0;
    lastErrorRef.current = null;
    setError(null);

    // Always create a new recognition instance to ensure fresh settings
    // Increment instance ID to invalidate old instance's callbacks
    instanceIdRef.current += 1;
    const currentInstanceId = instanceIdRef.current;

    recognitionRef.current = initRecognition(currentInstanceId);

    if (recognitionRef.current) {
      try {
        isListeningRef.current = true;
        recognitionRef.current.start();
        console.log('[SpeechRecognition] Starting instance', currentInstanceId);
        return true;
      } catch (e) {
        // Already started
        if (e.message.includes('already started')) {
          return true;
        }
        console.error('[SpeechRecognition] Start error:', e);
        setError(e.message);
        return false;
      }
    }

    return false;
  }, [isSupported, initRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    // Clear restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('[SpeechRecognition] Stopping...');
      } catch (e) {
        console.log('[SpeechRecognition] Stop error:', e.message);
      }
      recognitionRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    isSafari,
    error,
    startListening,
    stopListening
  };
}
