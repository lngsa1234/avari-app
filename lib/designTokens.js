/**
 * Shared design tokens for CircleW.
 *
 * Single source of truth for colors, typography, spacing, and breakpoints.
 * Import from here instead of defining per-component color objects.
 *
 * Usage:
 *   import { colors, fonts, spacing, breakpoints } from '@/lib/designTokens'
 */

// ─── Colors ──────────────────────────────────────────────────────────
export const colors = {
  // Primary brand (warm brown)
  primary: '#8B6F5C',
  primaryDark: '#6B5344',
  primaryLight: '#A89080',
  primaryHover: '#7A5F4D',

  // Background surfaces
  bg: '#FDF8F3',
  bgAlt: '#FAF6F1',
  bgCard: '#F5EDE4',
  bgCardHover: '#EDE3D7',
  bgWarm: '#FFFAF5',
  bgPale: '#F5EFE8',
  white: '#FFFFFF',

  // Text hierarchy
  text: '#3D2B1F',
  textSecondary: '#584233',
  textLight: '#7A6855',
  textMuted: '#A89080',
  textSoft: 'rgba(107, 86, 71, 0.77)',

  // Borders
  border: 'rgba(139, 111, 92, 0.15)',
  borderMedium: 'rgba(139, 111, 92, 0.25)',
  borderHover: 'rgba(139, 111, 92, 0.3)',
  borderSolid: '#EDE6DF',

  // Interactive element colors
  buttonBg: '#5C4033',
  buttonHover: '#4A3228',
  buttonText: '#FAF5EF',
  selectedBg: 'rgba(139, 111, 92, 0.08)',

  // Status
  success: '#4CAF50',
  successBg: '#E8F5E9',
  error: '#C0392B',
  errorBg: 'rgba(192, 57, 43, 0.06)',
  errorBorder: 'rgba(192, 57, 43, 0.15)',
  warning: '#C4784A',
  online: '#5BA36B',

  // Accent palette (used in coffee chat recaps, profiles)
  sage: '#8B9E7E',
  gold: '#C9A96E',
  purple: '#9B7EC4',
  blue: '#4A6A8B',

  // Tags
  tagBg: '#EFE6DB',
  tagText: '#6B4F3A',

  // Shadows
  shadow: 'rgba(61, 43, 31, 0.08)',
  shadowMd: 'rgba(61, 43, 31, 0.12)',

  // Gradient (landing page, profile setup)
  gradient: 'linear-gradient(219.16deg, rgba(247, 242, 236, 0.96) 39.76%, rgba(240, 225, 213, 0.98) 67.53%, rgba(236, 217, 202, 0.99) 82.33%)',
}

// ─── Typography ──────────────────────────────────────────────────────
export const fonts = {
  serif: "'Lora', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

// ─── Spacing (4px base) ──────────────────────────────────────────────
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '48px',
  '5xl': '64px',
}

// ─── Border radius ───────────────────────────────────────────────────
export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
}

// ─── Breakpoints ─────────────────────────────────────────────────────
export const breakpoints = {
  mobile: 640,   // most components use this
  tablet: 860,   // MainApp uses this for nav layout
  desktop: 1024,
  wide: 1440,
}

/**
 * Hook-friendly mobile check. Use breakpoints.mobile for most components.
 * MainApp uses breakpoints.tablet for its specific nav layout needs.
 */
export function isMobileWidth(bp = breakpoints.mobile) {
  if (typeof window === 'undefined') return false
  return window.innerWidth < bp
}

// ─── Backward-compatible re-exports ──────────────────────────────────
// Components that destructure { colors, fonts } can import this default.
const designTokens = { colors, fonts, spacing, radii, breakpoints, isMobileWidth }
export default designTokens
