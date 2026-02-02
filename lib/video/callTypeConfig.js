/**
 * Call Type Configuration
 *
 * Maps URL call types to internal types, providers, database tables,
 * features, and UI configuration.
 */

export const CALL_TYPE_CONFIG = {
  coffee: {
    // Internal type used by video provider factory
    internalType: '1on1',
    // Video provider: webrtc, livekit, or agora
    provider: 'webrtc',
    // Database table for room records
    roomTable: 'video_rooms',
    // Related entity table
    relatedTable: 'coffee_chats',
    // Room ID prefix (for channel names)
    channelPrefix: '',
    // Feature flags
    features: {
      chat: true,
      transcription: true,
      screenShare: false,
      backgroundBlur: false,
      recording: false,
      topics: false,
      participants: false,
      maxParticipants: 2,
    },
    // UI configuration - Mocha theme
    ui: {
      emoji: '☕',
      title: 'Coffee Chat',
      gradient: 'from-amber-900 to-stone-800',
      accentColor: 'mocha',
      brandName: 'CircleW Coffee Chat',
    },
  },

  meetup: {
    internalType: 'meetup',
    provider: 'livekit',
    roomTable: 'agora_rooms',
    relatedTable: 'meetups',
    channelPrefix: 'meetup-',
    features: {
      chat: true,
      transcription: true,
      screenShare: true,
      backgroundBlur: true,
      recording: true,
      topics: true,
      participants: true,
      maxParticipants: 100,
    },
    // UI configuration - Mocha theme
    ui: {
      emoji: '👥',
      title: 'Group Meetup',
      gradient: 'from-amber-900 to-stone-800',
      accentColor: 'mocha',
      brandName: 'CircleW Group Meetup',
    },
  },

  circle: {
    internalType: 'group',
    provider: 'agora',
    roomTable: 'connection_group_rooms',
    relatedTable: 'connection_groups',
    channelPrefix: 'connection-group-',
    features: {
      chat: true,
      transcription: false,
      screenShare: true,
      backgroundBlur: true,
      recording: true,
      topics: true,
      participants: true,
      maxParticipants: 17,
    },
    // UI configuration - Mocha theme
    ui: {
      emoji: '🔒',
      title: 'Circle Meeting',
      gradient: 'from-amber-900 to-stone-800',
      accentColor: 'mocha',
      brandName: 'Connection Group',
    },
  },
};

/**
 * Get call type configuration by URL type
 * @param {string} type - URL call type (coffee, meetup, circle)
 * @returns {Object|null} Configuration object or null if not found
 */
export function getCallTypeConfig(type) {
  return CALL_TYPE_CONFIG[type] || null;
}

/**
 * Get all valid call types
 * @returns {string[]} Array of valid call type keys
 */
export function getValidCallTypes() {
  return Object.keys(CALL_TYPE_CONFIG);
}

/**
 * Check if a call type is valid
 * @param {string} type - URL call type to validate
 * @returns {boolean}
 */
export function isValidCallType(type) {
  return type in CALL_TYPE_CONFIG;
}

/**
 * Get the internal provider type for a call type
 * @param {string} type - URL call type
 * @returns {string} Internal type (1on1, meetup, group)
 */
export function getInternalType(type) {
  return CALL_TYPE_CONFIG[type]?.internalType || '1on1';
}

/**
 * Get channel name for a room ID based on call type
 * @param {string} type - URL call type
 * @param {string} roomId - The room ID
 * @returns {string} Full channel name
 */
export function getChannelName(type, roomId) {
  const config = CALL_TYPE_CONFIG[type];
  if (!config) return roomId;
  return config.channelPrefix + roomId;
}

export default CALL_TYPE_CONFIG;
