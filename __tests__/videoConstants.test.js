/**
 * Tests for lib/video/videoConstants.js — shared video styling constants.
 */

import {
  VIDEO_SIZE_CLASSES,
  AVATAR_SIZE_CLASSES,
  LABEL_SIZE_CLASSES,
  ACCENT_COLORS,
  CONNECTION_QUALITY_COLORS,
  CONNECTION_QUALITY_LABELS,
  getAccentColor,
  getConnectionQualityColor,
  getConnectionQualityLabel,
} from '@/lib/video/videoConstants'

describe('constants', () => {
  test('VIDEO_SIZE_CLASSES has full, grid, thumbnail', () => {
    expect(VIDEO_SIZE_CLASSES.full).toBeDefined()
    expect(VIDEO_SIZE_CLASSES.grid).toBeDefined()
    expect(VIDEO_SIZE_CLASSES.thumbnail).toBeDefined()
  })

  test('AVATAR_SIZE_CLASSES has full, grid, thumbnail', () => {
    expect(AVATAR_SIZE_CLASSES.full).toBeDefined()
    expect(AVATAR_SIZE_CLASSES.grid).toBeDefined()
    expect(AVATAR_SIZE_CLASSES.thumbnail).toBeDefined()
  })

  test('LABEL_SIZE_CLASSES has full, grid, thumbnail', () => {
    expect(LABEL_SIZE_CLASSES.full).toBeDefined()
    expect(LABEL_SIZE_CLASSES.grid).toBeDefined()
    expect(LABEL_SIZE_CLASSES.thumbnail).toBeDefined()
  })

  test('ACCENT_COLORS has default', () => {
    expect(ACCENT_COLORS.default).toBeDefined()
    expect(ACCENT_COLORS.mocha).toBeDefined()
  })

  test('CONNECTION_QUALITY has all levels', () => {
    expect(CONNECTION_QUALITY_COLORS.excellent).toBeDefined()
    expect(CONNECTION_QUALITY_COLORS.good).toBeDefined()
    expect(CONNECTION_QUALITY_COLORS.fair).toBeDefined()
    expect(CONNECTION_QUALITY_COLORS.poor).toBeDefined()
    expect(CONNECTION_QUALITY_COLORS.unknown).toBeDefined()
  })
})

describe('getAccentColor', () => {
  test('returns color for known accents', () => {
    expect(getAccentColor('mocha')).toBe(ACCENT_COLORS.mocha)
    expect(getAccentColor('rose')).toBe(ACCENT_COLORS.rose)
  })

  test('returns default for unknown accent', () => {
    expect(getAccentColor('neon')).toBe(ACCENT_COLORS.default)
  })
})

describe('getConnectionQualityColor', () => {
  test('returns color for known quality levels', () => {
    expect(getConnectionQualityColor('excellent')).toBe(CONNECTION_QUALITY_COLORS.excellent)
    expect(getConnectionQualityColor('poor')).toBe(CONNECTION_QUALITY_COLORS.poor)
  })

  test('returns unknown for invalid quality', () => {
    expect(getConnectionQualityColor('terrible')).toBe(CONNECTION_QUALITY_COLORS.unknown)
  })
})

describe('getConnectionQualityLabel', () => {
  test('returns label for known quality levels', () => {
    expect(getConnectionQualityLabel('excellent')).toBe('Excellent')
    expect(getConnectionQualityLabel('poor')).toBe('Poor')
  })

  test('returns Unknown for invalid quality', () => {
    expect(getConnectionQualityLabel('terrible')).toBe('Unknown')
  })
})
