/**
 * Video Provider Factory
 *
 * Creates and manages video providers based on call type.
 * - 1:1 Coffee Chats → WebRTC
 * - Admin Meetups (large groups) → LiveKit
 * - Connection Groups (3-4 people) → Agora
 */

import { ProviderType, CallTypeProvider } from './types';

// Lazy-loaded providers
let AgoraProvider = null;
let LiveKitProvider = null;
let WebRTCProvider = null;

/**
 * Provider configuration from environment
 */
export const providerConfig = {
  // Provider selection per call type (can be overridden via env)
  callTypeMapping: {
    '1on1': process.env.NEXT_PUBLIC_VIDEO_PROVIDER_1ON1 || ProviderType.WEBRTC,
    'meetup': process.env.NEXT_PUBLIC_VIDEO_PROVIDER_MEETUP || ProviderType.LIVEKIT,
    'group': process.env.NEXT_PUBLIC_VIDEO_PROVIDER_GROUP || ProviderType.AGORA,
  },

  // LiveKit configuration
  livekit: {
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
    // API key/secret are server-side only for token generation
  },

  // Agora configuration
  agora: {
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
  },

  // Feature flags
  features: {
    transcription: process.env.NEXT_PUBLIC_ENABLE_TRANSCRIPTION === 'true',
    aiRecap: process.env.NEXT_PUBLIC_ENABLE_AI_RECAP === 'true',
    metrics: process.env.NEXT_PUBLIC_ENABLE_METRICS !== 'false', // Default true
  },
};

/**
 * Get the provider type for a given call type
 * @param {'1on1' | 'meetup' | 'group'} callType
 * @returns {string} Provider type
 */
export function getProviderForCallType(callType) {
  return providerConfig.callTypeMapping[callType] || ProviderType.WEBRTC;
}

/**
 * Dynamically load a provider module
 * @param {string} providerType
 * @returns {Promise<typeof BaseVideoProvider>}
 */
async function loadProvider(providerType) {
  switch (providerType) {
    case ProviderType.AGORA:
      if (!AgoraProvider) {
        const module = await import('./AgoraProvider');
        AgoraProvider = module.default;
      }
      return AgoraProvider;

    case ProviderType.LIVEKIT:
      if (!LiveKitProvider) {
        const module = await import('./LiveKitProvider');
        LiveKitProvider = module.default;
      }
      return LiveKitProvider;

    case ProviderType.WEBRTC:
    default:
      if (!WebRTCProvider) {
        const module = await import('./WebRTCProvider');
        WebRTCProvider = module.default;
      }
      return WebRTCProvider;
  }
}

/**
 * Create a video provider instance for the given call type
 * @param {'1on1' | 'meetup' | 'group'} callType
 * @param {Object} config - Additional provider configuration
 * @returns {Promise<BaseVideoProvider>}
 */
export async function createProvider(callType, config = {}) {
  const providerType = getProviderForCallType(callType);

  console.log(`[VideoProvider] Creating ${providerType} provider for ${callType} call`);

  const ProviderClass = await loadProvider(providerType);

  // Merge provider-specific config
  const providerConfig = {
    ...config,
    providerType,
    callType,
  };

  // Add provider-specific settings
  switch (providerType) {
    case ProviderType.AGORA:
      providerConfig.appId = providerConfig.appId || process.env.NEXT_PUBLIC_AGORA_APP_ID;
      break;

    case ProviderType.LIVEKIT:
      providerConfig.serverUrl = providerConfig.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL;
      break;

    case ProviderType.WEBRTC:
      // WebRTC uses signaling server
      providerConfig.signalingUrl = providerConfig.signalingUrl || process.env.NEXT_PUBLIC_SIGNALING_URL;
      break;
  }

  return new ProviderClass(providerConfig);
}

/**
 * Get provider info for display/debugging
 * @param {'1on1' | 'meetup' | 'group'} callType
 * @returns {Object}
 */
export function getProviderInfo(callType) {
  const providerType = getProviderForCallType(callType);

  const info = {
    callType,
    provider: providerType,
    features: { ...providerConfig.features },
  };

  switch (providerType) {
    case ProviderType.AGORA:
      info.name = 'Agora';
      info.description = 'Real-time communication for small groups';
      info.maxParticipants = 17;
      info.supportsTranscription = false;
      break;

    case ProviderType.LIVEKIT:
      info.name = 'LiveKit';
      info.description = 'Scalable video for large meetups';
      info.maxParticipants = 100;
      info.supportsTranscription = true;
      break;

    case ProviderType.WEBRTC:
      info.name = 'WebRTC';
      info.description = 'Peer-to-peer for 1:1 calls';
      info.maxParticipants = 2;
      info.supportsTranscription = false;
      break;
  }

  return info;
}

export { ProviderType, CallTypeProvider, ProviderEvents } from './types';
