'use client';

import { useState, useEffect } from 'react';
import useDeepgramTranscription from './useDeepgramTranscription';
import useSpeechRecognition from './useSpeechRecognition';

/**
 * Transcription hook — prefers Web Speech API (free), falls back to Deepgram.
 *
 * Override with env vars:
 *   NEXT_PUBLIC_USE_DEEPGRAM=true   → force Deepgram
 *   NEXT_PUBLIC_USE_DEEPGRAM=false  → force Web Speech API
 *   (not set)                       → auto: Web Speech API if supported, else Deepgram
 *
 * Supported languages:
 * - 'en-US': English (US)
 * - 'zh-CN': Chinese (Simplified)
 */
export default function useTranscription(options = {}) {
  const defaultLanguage = process.env.NEXT_PUBLIC_TRANSCRIPTION_LANGUAGE || 'en-US';
  const resolvedOptions = {
    ...options,
    language: options.language || defaultLanguage,
  };

  // Detect Web Speech API support
  const [webSpeechSupported, setWebSpeechSupported] = useState(false);
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setWebSpeechSupported(!!SpeechRecognition);
  }, []);

  // Determine which provider to use
  const envOverride = process.env.NEXT_PUBLIC_USE_DEEPGRAM;
  let useWebSpeech;
  if (envOverride === 'true') {
    useWebSpeech = false; // Force Deepgram
  } else if (envOverride === 'false') {
    useWebSpeech = true; // Force Web Speech API
  } else {
    useWebSpeech = webSpeechSupported; // Auto: prefer Web Speech API
  }

  // Both hooks must always be called (React rules), but only one is active
  const speechApi = useSpeechRecognition(useWebSpeech ? resolvedOptions : { enabled: false });

  // Safari has webkitSpeechRecognition but it's unreliable — fall back to Deepgram
  if (useWebSpeech && speechApi.isSafari && envOverride !== 'false') {
    useWebSpeech = false;
  }

  // Edge uses Microsoft speech services which hit persistent network errors — fall back to Deepgram
  if (useWebSpeech && speechApi.isEdge && envOverride !== 'false') {
    useWebSpeech = false;
  }

  const deepgram = useDeepgramTranscription(!useWebSpeech ? resolvedOptions : {});

  const active = useWebSpeech ? speechApi : deepgram;
  return { ...active, provider: useWebSpeech ? 'webspeech' : 'deepgram' };
}
