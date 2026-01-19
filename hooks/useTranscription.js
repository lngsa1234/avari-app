'use client';

import useSpeechRecognition from './useSpeechRecognition';

/**
 * Transcription hook using Web Speech API with configurable language
 *
 * Supported languages:
 * - 'en-US': English (US)
 * - 'zh-CN': Chinese (Simplified)
 *
 * Usage:
 * const { isListening, startListening, stopListening } = useTranscription({
 *   onTranscript: ({ text, isFinal }) => console.log(text),
 *   language: 'en-US' // or 'zh-CN'
 * });
 */
export default function useTranscription(options = {}) {
  // Get default language from env, fallback to English
  const defaultLanguage = process.env.NEXT_PUBLIC_TRANSCRIPTION_LANGUAGE || 'en-US';

  return useSpeechRecognition({
    ...options,
    language: options.language || defaultLanguage,
  });
}
