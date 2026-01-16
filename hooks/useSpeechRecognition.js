'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for client-side speech recognition using Web Speech API
 *
 * Supports Chrome, Safari, and Edge browsers
 * Falls back gracefully if not supported
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

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) {
      console.log('[SpeechRecognition] Not supported in this browser');
    }
  }, []);

  // Initialize recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended');
      setIsListening(false);

      // Auto-restart if we're supposed to be listening
      if (isListeningRef.current) {
        console.log('[SpeechRecognition] Auto-restarting...');
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('[SpeechRecognition] Restart error:', e.message);
            }
          }
        }, 100);
      }
    };

    recognition.onerror = (event) => {
      console.log('[SpeechRecognition] Error:', event.error);

      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
          // This is normal, just means silence was detected
          break;
        case 'audio-capture':
          setError('No microphone detected');
          break;
        case 'not-allowed':
          setError('Microphone permission denied');
          isListeningRef.current = false;
          break;
        case 'network':
          setError('Network error occurred');
          break;
        case 'aborted':
          // User or system aborted, don't show error
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onresult = (event) => {
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
        onTranscript({
          text: finalTranscript.trim(),
          isFinal: true,
          timestamp: Date.now()
        });
      }

      // Optionally send interim results too
      if (interimTranscript && onTranscript && interimResults) {
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
    }

    // Create new recognition instance
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    if (recognitionRef.current) {
      try {
        isListeningRef.current = true;
        recognitionRef.current.start();
        console.log('[SpeechRecognition] Starting...');
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
    error,
    startListening,
    stopListening
  };
}
