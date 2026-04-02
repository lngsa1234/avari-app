/**
 * Tests for lib/video/callTypeConfig.js — call type configuration.
 */

import {
  CALL_TYPE_CONFIG,
  getCallTypeConfig,
  getValidCallTypes,
  isValidCallType,
  getInternalType,
  getChannelName,
} from '@/lib/video/callTypeConfig'

describe('CALL_TYPE_CONFIG', () => {
  test('has coffee, meetup, and circle types', () => {
    expect(CALL_TYPE_CONFIG.coffee).toBeDefined()
    expect(CALL_TYPE_CONFIG.meetup).toBeDefined()
    expect(CALL_TYPE_CONFIG.circle).toBeDefined()
  })

  test('coffee uses webrtc provider', () => {
    expect(CALL_TYPE_CONFIG.coffee.provider).toBe('webrtc')
    expect(CALL_TYPE_CONFIG.coffee.internalType).toBe('1on1')
  })

  test('meetup uses agora provider', () => {
    expect(CALL_TYPE_CONFIG.meetup.provider).toBe('agora')
    expect(CALL_TYPE_CONFIG.meetup.internalType).toBe('meetup')
  })

  test('circle uses agora provider', () => {
    expect(CALL_TYPE_CONFIG.circle.provider).toBe('agora')
    expect(CALL_TYPE_CONFIG.circle.internalType).toBe('group')
  })

  test('coffee has max 2 participants', () => {
    expect(CALL_TYPE_CONFIG.coffee.features.maxParticipants).toBe(2)
  })

  test('circle has max 17 participants', () => {
    expect(CALL_TYPE_CONFIG.circle.features.maxParticipants).toBe(17)
  })

  test('meetup has max 100 participants', () => {
    expect(CALL_TYPE_CONFIG.meetup.features.maxParticipants).toBe(100)
  })

  test('coffee enables screen share', () => {
    expect(CALL_TYPE_CONFIG.coffee.features.screenShare).toBe(true)
  })

  test('meetup and circle enable screen share', () => {
    expect(CALL_TYPE_CONFIG.meetup.features.screenShare).toBe(true)
    expect(CALL_TYPE_CONFIG.circle.features.screenShare).toBe(true)
  })
})

describe('getCallTypeConfig', () => {
  test('returns config for valid types', () => {
    expect(getCallTypeConfig('coffee')).toBe(CALL_TYPE_CONFIG.coffee)
    expect(getCallTypeConfig('meetup')).toBe(CALL_TYPE_CONFIG.meetup)
    expect(getCallTypeConfig('circle')).toBe(CALL_TYPE_CONFIG.circle)
  })

  test('returns null for invalid type', () => {
    expect(getCallTypeConfig('invalid')).toBeNull()
    expect(getCallTypeConfig('')).toBeNull()
    expect(getCallTypeConfig(null)).toBeNull()
  })
})

describe('getValidCallTypes', () => {
  test('returns all 3 call types', () => {
    const types = getValidCallTypes()
    expect(types).toContain('coffee')
    expect(types).toContain('meetup')
    expect(types).toContain('circle')
    expect(types).toHaveLength(3)
  })
})

describe('isValidCallType', () => {
  test('returns true for valid types', () => {
    expect(isValidCallType('coffee')).toBe(true)
    expect(isValidCallType('meetup')).toBe(true)
    expect(isValidCallType('circle')).toBe(true)
  })

  test('returns false for invalid types', () => {
    expect(isValidCallType('zoom')).toBe(false)
    expect(isValidCallType('')).toBe(false)
  })
})

describe('getInternalType', () => {
  test('returns internal type for valid call types', () => {
    expect(getInternalType('coffee')).toBe('1on1')
    expect(getInternalType('meetup')).toBe('meetup')
    expect(getInternalType('circle')).toBe('group')
  })

  test('defaults to 1on1 for unknown types', () => {
    expect(getInternalType('unknown')).toBe('1on1')
  })
})

describe('getChannelName', () => {
  test('prepends channel prefix for meetup', () => {
    expect(getChannelName('meetup', 'room-123')).toBe('meetup-room-123')
  })

  test('prepends channel prefix for circle', () => {
    expect(getChannelName('circle', 'room-456')).toBe('connection-group-room-456')
  })

  test('no prefix for coffee', () => {
    expect(getChannelName('coffee', 'room-789')).toBe('room-789')
  })

  test('returns roomId for unknown type', () => {
    expect(getChannelName('unknown', 'room-abc')).toBe('room-abc')
  })
})
