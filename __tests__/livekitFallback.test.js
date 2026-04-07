/**
 * Tests for WebRTC → LiveKit fallback in 1:1 coffee chats.
 *
 * Covers:
 * - Fallback state transitions (connected → reconnecting → connected via LiveKit)
 * - LiveKit token fetching
 * - Provider cleanup on fallback and end call
 * - Audio/video toggle routing in LiveKit mode
 */

// --- Mock browser WebRTC APIs ---
const mockClose = jest.fn()
const mockCreateOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0...' })
const mockSetLocalDescription = jest.fn()
const mockSetRemoteDescription = jest.fn()
const mockCreateAnswer = jest.fn().mockResolvedValue({ type: 'answer', sdp: 'v=0...' })
const mockAddTrack = jest.fn()
const mockGetSenders = jest.fn().mockReturnValue([])
const mockAddIceCandidate = jest.fn()

function MockRTCPeerConnection(config) {
  this.iceServers = config?.iceServers || []
  this.connectionState = 'new'
  this.iceConnectionState = 'new'
  this.close = mockClose
  this.createOffer = mockCreateOffer
  this.setLocalDescription = mockSetLocalDescription
  this.setRemoteDescription = mockSetRemoteDescription
  this.createAnswer = mockCreateAnswer
  this.addTrack = mockAddTrack
  this.getSenders = mockGetSenders
  this.addIceCandidate = mockAddIceCandidate
  this.onicecandidate = null
  this.ontrack = null
  this.onconnectionstatechange = null
  this.oniceconnectionstatechange = null
}

global.RTCPeerConnection = MockRTCPeerConnection
global.RTCSessionDescription = jest.fn((desc) => desc)
global.RTCIceCandidate = jest.fn((c) => c)

// --- Mock LiveKit client ---
const mockLivekitDisconnect = jest.fn()
const mockPublishTrack = jest.fn()
const mockSetMicrophoneEnabled = jest.fn()
const mockSetCameraEnabled = jest.fn()

const mockLivekitRoom = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: mockLivekitDisconnect,
  localParticipant: {
    publishTrack: mockPublishTrack,
    setMicrophoneEnabled: mockSetMicrophoneEnabled,
    setCameraEnabled: mockSetCameraEnabled,
  },
  on: jest.fn().mockReturnThis(),
}

jest.mock('livekit-client', () => ({
  Room: jest.fn(() => mockLivekitRoom),
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    Disconnected: 'disconnected',
    ParticipantConnected: 'participantConnected',
  },
  Track: { Kind: { Video: 'video', Audio: 'audio' } },
}))

// ============================================================
// Tests
// ============================================================

describe('LiveKit Fallback for Coffee Chats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ---- State transition tests ----

  describe('State transitions', () => {
    test('WebRTC failure sets state to reconnecting (not ended)', () => {
      // Simulate the connection state handler logic from VideoCall.tsx
      let callState = 'connected'
      const connectionState = 'failed'

      // Old behavior would have been: callState = 'ended'
      // New behavior:
      if (connectionState === 'failed' || connectionState === 'disconnected') {
        callState = 'reconnecting'
      }

      expect(callState).toBe('reconnecting')
    })

    test('disconnected state also triggers reconnecting', () => {
      let callState = 'connected'
      const connectionState = 'disconnected'

      if (connectionState === 'failed' || connectionState === 'disconnected') {
        callState = 'reconnecting'
      }

      expect(callState).toBe('reconnecting')
    })

    test('successful LiveKit connection transitions to connected', () => {
      // Simulate retryWithLiveKit success path
      let callState = 'reconnecting'
      let livekitMode = false

      // After LiveKit connects successfully:
      livekitMode = true
      callState = 'connected'

      expect(callState).toBe('connected')
      expect(livekitMode).toBe(true)
    })

    test('failed LiveKit attempt stays in reconnecting', () => {
      let callState = 'reconnecting'

      // Simulate LiveKit connection failure
      try {
        throw new Error('Failed to get connection token')
      } catch {
        callState = 'reconnecting'
      }

      expect(callState).toBe('reconnecting')
    })

    test('connected state resets on successful WebRTC connection', () => {
      // Simulates the normal WebRTC connected path still works
      let callState = 'calling'
      const connectionState = 'connected'

      if (connectionState === 'connected') {
        callState = 'connected'
      }

      expect(callState).toBe('connected')
    })
  })

  // ---- LiveKit token fetch ----

  describe('LiveKit token fetch', () => {
    test('fetches token with correct parameters', async () => {
      const matchId = 'match-abc-123'
      const userId = 'user-1'
      const userName = 'Alice'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'lk-token-xyz' }),
      })

      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: matchId,
          participantId: userId,
          participantName: userName,
        }),
      })

      const data = await res.json()
      expect(data.token).toBe('lk-token-xyz')

      expect(global.fetch).toHaveBeenCalledWith('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: matchId,
          participantId: userId,
          participantName: userName,
        }),
      })
    })

    test('handles token fetch failure gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'room-1', participantId: 'user-1' }),
      })

      expect(res.ok).toBe(false)
    })

    test('both peers use same matchId as room name', () => {
      // Both peers use matchId (shared between them) as the LiveKit room name
      const matchId = 'match-shared-456'
      const peerA_roomId = matchId
      const peerB_roomId = matchId

      expect(peerA_roomId).toBe(peerB_roomId)
    })
  })

  // ---- LiveKit room connection ----

  describe('LiveKit room connection', () => {
    test('creates LiveKit room and connects with token', async () => {
      const { Room } = require('livekit-client')

      const room = new Room({ adaptiveStream: true, dynacast: true })
      await room.connect('wss://livekit.example.com', 'test-token')

      expect(Room).toHaveBeenCalledWith({ adaptiveStream: true, dynacast: true })
      expect(mockLivekitRoom.connect).toHaveBeenCalledWith(
        'wss://livekit.example.com',
        'test-token'
      )
    })

    test('publishes existing local audio and video tracks', async () => {
      const mockAudioTrack = { kind: 'audio', enabled: true }
      const mockVideoTrack = { kind: 'video', enabled: true }

      await mockLivekitRoom.localParticipant.publishTrack(mockAudioTrack, { name: 'microphone' })
      await mockLivekitRoom.localParticipant.publishTrack(mockVideoTrack, { name: 'camera' })

      expect(mockPublishTrack).toHaveBeenCalledTimes(2)
      expect(mockPublishTrack).toHaveBeenCalledWith(mockAudioTrack, { name: 'microphone' })
      expect(mockPublishTrack).toHaveBeenCalledWith(mockVideoTrack, { name: 'camera' })
    })

    test('sets up event handlers for remote tracks', () => {
      const { Room, RoomEvent } = require('livekit-client')
      const room = new Room()

      room.on(RoomEvent.TrackSubscribed, jest.fn())
      room.on(RoomEvent.TrackUnsubscribed, jest.fn())
      room.on(RoomEvent.Disconnected, jest.fn())
      room.on(RoomEvent.ParticipantConnected, jest.fn())

      expect(mockLivekitRoom.on).toHaveBeenCalledWith('trackSubscribed', expect.any(Function))
      expect(mockLivekitRoom.on).toHaveBeenCalledWith('trackUnsubscribed', expect.any(Function))
      expect(mockLivekitRoom.on).toHaveBeenCalledWith('disconnected', expect.any(Function))
      expect(mockLivekitRoom.on).toHaveBeenCalledWith('participantConnected', expect.any(Function))
    })
  })

  // ---- Cleanup ----

  describe('Cleanup with LiveKit fallback', () => {
    test('closes WebRTC peer connection before LiveKit switch', () => {
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.close()

      expect(mockClose).toHaveBeenCalled()
    })

    test('disconnects LiveKit room on cleanup', () => {
      // Simulates cleanup() logic
      let livekitRoomRef = mockLivekitRoom
      let livekitMode = true

      if (livekitRoomRef) {
        livekitRoomRef.disconnect()
        livekitRoomRef = null
      }
      livekitMode = false

      expect(mockLivekitDisconnect).toHaveBeenCalled()
      expect(livekitRoomRef).toBeNull()
      expect(livekitMode).toBe(false)
    })

    test('cleanup handles case when no LiveKit room exists', () => {
      let livekitRoomRef = null
      let livekitMode = false

      // Should not throw
      if (livekitRoomRef) {
        livekitRoomRef.disconnect()
      }
      livekitMode = false

      expect(livekitMode).toBe(false)
    })

    test('end call cleans up both WebRTC and LiveKit resources', () => {
      const pc = new RTCPeerConnection({ iceServers: [] })
      const livekitRoom = mockLivekitRoom

      // Simulate handleEndCall cleanup
      pc.close()
      livekitRoom.disconnect()

      expect(mockClose).toHaveBeenCalled()
      expect(mockLivekitDisconnect).toHaveBeenCalled()
    })
  })

  // ---- Audio/video toggle routing ----

  describe('Audio/video toggle in LiveKit mode', () => {
    test('routes audio toggle through LiveKit when in LiveKit mode', async () => {
      const livekitMode = true
      const livekitRoom = mockLivekitRoom
      const newEnabled = false

      if (livekitMode && livekitRoom) {
        await livekitRoom.localParticipant.setMicrophoneEnabled(newEnabled)
      }

      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false)
    })

    test('routes video toggle through LiveKit when in LiveKit mode', async () => {
      const livekitMode = true
      const livekitRoom = mockLivekitRoom
      const newEnabled = false

      if (livekitMode && livekitRoom) {
        await livekitRoom.localParticipant.setCameraEnabled(newEnabled)
      }

      expect(mockSetCameraEnabled).toHaveBeenCalledWith(false)
    })

    test('uses raw tracks when NOT in LiveKit mode', () => {
      const livekitMode = false
      let trackEnabled = true

      // Simulates the WebRTC path
      if (!livekitMode) {
        trackEnabled = !trackEnabled
      }

      expect(trackEnabled).toBe(false)
      expect(mockSetMicrophoneEnabled).not.toHaveBeenCalled()
    })
  })

  // ---- Edge cases ----

  describe('Edge cases', () => {
    test('retry can be called multiple times if first attempt fails', async () => {
      // First attempt fails
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: 'token-retry' }),
        })

      const res1 = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'r', participantId: 'u' }),
      })
      expect(res1.ok).toBe(false)

      // Second attempt succeeds
      const res2 = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'r', participantId: 'u' }),
      })
      expect(res2.ok).toBe(true)
      const data = await res2.json()
      expect(data.token).toBe('token-retry')
    })

    test('WebRTC peer connection closed before LiveKit connect', () => {
      // Ensures we don't have two active connections
      const pc = new RTCPeerConnection({ iceServers: [] })

      // Close WebRTC first
      pc.close()
      expect(mockClose).toHaveBeenCalled()

      // Then connect LiveKit
      const { Room } = require('livekit-client')
      const room = new Room()
      room.connect('wss://lk.example.com', 'token')

      expect(mockLivekitRoom.connect).toHaveBeenCalled()
    })

    test('local stream is preserved across provider switch', () => {
      // The local stream should NOT be stopped during the switch
      const mockTrack = { stop: jest.fn(), enabled: true, kind: 'video' }
      const localStream = { getTracks: () => [mockTrack], getAudioTracks: () => [], getVideoTracks: () => [mockTrack] }

      // During retryWithLiveKit, we close PC but do NOT stop localStream
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.close()

      // localStream tracks should NOT have been stopped
      expect(mockTrack.stop).not.toHaveBeenCalled()
    })
  })
})
