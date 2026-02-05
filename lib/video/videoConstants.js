/**
 * Shared Video Constants
 * Centralized styling constants for video components
 */

// Container size classes for video elements
export const VIDEO_SIZE_CLASSES = {
  full: 'w-full h-full',
  grid: 'w-full h-full min-h-0',
  thumbnail: 'w-full h-full',
};

// Avatar size classes based on video container size
export const AVATAR_SIZE_CLASSES = {
  full: 'w-32 h-32 text-5xl',
  grid: 'w-20 h-20 text-2xl',
  thumbnail: 'w-10 h-10 text-sm',
};

// Label position and size classes
export const LABEL_SIZE_CLASSES = {
  full: 'bottom-4 left-4 px-3 py-2 text-sm',
  grid: 'bottom-2 left-2 px-2 py-1 text-xs',
  thumbnail: 'bottom-1 left-1 px-2 py-1 text-xs',
};

// Accent color variants - mocha theme
export const ACCENT_COLORS = {
  rose: 'bg-amber-700',
  purple: 'bg-amber-700',
  blue: 'bg-amber-600',
  green: 'bg-amber-600',
  amber: 'bg-amber-600',
  mocha: 'bg-amber-700',
  default: 'bg-amber-700',
};

// Connection quality colors
export const CONNECTION_QUALITY_COLORS = {
  excellent: 'bg-green-400',
  good: 'bg-green-400',
  fair: 'bg-yellow-400',
  poor: 'bg-red-500',
  unknown: 'bg-gray-400',
};

// Connection quality labels
export const CONNECTION_QUALITY_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unknown: 'Unknown',
};

/**
 * Get accent color class
 * @param {string} color - Color name
 * @returns {string} Tailwind class
 */
export function getAccentColor(color) {
  return ACCENT_COLORS[color] || ACCENT_COLORS.default;
}

/**
 * Get connection quality color class
 * @param {string} quality - Connection quality
 * @returns {string} Tailwind class
 */
export function getConnectionQualityColor(quality) {
  return CONNECTION_QUALITY_COLORS[quality] || CONNECTION_QUALITY_COLORS.unknown;
}

/**
 * Get connection quality label
 * @param {string} quality - Connection quality
 * @returns {string} Human-readable label
 */
export function getConnectionQualityLabel(quality) {
  return CONNECTION_QUALITY_LABELS[quality] || CONNECTION_QUALITY_LABELS.unknown;
}
