'use client';

import { AVATAR_SIZE_CLASSES, getAccentColor } from '@/lib/video/videoConstants';

/**
 * Video Avatar Component
 * Displays user avatar with initial when video is off
 *
 * @param {Object} props
 * @param {string} props.name - User's display name
 * @param {string} props.size - Size variant: 'full', 'grid', 'thumbnail'
 * @param {string} props.accentColor - Accent color name
 * @param {string} props.profilePicture - Optional profile picture URL
 * @param {boolean} props.showName - Whether to show name below avatar
 * @param {string} props.subtitle - Optional subtitle text
 */
export default function VideoAvatar({
  name = 'User',
  size = 'grid',
  accentColor = 'mocha',
  profilePicture,
  showName = false,
  subtitle,
}) {
  const initial = name.charAt(0).toUpperCase();
  const avatarClass = AVATAR_SIZE_CLASSES[size] || AVATAR_SIZE_CLASSES.grid;
  const colorClass = getAccentColor(accentColor);

  return (
    <div className="text-center">
      {profilePicture ? (
        <img
          src={profilePicture}
          alt={name}
          className={`rounded-full object-cover mx-auto mb-2 ${avatarClass}`}
        />
      ) : (
        <div
          className={`${colorClass} rounded-full flex items-center justify-center mx-auto mb-2 ${avatarClass}`}
        >
          <span className="text-white font-medium">{initial}</span>
        </div>
      )}
      {showName && size !== 'thumbnail' && (
        <>
          <p className="text-white text-sm font-medium">{name}</p>
          {subtitle && (
            <p className="text-white/70 text-xs">{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
}
