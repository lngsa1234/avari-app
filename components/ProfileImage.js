/**
 * ProfileImage — cached, lazy-loaded profile picture component.
 *
 * Reduces Supabase Storage CDN egress by:
 * 1. Adding loading="lazy" so off-screen images don't fetch
 * 2. Stripping volatile query params from Supabase URLs so browsers cache them
 * 3. Providing a consistent fallback initial when no image exists
 */

import { memo } from 'react';

/**
 * Strip query params from Supabase Storage public URLs to maximize browser caching.
 * The raw URL (without ?t=...) is stable and cacheable by the browser and CDN.
 */
function stableImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Remove cache-busting params that some upload flows append
    u.search = '';
    return u.toString();
  } catch {
    return url;
  }
}

function ProfileImage({ src, alt, size = 40, style = {}, className = '' }) {
  const stableSrc = stableImageUrl(src);
  const fallbackInitial = (alt || '?')[0].toUpperCase();

  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    ...style,
  };

  if (!stableSrc) {
    return (
      <div
        className={className}
        style={{
          ...baseStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#E6D5C3',
          color: '#6B5344',
          fontWeight: 600,
          fontSize: `${Math.round(size * 0.4)}px`,
        }}
      >
        {fallbackInitial}
      </div>
    );
  }

  return (
    <img
      src={stableSrc}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      className={className}
      style={baseStyle}
    />
  );
}

export default memo(ProfileImage);
export { stableImageUrl };
