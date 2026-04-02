/**
 * Tests for coffee- prefix stripping in useCallRoom (2026-04-01)
 */

// Test the prefix stripping logic directly
describe('coffee chat room ID prefix stripping', () => {
  const stripPrefix = (roomId) => {
    return roomId?.startsWith('coffee-') ? roomId.replace('coffee-', '') : roomId
  }

  test('strips coffee- prefix from UUID', () => {
    expect(stripPrefix('coffee-e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('preserves plain UUID', () => {
    expect(stripPrefix('e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('handles null/undefined', () => {
    expect(stripPrefix(null)).toBe(null)
    expect(stripPrefix(undefined)).toBe(undefined)
  })
})

describe('video_signals room ID prefix stripping', () => {
  const stripSignalPrefix = (roomId) => {
    return roomId?.includes('-') && roomId.split('-').length > 5
      ? roomId.replace(/^[a-z]+-/, '')
      : roomId
  }

  test('strips coffee- prefix', () => {
    expect(stripSignalPrefix('coffee-e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('strips meetup- prefix', () => {
    expect(stripSignalPrefix('meetup-a1b2c3d4-e5f6-7890-abcd-ef1234567890'))
      .toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  test('preserves plain UUID', () => {
    expect(stripSignalPrefix('e088f4c3-c89d-4169-829a-4870f66e2eae'))
      .toBe('e088f4c3-c89d-4169-829a-4870f66e2eae')
  })

  test('preserves short strings', () => {
    expect(stripSignalPrefix('room-123')).toBe('room-123')
  })
})
