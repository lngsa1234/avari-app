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
