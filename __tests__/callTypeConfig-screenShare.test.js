/**
 * Tests for call type configuration updates (2026-04-01)
 * - Screen sharing enabled for coffee chats
 * - Default transcription language
 */

const { CALL_TYPE_CONFIG, getCallTypeConfig } = require('../lib/video/callTypeConfig')

describe('coffee chat screen sharing', () => {
  test('coffee chats have screen share enabled', () => {
    expect(CALL_TYPE_CONFIG.coffee.features.screenShare).toBe(true)
  })

  test('meetup has screen share enabled', () => {
    expect(CALL_TYPE_CONFIG.meetup.features.screenShare).toBe(true)
  })

  test('circle has screen share enabled', () => {
    expect(CALL_TYPE_CONFIG.circle.features.screenShare).toBe(true)
  })
})

describe('coffee chat provider', () => {
  test('coffee uses webrtc provider', () => {
    expect(CALL_TYPE_CONFIG.coffee.provider).toBe('webrtc')
  })

  test('meetup uses agora provider', () => {
    expect(CALL_TYPE_CONFIG.meetup.provider).toBe('agora')
  })

  test('circle uses agora provider', () => {
    expect(CALL_TYPE_CONFIG.circle.provider).toBe('agora')
  })
})

describe('getCallTypeConfig', () => {
  test('returns config for valid types', () => {
    expect(getCallTypeConfig('coffee')).toBeTruthy()
    expect(getCallTypeConfig('meetup')).toBeTruthy()
    expect(getCallTypeConfig('circle')).toBeTruthy()
  })

  test('returns null for invalid type', () => {
    expect(getCallTypeConfig('invalid')).toBeNull()
    expect(getCallTypeConfig('')).toBeNull()
  })

  test('coffee max participants is 2', () => {
    expect(getCallTypeConfig('coffee').features.maxParticipants).toBe(2)
  })
})
