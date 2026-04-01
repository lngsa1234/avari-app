/**
 * Tests for lib/designTokens.js — design system constants and helpers.
 */

import { colors, fonts, spacing, radii, breakpoints, isMobileWidth } from '@/lib/designTokens'
import designTokens from '@/lib/designTokens'

describe('colors', () => {
  test('primary colors are defined', () => {
    expect(colors.primary).toBe('#8B6F5C')
    expect(colors.primaryDark).toBe('#6B5344')
    expect(colors.primaryLight).toBe('#A89080')
  })

  test('background colors are defined', () => {
    expect(colors.bg).toBe('#FDF8F3')
    expect(colors.white).toBe('#FFFFFF')
  })

  test('text hierarchy is defined', () => {
    expect(colors.text).toBeDefined()
    expect(colors.textSecondary).toBeDefined()
    expect(colors.textLight).toBeDefined()
    expect(colors.textMuted).toBeDefined()
  })

  test('status colors are defined', () => {
    expect(colors.success).toBeDefined()
    expect(colors.error).toBeDefined()
    expect(colors.warning).toBeDefined()
    expect(colors.online).toBeDefined()
  })
})

describe('fonts', () => {
  test('serif includes Lora', () => {
    expect(fonts.serif).toContain('Lora')
  })

  test('sans includes DM Sans', () => {
    expect(fonts.sans).toContain('DM Sans')
  })
})

describe('spacing', () => {
  test('uses 4px base scale', () => {
    expect(spacing.xs).toBe('4px')
    expect(spacing.sm).toBe('8px')
    expect(spacing.lg).toBe('16px')
  })
})

describe('radii', () => {
  test('provides size scale', () => {
    expect(radii.sm).toBe('6px')
    expect(radii.full).toBe('9999px')
  })
})

describe('breakpoints', () => {
  test('mobile is 640', () => {
    expect(breakpoints.mobile).toBe(640)
  })

  test('tablet is 860', () => {
    expect(breakpoints.tablet).toBe(860)
  })
})

describe('isMobileWidth', () => {
  const originalInnerWidth = global.innerWidth

  afterEach(() => {
    Object.defineProperty(global, 'innerWidth', { value: originalInnerWidth, writable: true })
  })

  test('returns true when window width is below breakpoint', () => {
    Object.defineProperty(global, 'innerWidth', { value: 500, writable: true })
    expect(isMobileWidth(640)).toBe(true)
  })

  test('returns false when window width is at or above breakpoint', () => {
    Object.defineProperty(global, 'innerWidth', { value: 640, writable: true })
    expect(isMobileWidth(640)).toBe(false)
  })

  test('defaults to mobile breakpoint (640)', () => {
    Object.defineProperty(global, 'innerWidth', { value: 500, writable: true })
    expect(isMobileWidth()).toBe(true)
  })

  test('works with custom breakpoint', () => {
    Object.defineProperty(global, 'innerWidth', { value: 800, writable: true })
    expect(isMobileWidth(860)).toBe(true)
    expect(isMobileWidth(640)).toBe(false)
  })
})

describe('default export', () => {
  test('includes all token groups', () => {
    expect(designTokens.colors).toBe(colors)
    expect(designTokens.fonts).toBe(fonts)
    expect(designTokens.spacing).toBe(spacing)
    expect(designTokens.radii).toBe(radii)
    expect(designTokens.breakpoints).toBe(breakpoints)
    expect(designTokens.isMobileWidth).toBe(isMobileWidth)
  })
})
