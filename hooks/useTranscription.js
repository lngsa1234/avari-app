'use client';

import useDeepgramTranscription from './useDeepgramTranscription';
import useSpeechRecognition from './useSpeechRecognition';

/**
 * Transcription hook — uses Deepgram as primary, Web Speech API as fallback.
 *
 * Set NEXT_PUBLIC_USE_DEEPGRAM=false to force Web Speech API.
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

  const useDeepgram = process.env.NEXT_PUBLIC_USE_DEEPGRAM !== 'false';

  const deepgram = useDeepgramTranscription(useDeepgram ? resolvedOptions : {});
  const speechApi = useSpeechRecognition(!useDeepgram ? resolvedOptions : {});

  return useDeepgram ? deepgram : speechApi;
}
