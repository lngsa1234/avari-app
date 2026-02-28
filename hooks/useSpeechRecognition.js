'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for client-side speech recognition using Web Speech API
 */
export default function useSpeechRecognition({
  onTranscript,
  language = 'en-US',
  continuous = true,
  interimResults = true,
  enabled = true,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const [isEdge, setIsEdge] = useState(false);
  const [networkFailed, setNetworkFailed] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const isRestartingRef = useRef(false);
  const errorCountRef = useRef(0);
  const lastErrorRef = useRef(null);

  // Use refs for stable values to avoid useCallback recreation
  const onTranscriptRef = useRef(onTranscript);
  const languageRef = useRef(language);
  const continuousRef = useRef(continuous);
  const interimResultsRef = useRef(interimResults);

  const MAX_CONSECUTIVE_ERRORS = 5;
  const RESTART_DELAY = 100; // Fast restart for better responsiveness

  // Keep refs updated
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  useEffect(() => {
    interimResultsRef.current = interimResults;
  }, [interimResults]);

  // Check browser support (skip when disabled, e.g. Deepgram is active)
  useEffect(() => {
    if (!enabled) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isEdgeBrowser = /\bEdg\//i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);
    setIsEdge(isEdgeBrowser);
    setIsSupported(!!SpeechRecognition);
    console.log('[SpeechRecognition] Supported:', !!SpeechRecognition, 'Safari:', isSafariBrowser, 'Edge:', isEdgeBrowser);
  }, [enabled]);

  // Create a new recognition instance (does NOT start it)
  const createRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const recognition = new SpeechRecognition();

    recognition.continuous = isSafariBrowser ? false : continuousRef.current;
    recognition.interimResults = interimResultsRef.current;
    recognition.lang = languageRef.current;
    recognition.maxAlternatives = 1;

    console.log('[SpeechRecognition] Created instance, lang:', languageRef.current);

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      isRestartingRef.current = false;
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended, shouldContinue:', isListeningRef.current, 'isRestarting:', isRestartingRef.current);

      // Prevent multiple restart attempts
      if (isRestartingRef.current) {
        console.log('[SpeechRecognition] Already restarting, skipping');
        return;
      }

      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        console.log('[SpeechRecognition] Max errors reached, stopping');
        isListeningRef.current = false;
        setIsListening(false);
        setError('Speech recognition temporarily unavailable.');
        return;
      }

      // Auto-restart if we should still be listening
      if (isListeningRef.current) {
        isRestartingRef.current = true;

        const delay = lastErrorRef.current
          ? Math.min(RESTART_DELAY * Math.pow(2, errorCountRef.current), 5000)
          : RESTART_DELAY;

        console.log('[SpeechRecognition] Scheduling restart in', delay, 'ms');

        // Clear any existing timeout
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }

        restartTimeoutRef.current = setTimeout(() => {
          if (!isListeningRef.current) {
            isRestartingRef.current = false;
            setIsListening(false);
            return;
          }

          console.log('[SpeechRecognition] Restarting...');

          // Clean up old recognition
          if (recognitionRef.current) {
            try {
              recognitionRef.current.onend = null; // Prevent recursive calls
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore
            }
          }

          // Create and start new recognition
          const newRecognition = createRecognition();
          if (newRecognition) {
            recognitionRef.current = newRecognition;
            try {
              newRecognition.start();
              lastErrorRef.current = null;
            } catch (e) {
              console.log('[SpeechRecognition] Restart failed:', e.message);
              errorCountRef.current += 1;
              isRestartingRef.current = false;
              setIsListening(false);
            }
          } else {
            isRestartingRef.current = false;
            setIsListening(false);
          }
        }, delay);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.log('[SpeechRecognition] Error:', event.error);

      switch (event.error) {
        case 'no-speech':
          // Normal - silence detected
          break;
        case 'aborted':
          // Expected when restarting
          break;
        case 'audio-capture':
          setError('No microphone detected');
          errorCountRef.current += 1;
          lastErrorRef.current = event.error;
          break;
        case 'not-allowed':
          setError('Microphone permission denied');
          isListeningRef.current = false;
          errorCountRef.current = MAX_CONSECUTIVE_ERRORS;
          lastErrorRef.current = event.error;
          break;
        case 'network':
          errorCountRef.current += 1;
          lastErrorRef.current = event.error;
          if (errorCountRef.current >= 2) {
            setError('Speech recognition unavailable. Your browser or network may not support this feature.');
            isListeningRef.current = false;
            errorCountRef.current = MAX_CONSECUTIVE_ERRORS;
            // Persistent flag — prevents restart loops from external callers
            setNetworkFailed(true);
          }
          break;
        default:
          setError(`Error: ${event.error}`);
          errorCountRef.current += 1;
          lastErrorRef.current = event.error;
      }
    };

    recognition.onresult = (event) => {
      // Reset error count on successful result
      errorCountRef.current = 0;
      lastErrorRef.current = null;
      setError(null);

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

      if (finalTranscript && onTranscriptRef.current) {
        console.log('[SpeechRecognition] Final:', finalTranscript.trim());
        onTranscriptRef.current({
          text: finalTranscript.trim(),
          isFinal: true,
          timestamp: Date.now()
        });
      }

      if (interimTranscript && onTranscriptRef.current && interimResultsRef.current) {
        console.log('[SpeechRecognition] Interim:', interimTranscript.trim());
        onTranscriptRef.current({
          text: interimTranscript.trim(),
          isFinal: false,
          timestamp: Date.now()
        });
      }
    };

    return recognition;
  }, []); // No dependencies - uses refs

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported');
      return false;
    }

    // Don't retry after persistent network failures (e.g. Edge browser)
    if (networkFailed) {
      console.log('[SpeechRecognition] Skipping start — network previously failed');
      return false;
    }

    console.log('[SpeechRecognition] startListening called');

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // Reset state
    errorCountRef.current = 0;
    lastErrorRef.current = null;
    isRestartingRef.current = false;
    setError(null);

    // Set listening flag
    isListeningRef.current = true;

    // Create and start
    const recognition = createRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        return true;
      } catch (e) {
        console.error('[SpeechRecognition] Start error:', e);
        isListeningRef.current = false;
        setError(e.message);
        return false;
      }
    }

    isListeningRef.current = false;
    return false;
  }, [isSupported, networkFailed, createRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[SpeechRecognition] stopListening called');
    isListeningRef.current = false;
    isRestartingRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Restart listening (stops and starts fresh to clear browser's accumulated buffer)
  const restartListening = useCallback(() => {
    console.log('[SpeechRecognition] restartListening called');

    // Stop current recognition
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // Reset state
    errorCountRef.current = 0;
    lastErrorRef.current = null;
    isRestartingRef.current = false;
    setError(null);

    // Keep listening flag true and start fresh
    isListeningRef.current = true;

    // Small delay before starting new recognition
    setTimeout(() => {
      if (!isListeningRef.current) return;

      const recognition = createRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          console.log('[SpeechRecognition] Restarted fresh');
        } catch (e) {
          console.error('[SpeechRecognition] Restart error:', e);
          isListeningRef.current = false;
          setIsListening(false);
        }
      }
    }, 50);
  }, [createRecognition]);

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
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    isSafari,
    isEdge,
    networkFailed,
    error,
    startListening,
    stopListening,
    restartListening
  };
}
