/**
 * Tests for ProfileImage component and stableImageUrl helper.
 *
 * Covers:
 * - URL query param stripping for cache stability
 * - Fallback initial rendering
 * - Edge cases (invalid URLs, null, empty string)
 */

import { stableImageUrl } from '@/components/ProfileImage';

describe('stableImageUrl', () => {
  test('strips query params from Supabase Storage URL', () => {
    const url = 'https://vcfcppjbeauxbxnkcgvm.supabase.co/storage/v1/object/public/avatars/user123.jpg?t=1712345678';
    expect(stableImageUrl(url)).toBe(
      'https://vcfcppjbeauxbxnkcgvm.supabase.co/storage/v1/object/public/avatars/user123.jpg'
    );
  });

  test('strips multiple query params', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/avatars/photo.png?t=123&v=2&cache=bust';
    expect(stableImageUrl(url)).toBe(
      'https://example.supabase.co/storage/v1/object/public/avatars/photo.png'
    );
  });

  test('returns same URL when no query params', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/avatars/photo.png';
    expect(stableImageUrl(url)).toBe(url);
  });

  test('returns null for null input', () => {
    expect(stableImageUrl(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(stableImageUrl(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(stableImageUrl('')).toBeNull();
  });

  test('returns original string for invalid URL', () => {
    expect(stableImageUrl('not-a-url')).toBe('not-a-url');
  });

  test('handles non-Supabase URLs', () => {
    const url = 'https://cdn.example.com/images/avatar.jpg?version=3';
    expect(stableImageUrl(url)).toBe('https://cdn.example.com/images/avatar.jpg');
  });

  test('preserves URL path with special characters', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/avatars/user%20photo.jpg?t=123';
    const result = stableImageUrl(url);
    expect(result).toContain('user%20photo.jpg');
    expect(result).not.toContain('?');
  });
});
