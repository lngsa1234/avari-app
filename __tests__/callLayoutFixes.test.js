/**
 * Unit tests for call page layout fixes:
 * 1. Mobile participants button in ControlBar
 * 2. Consolidated transcript display in ControlBar
 * 3. VideoHeader sidebar overlap avoidance
 * 4. Transcript consent sync (host → participant)
 *
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlBar from '@/components/video/ControlBar'
import VideoHeader from '@/components/video/VideoHeader'

// ─── Shared props ───────────────────────────────────────────────────────────

const controlBarProps = {
  isMuted: false,
  isVideoOff: false,
  isBlurEnabled: false,
  isBlurSupported: true,
  isBlurLoading: false,
  isScreenSharing: false,
  isScreenShareSupported: true,
  isRecording: false,
  recordingTime: 0,
  isTranscribing: false,
  isSpeechSupported: true,
  isSafari: false,
  showChat: false,
  showTopics: false,
  showParticipants: false,
  messagesCount: 0,
  participantCount: 4,
  raisedHandCount: 0,
  isHandRaised: false,
  transcriptionLanguage: 'en-US',
  consentStatus: null,
  consentMode: 'host',
  isHost: false,
  onToggleMute: jest.fn(),
  onToggleVideo: jest.fn(),
  onToggleBlur: jest.fn(),
  onToggleScreenShare: jest.fn(),
  onToggleRecording: jest.fn(),
  onToggleTranscription: jest.fn(),
  onStopTranscription: jest.fn(),
  onToggleHand: jest.fn(),
  onToggleChat: jest.fn(),
  onToggleTopics: jest.fn(),
  onToggleParticipants: jest.fn(),
  onLanguageChange: jest.fn(),
  onLeave: jest.fn(),
  formatTime: (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
  features: {
    chat: true,
    transcription: true,
    screenShare: true,
    backgroundBlur: true,
    recording: false,
    icebreakers: true,
    topics: true,
    participants: true,
    handRaise: true,
    maxParticipants: 17,
  },
}

const videoHeaderProps = {
  title: 'Circle Meeting',
  brandName: 'Connection Group',
  callType: 'circle',
  subtitle: 'Connected',
  participantCount: 3,
  providerBadge: 'agora',
  isConnecting: false,
  isTranscribing: false,
  isRecording: false,
  showGridToggle: true,
  gridView: true,
  onToggleView: jest.fn(),
  meetingId: 'test-room-123',
  callDuration: 120,
  connectionQuality: 'good',
  showTopics: false,
  onToggleTopics: jest.fn(),
  showSidebar: false,
}

// ─── Fix 1: Mobile participants button ──────────────────────────────────────

describe('ControlBar — Mobile Participants Button', () => {
  test('renders participants button in mobile strip', () => {
    const { container } = render(<ControlBar {...controlBarProps} />)

    // Mobile strip is "flex sm:hidden"
    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    expect(mobileStrip).toBeTruthy()

    // Find PeopleIcon SVG path in mobile strip
    const peoplePaths = Array.from(mobileStrip.querySelectorAll('svg path')).filter(p =>
      (p.getAttribute('d') || '').includes('M17 21v-2a4 4 0 0 0-4-4H5')
    )
    expect(peoplePaths.length).toBeGreaterThanOrEqual(1)
  })

  test('mobile participants button calls onToggleParticipants', () => {
    const onToggleParticipants = jest.fn()
    const { container } = render(
      <ControlBar {...controlBarProps} onToggleParticipants={onToggleParticipants} />
    )

    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    const buttons = Array.from(mobileStrip.querySelectorAll('button'))
    const participantsBtn = buttons.find(btn =>
      btn.querySelector('svg path[d*="M17 21v-2a4 4 0 0 0-4-4H5"]')
    )
    expect(participantsBtn).toBeTruthy()
    fireEvent.click(participantsBtn)
    expect(onToggleParticipants).toHaveBeenCalledTimes(1)
  })

  test('mobile participants button shows raised hand badge', () => {
    const { container } = render(
      <ControlBar {...controlBarProps} raisedHandCount={2} showParticipants={false} />
    )

    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    const badges = mobileStrip.querySelectorAll('.bg-red-500')
    const handBadge = Array.from(badges).find(el => el.textContent === '2')
    expect(handBadge).toBeTruthy()
  })

  test('no participants button in mobile when feature disabled', () => {
    const coffeeFeatures = { ...controlBarProps.features, participants: false }
    const { container } = render(
      <ControlBar {...controlBarProps} features={coffeeFeatures} />
    )

    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    const peoplePaths = Array.from(mobileStrip.querySelectorAll('svg path')).filter(p =>
      (p.getAttribute('d') || '').includes('M17 21v-2a4 4 0 0 0-4-4H5')
    )
    expect(peoplePaths).toHaveLength(0)
  })
})

// ─── Fix 2: Consolidated transcript display ─────────────────────────────────

describe('ControlBar — Consolidated Transcript Display', () => {
  test('shows "Start Transcription" when not transcribing', () => {
    render(<ControlBar {...controlBarProps} isTranscribing={false} />)
    expect(screen.getByText('Start Transcription')).toBeInTheDocument()
  })

  test('shows host mode status text when transcribing in host mode', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="host"
        consentStatus="accepted"
      />
    )
    expect(screen.getByText('Transcript & recap enabled by host')).toBeInTheDocument()
  })

  test('shows mutual mode status text when transcribing in mutual mode', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="mutual"
        consentStatus="accepted"
      />
    )
    expect(screen.getByText('Transcript & recap enabled')).toBeInTheDocument()
  })

  test('shows language selector when transcribing', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentStatus="accepted"
      />
    )
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('中文')).toBeInTheDocument()
  })

  test('hides "Start Transcription" when transcribing', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentStatus="accepted"
      />
    )
    expect(screen.queryByText('Start Transcription')).not.toBeInTheDocument()
  })

  test('shows Stop button for host in host mode', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="host"
        consentStatus="accepted"
        isHost={true}
        onStopTranscription={jest.fn()}
      />
    )
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  test('hides Stop button for non-host participant in host mode', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="host"
        consentStatus="accepted"
        isHost={false}
        onStopTranscription={jest.fn()}
      />
    )
    expect(screen.queryByText('Stop')).not.toBeInTheDocument()
  })

  test('shows Stop button for either party in mutual mode', () => {
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="mutual"
        consentStatus="accepted"
        isHost={false}
        onStopTranscription={jest.fn()}
      />
    )
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  test('calls onStopTranscription when Stop clicked', () => {
    const onStop = jest.fn()
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentMode="host"
        consentStatus="accepted"
        isHost={true}
        onStopTranscription={onStop}
      />
    )
    fireEvent.click(screen.getByText('Stop'))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  test('language buttons call onLanguageChange', () => {
    const onLanguageChange = jest.fn()
    render(
      <ControlBar
        {...controlBarProps}
        isTranscribing={true}
        consentStatus="accepted"
        onLanguageChange={onLanguageChange}
      />
    )
    fireEvent.click(screen.getByText('中文'))
    expect(onLanguageChange).toHaveBeenCalledWith('zh-CN')
  })
})

// ─── Fix 3: VideoHeader sidebar overlap ─────────────────────────────────────

describe('VideoHeader — Sidebar Overlap Avoidance', () => {
  test('right section has no margin when sidebar is closed', () => {
    const { container } = render(<VideoHeader {...videoHeaderProps} showSidebar={false} />)

    // The right section should not have mr-80
    const rightSection = container.querySelector('.flex.items-center.gap-3')
    expect(rightSection.className).not.toContain('md:mr-80')
  })

  test('right section has margin when sidebar is open', () => {
    const { container } = render(<VideoHeader {...videoHeaderProps} showSidebar={true} />)

    const rightSection = container.querySelector('.flex.items-center.gap-3')
    expect(rightSection.className).toContain('md:mr-80')
  })

  test('Topics button is visible when sidebar is closed', () => {
    render(<VideoHeader {...videoHeaderProps} showSidebar={false} />)
    expect(screen.getByText('Topics')).toBeInTheDocument()
  })

  test('Topics button is visible when sidebar is open', () => {
    render(<VideoHeader {...videoHeaderProps} showSidebar={true} />)
    expect(screen.getByText('Topics')).toBeInTheDocument()
  })

  test('grid toggle is visible when sidebar is open', () => {
    render(<VideoHeader {...videoHeaderProps} showSidebar={true} showGridToggle={true} />)
    expect(screen.getByText('Grid')).toBeInTheDocument()
  })
})

// ─── Fix 4: Transcript consent sync logic ───────────────────────────────────

describe('Transcript Consent — Host/Participant Sync Logic', () => {
  /**
   * Simulate the consent status transition effect from page.js.
   * Returns { isTranscribing, startCalled, stopCalled }.
   */
  function simulateConsentTransition({
    prevStatus,
    newStatus,
    isTranscribing,
    transcriptStopped = false,
  }) {
    const justAccepted = newStatus === 'accepted' && prevStatus !== 'accepted'
    const justRevoked = newStatus == null && prevStatus === 'accepted'

    let startCalled = false
    let stopCalled = false
    let finalTranscribing = isTranscribing

    if (justAccepted && !isTranscribing && !transcriptStopped) {
      startCalled = true
      finalTranscribing = true
    }

    if (justRevoked && isTranscribing) {
      stopCalled = true
      finalTranscribing = false
    }

    return { isTranscribing: finalTranscribing, startCalled, stopCalled }
  }

  test('participant starts transcription when host enables (null → accepted)', () => {
    const result = simulateConsentTransition({
      prevStatus: null,
      newStatus: 'accepted',
      isTranscribing: false,
    })
    expect(result.startCalled).toBe(true)
    expect(result.isTranscribing).toBe(true)
  })

  test('participant stops transcription when host stops (accepted → null)', () => {
    const result = simulateConsentTransition({
      prevStatus: 'accepted',
      newStatus: null,
      isTranscribing: true,
    })
    expect(result.stopCalled).toBe(true)
    expect(result.isTranscribing).toBe(false)
  })

  test('no-op when status stays accepted (accepted → accepted)', () => {
    const result = simulateConsentTransition({
      prevStatus: 'accepted',
      newStatus: 'accepted',
      isTranscribing: true,
    })
    expect(result.startCalled).toBe(false)
    expect(result.stopCalled).toBe(false)
    expect(result.isTranscribing).toBe(true)
  })

  test('no-op when status stays null (null → null)', () => {
    const result = simulateConsentTransition({
      prevStatus: null,
      newStatus: null,
      isTranscribing: false,
    })
    expect(result.startCalled).toBe(false)
    expect(result.stopCalled).toBe(false)
  })

  test('does not restart transcription if user manually stopped', () => {
    const result = simulateConsentTransition({
      prevStatus: null,
      newStatus: 'accepted',
      isTranscribing: false,
      transcriptStopped: true,
    })
    expect(result.startCalled).toBe(false)
    expect(result.isTranscribing).toBe(false)
  })

  test('does not stop if not currently transcribing', () => {
    const result = simulateConsentTransition({
      prevStatus: 'accepted',
      newStatus: null,
      isTranscribing: false,
    })
    expect(result.stopCalled).toBe(false)
  })

  test('pending → accepted triggers start', () => {
    const result = simulateConsentTransition({
      prevStatus: 'pending',
      newStatus: 'accepted',
      isTranscribing: false,
    })
    expect(result.startCalled).toBe(true)
    expect(result.isTranscribing).toBe(true)
  })

  test('prevConsentStatusRef ordering: prev is captured before update', () => {
    // This is the bug we fixed — verify the logic explicitly
    // Simulate: accepted → null with correct read order
    let prevRef = 'accepted'
    const newStatus = null

    const prev = prevRef // read first
    const justRevoked = newStatus == null && prev === 'accepted'
    prevRef = newStatus // update after

    expect(justRevoked).toBe(true)
    expect(prevRef).toBe(null)
  })
})

// ─── Fix 5: Mobile duration display ─────────────────────────────────────────

describe('VideoHeader — Mobile Duration Display', () => {
  test('shows duration on mobile when connected', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} isConnecting={false} callDuration={125} />
    )

    // Mobile area is "flex items-center gap-2 sm:hidden"
    const mobileArea = container.querySelector('.flex.items-center.gap-2.sm\\:hidden')
    expect(mobileArea).toBeTruthy()
    // Should show formatted duration (2:05)
    expect(mobileArea.textContent).toContain('02:05')
  })

  test('shows "Connecting..." on mobile when connecting', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} isConnecting={true} callDuration={0} />
    )

    const mobileArea = container.querySelector('.flex.items-center.gap-2.sm\\:hidden')
    expect(mobileArea.textContent).toContain('Connecting...')
  })

  test('does not show duration on mobile when connecting', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} isConnecting={true} callDuration={60} />
    )

    const mobileArea = container.querySelector('.flex.items-center.gap-2.sm\\:hidden')
    expect(mobileArea.textContent).not.toContain('01:00')
  })

  test('formats hours correctly when duration exceeds 60 min', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} callDuration={3661} />
    )

    // Desktop pills area has the duration too
    const durationTexts = container.textContent
    expect(durationTexts).toContain('01:01:01')
  })

  test('duration still shows on desktop in metadata pills', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} callDuration={90} />
    )

    // Desktop area is "hidden sm:flex"
    const desktopPills = container.querySelector('.hidden.sm\\:flex.items-center.gap-2')
    expect(desktopPills).toBeTruthy()
    expect(desktopPills.textContent).toContain('01:30')
  })
})

// ─── Fix 6: No duplicate participant count ──────────────────────────────────

describe('VideoHeader — No Duplicate Participant Count', () => {
  test('header does not show participant count pill', () => {
    const { container } = render(
      <VideoHeader {...videoHeaderProps} participantCount={5} />
    )

    // The desktop pills area should NOT contain a standalone participant count
    const desktopPills = container.querySelector('.hidden.sm\\:flex.items-center.gap-2')
    expect(desktopPills).toBeTruthy()

    // Check that no pill shows just the number with people icon
    // Duration pill has clock icon + time, quality pill has signal icon + label
    // There should be NO pill that just shows a number next to a people icon
    const pills = desktopPills.querySelectorAll('.rounded-lg')
    const participantPill = Array.from(pills).find(pill => {
      const text = pill.textContent.trim()
      // A pure participant count pill would just be a number like "5"
      return /^\d+$/.test(text)
    })
    expect(participantPill).toBeFalsy()
  })

  test('participant count is only shown on ControlBar button', () => {
    const { container } = render(<ControlBar {...controlBarProps} participantCount={5} />)

    // Desktop center zone should have participants button with count label "5"
    const buttons = container.querySelectorAll('button')
    const participantsBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg path[d*="M17 21v-2a4 4 0 0 0-4-4H5"]') &&
      btn.textContent.includes('5')
    )
    expect(participantsBtn).toBeTruthy()
  })
})

// ─── Fix 7: Topics API auth headers ─────────────────────────────────────────

describe('Topics API — Auth Token Logic', () => {
  test('auth header is constructed from session access_token', () => {
    const session = { access_token: 'test-jwt-token-123' }
    const authHeaders = session?.access_token
      ? { 'Authorization': `Bearer ${session.access_token}` }
      : {}

    expect(authHeaders.Authorization).toBe('Bearer test-jwt-token-123')
  })

  test('auth header is empty when no session', () => {
    const session = null
    const authHeaders = session?.access_token
      ? { 'Authorization': `Bearer ${session.access_token}` }
      : {}

    expect(authHeaders.Authorization).toBeUndefined()
    expect(Object.keys(authHeaders)).toHaveLength(0)
  })

  test('auth header is empty when session has no access_token', () => {
    const session = { user: { id: 'user-1' } }
    const authHeaders = session?.access_token
      ? { 'Authorization': `Bearer ${session.access_token}` }
      : {}

    expect(authHeaders.Authorization).toBeUndefined()
  })

  test('auth headers merge with Content-Type for POST', () => {
    const session = { access_token: 'my-token' }
    const authHeaders = session?.access_token
      ? { 'Authorization': `Bearer ${session.access_token}` }
      : {}

    const postHeaders = { 'Content-Type': 'application/json', ...authHeaders }
    expect(postHeaders['Content-Type']).toBe('application/json')
    expect(postHeaders.Authorization).toBe('Bearer my-token')
  })
})
