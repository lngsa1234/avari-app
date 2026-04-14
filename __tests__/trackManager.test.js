/**
 * Tests for lib/video/trackManager.js — unified track attach/detach logic
 * across WebRTC, LiveKit, and Agora providers.
 *
 * The scanner flagged this file for missing "data deletion" coverage.
 * For a track manager, that means the detach paths — untested detachment
 * is the source of:
 *
 *   - "my camera stayed on after I left the call"
 *   - "remote video element is still in the DOM after the peer left"
 *   - "srcObject leak holds the MediaStream alive"
 *
 * Tests run in jsdom (default per jest.config.js). MediaStream and
 * MediaStreamTrack are not part of jsdom, so we stub them globally.
 */

// ─── Stub WebRTC globals that jsdom doesn't provide ─────────────────

class StubMediaStream {
  constructor(tracks = []) {
    this._tracks = tracks
    this.active = true
  }
  getTracks() {
    return this._tracks
  }
}

class StubMediaStreamTrack {
  constructor({ readyState = 'live' } = {}) {
    this.readyState = readyState
  }
}

global.MediaStream = StubMediaStream
global.MediaStreamTrack = StubMediaStreamTrack

// ─── Imports (after globals are stubbed) ────────────────────────────

const {
  attachTrack,
  detachTrack,
  attachLocalTrack,
  detachLocalTrack,
  isTrackValid,
} = require('@/lib/video/trackManager')

// ─── Helpers ────────────────────────────────────────────────────────

function makeLiveKitTrack(overrides = {}) {
  return {
    attach: jest.fn(),
    detach: jest.fn(),
    isMuted: false,
    ...overrides,
  }
}

function makeAgoraTrack(overrides = {}) {
  return {
    play: jest.fn(),
    isPlaying: true,
    _enabled: true,
    ...overrides,
  }
}

function makeDiv() {
  return document.createElement('div')
}

function makeVideo() {
  return document.createElement('video')
}

// Silence the console so a failing attach/detach branch doesn't
// pollute test output while we assert on behavior
let errorSpy, warnSpy
beforeEach(() => {
  jest.clearAllMocks()
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
})

// ─── attachTrack: null / invalid input ──────────────────────────────

describe('attachTrack — guards', () => {
  test('null track is a no-op, does not throw', () => {
    const el = makeDiv()
    expect(() => attachTrack(null, el, 'webrtc')).not.toThrow()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  test('null element is a no-op', () => {
    expect(() => attachTrack(makeLiveKitTrack(), null, 'livekit')).not.toThrow()
  })

  test('unknown provider logs a warning', () => {
    attachTrack({}, makeDiv(), 'bogus')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown provider'),
      'bogus'
    )
  })
})

// ─── attachTrack: livekit ───────────────────────────────────────────

describe('attachTrack — livekit', () => {
  test('creates a <video> child inside a div container and calls track.attach on it', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()

    attachTrack(track, container, 'livekit', 'video')

    const child = container.querySelector('video')
    expect(child).not.toBeNull()
    expect(child.autoplay).toBe(true)
    expect(child.playsInline).toBe(true)
    expect(track.attach).toHaveBeenCalledWith(child)
    // Remote video must not be mirrored
    expect(child.style.getPropertyValue('transform')).toBe('none')
  })

  test('creates an <audio> child when trackType is audio', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()

    attachTrack(track, container, 'livekit', 'audio')

    expect(container.querySelector('audio')).not.toBeNull()
    expect(container.querySelector('video')).toBeNull()
    expect(track.attach).toHaveBeenCalled()
  })

  test('reuses an existing <video> child instead of creating a second one', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()
    const existing = makeVideo()
    container.appendChild(existing)

    attachTrack(track, container, 'livekit', 'video')

    expect(container.querySelectorAll('video').length).toBe(1)
    expect(track.attach).toHaveBeenCalledWith(existing)
  })

  test('track without attach method is a silent no-op', () => {
    const track = { detach: jest.fn() } // no attach
    expect(() => attachTrack(track, makeDiv(), 'livekit', 'video')).not.toThrow()
  })
})

// ─── attachTrack: agora ─────────────────────────────────────────────

describe('attachTrack — agora', () => {
  test('video tracks call play(element, { fit: "cover" })', () => {
    const track = makeAgoraTrack()
    const el = makeDiv()

    attachTrack(track, el, 'agora', 'video')

    expect(track.play).toHaveBeenCalledWith(el, { fit: 'cover' })
  })

  test('audio tracks call play() with no arguments', () => {
    const track = makeAgoraTrack()
    const el = makeDiv()

    attachTrack(track, el, 'agora', 'audio')

    expect(track.play).toHaveBeenCalledWith()
  })

  test('track without play method is a silent no-op', () => {
    const track = {} // no play
    expect(() => attachTrack(track, makeDiv(), 'agora', 'video')).not.toThrow()
  })
})

// ─── attachTrack: webrtc ────────────────────────────────────────────

describe('attachTrack — webrtc', () => {
  test('MediaStream is assigned directly to srcObject on a new video child', () => {
    const stream = new StubMediaStream([new StubMediaStreamTrack()])
    const container = makeDiv()

    attachTrack(stream, container, 'webrtc', 'video')

    const child = container.querySelector('video')
    expect(child).not.toBeNull()
    expect(child.srcObject).toBe(stream)
    // Video element must be muted (audio is played via separate audio element)
    expect(child.muted).toBe(true)
    // Remote video must not be mirrored
    expect(child.style.getPropertyValue('transform')).toBe('none')
  })

  test('MediaStreamTrack is wrapped in a fresh MediaStream', () => {
    const track = new StubMediaStreamTrack()
    const container = makeDiv()

    attachTrack(track, container, 'webrtc', 'video')

    const child = container.querySelector('video')
    expect(child.srcObject).toBeInstanceOf(StubMediaStream)
    expect(child.srcObject.getTracks()).toEqual([track])
  })

  test('object with .mediaStreamTrack is wrapped in a fresh MediaStream', () => {
    const inner = new StubMediaStreamTrack()
    const provider = { mediaStreamTrack: inner }
    const container = makeDiv()

    attachTrack(provider, container, 'webrtc', 'video')

    const child = container.querySelector('video')
    expect(child.srcObject.getTracks()).toEqual([inner])
  })

  test('reuses existing <video> child instead of creating a second one', () => {
    const stream = new StubMediaStream([new StubMediaStreamTrack()])
    const container = makeDiv()
    const existing = makeVideo()
    container.appendChild(existing)

    attachTrack(stream, container, 'webrtc', 'video')

    expect(container.querySelectorAll('video').length).toBe(1)
    expect(existing.srcObject).toBe(stream)
  })

  test('audio tracks create an <audio> child instead of <video>', () => {
    const stream = new StubMediaStream([new StubMediaStreamTrack()])
    const container = makeDiv()

    attachTrack(stream, container, 'webrtc', 'audio')

    expect(container.querySelector('audio')).not.toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })
})

// ─── detachTrack: the scanner's actual concern ──────────────────────

describe('detachTrack — livekit', () => {
  test('finds video child in a div container, calls track.detach, removes child', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()
    const child = makeVideo()
    container.appendChild(child)

    detachTrack(track, container, 'livekit')

    expect(track.detach).toHaveBeenCalledWith(child)
    expect(container.querySelector('video')).toBeNull()
  })

  test('prefers video child over audio child when both exist', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()
    const audioChild = document.createElement('audio')
    const videoChild = makeVideo()
    container.appendChild(audioChild)
    container.appendChild(videoChild)

    detachTrack(track, container, 'livekit')

    expect(track.detach).toHaveBeenCalledWith(videoChild)
    // The audio child remains because the implementation only removes the video
    expect(container.querySelector('audio')).not.toBeNull()
  })

  test('calls detach directly when element is not a div container', () => {
    const track = makeLiveKitTrack()
    const videoEl = makeVideo()

    detachTrack(track, videoEl, 'livekit')

    expect(track.detach).toHaveBeenCalledWith(videoEl)
  })

  test('track without detach method is a silent no-op', () => {
    const track = {}
    const container = makeDiv()
    container.appendChild(makeVideo())

    expect(() => detachTrack(track, container, 'livekit')).not.toThrow()
    // Video child is still there because detach was never called
    expect(container.querySelector('video')).not.toBeNull()
  })
})

describe('detachTrack — webrtc', () => {
  test('clears srcObject on a child media element and removes it', () => {
    const container = makeDiv()
    const child = makeVideo()
    child.srcObject = new StubMediaStream([new StubMediaStreamTrack()])
    container.appendChild(child)

    detachTrack(null, container, 'webrtc')

    expect(child.srcObject).toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })

  test('clears srcObject on a direct media element without removing it', () => {
    const videoEl = makeVideo()
    videoEl.srcObject = new StubMediaStream([new StubMediaStreamTrack()])

    detachTrack(null, videoEl, 'webrtc')

    expect(videoEl.srcObject).toBeNull()
  })

  test('prefers video over audio when removing child', () => {
    const container = makeDiv()
    const audioChild = document.createElement('audio')
    const videoChild = makeVideo()
    videoChild.srcObject = new StubMediaStream([])
    container.appendChild(audioChild)
    container.appendChild(videoChild)

    detachTrack(null, container, 'webrtc')

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('audio')).not.toBeNull()
  })
})

describe('detachTrack — agora', () => {
  test('is a deliberate no-op (does NOT call track.stop())', () => {
    // Agora tracks are managed by the SDK; calling stop() on them tears
    // them down completely. This regression test locks in the no-op.
    const track = {
      play: jest.fn(),
      stop: jest.fn(),
      close: jest.fn(),
    }
    const container = makeDiv()

    detachTrack(track, container, 'agora')

    expect(track.stop).not.toHaveBeenCalled()
    expect(track.close).not.toHaveBeenCalled()
    expect(track.play).not.toHaveBeenCalled()
  })
})

describe('detachTrack — guards and fallback', () => {
  test('null element is a no-op', () => {
    expect(() => detachTrack(makeLiveKitTrack(), null, 'livekit')).not.toThrow()
  })

  test('unknown provider falls back to clearing srcObject', () => {
    const videoEl = makeVideo()
    videoEl.srcObject = new StubMediaStream([])

    detachTrack(null, videoEl, 'bogus-provider')

    expect(videoEl.srcObject).toBeNull()
  })

  test('errors during detach are swallowed silently', () => {
    const track = {
      detach: jest.fn(() => {
        throw new Error('detach failed')
      }),
    }
    const container = makeDiv()
    container.appendChild(makeVideo())

    expect(() => detachTrack(track, container, 'livekit')).not.toThrow()
    // No error logged — swallow comment says "Ignore detach errors"
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

// ─── Local wrappers ─────────────────────────────────────────────────

describe('attachLocalTrack / detachLocalTrack — delegate to attach/detachTrack', () => {
  test('attachLocalTrack delegates with trackType=video', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()

    attachLocalTrack(track, container, 'livekit')

    expect(container.querySelector('video')).not.toBeNull()
    expect(track.attach).toHaveBeenCalled()
  })

  test('detachLocalTrack delegates cleanup', () => {
    const track = makeLiveKitTrack()
    const container = makeDiv()
    container.appendChild(makeVideo())

    detachLocalTrack(track, container, 'livekit')

    expect(track.detach).toHaveBeenCalled()
    expect(container.querySelector('video')).toBeNull()
  })
})

// ─── isTrackValid ───────────────────────────────────────────────────

describe('isTrackValid', () => {
  test('null track is always invalid', () => {
    expect(isTrackValid(null, 'agora')).toBe(false)
    expect(isTrackValid(null, 'livekit')).toBe(false)
    expect(isTrackValid(null, 'webrtc')).toBe(false)
    expect(isTrackValid(undefined, 'webrtc')).toBe(false)
  })

  test('agora: valid when isPlaying is defined (regardless of value)', () => {
    expect(isTrackValid({ isPlaying: true }, 'agora')).toBe(true)
    expect(isTrackValid({ isPlaying: false }, 'agora')).toBe(true)
  })

  test('agora: valid when _enabled is not explicitly false', () => {
    expect(isTrackValid({ _enabled: true }, 'agora')).toBe(true)
    expect(isTrackValid({ _enabled: false }, 'agora')).toBe(false)
  })

  test('livekit: valid when not muted', () => {
    expect(isTrackValid({ isMuted: false }, 'livekit')).toBe(true)
    expect(isTrackValid({ isMuted: true }, 'livekit')).toBe(false)
  })

  test('webrtc MediaStream: valid when active AND has tracks', () => {
    const active = new StubMediaStream([new StubMediaStreamTrack()])
    expect(isTrackValid(active, 'webrtc')).toBe(true)

    const empty = new StubMediaStream([])
    expect(isTrackValid(empty, 'webrtc')).toBe(false)

    const inactive = new StubMediaStream([new StubMediaStreamTrack()])
    inactive.active = false
    expect(isTrackValid(inactive, 'webrtc')).toBe(false)
  })

  test('webrtc MediaStreamTrack: valid only when readyState is live', () => {
    expect(isTrackValid(new StubMediaStreamTrack({ readyState: 'live' }), 'webrtc')).toBe(true)
    expect(isTrackValid(new StubMediaStreamTrack({ readyState: 'ended' }), 'webrtc')).toBe(false)
  })

  test('unknown provider falls back to truthiness', () => {
    expect(isTrackValid({ any: 'object' }, 'bogus')).toBe(true)
    expect(isTrackValid(0, 'bogus')).toBe(false)
  })
})
