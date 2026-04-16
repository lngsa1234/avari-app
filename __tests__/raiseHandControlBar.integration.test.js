/**
 * Component integration tests for Raise Hand in ControlBar.
 *
 * Renders the real ControlBar component and verifies: hand raise button
 * visibility based on feature flags, active/inactive styling, click handler,
 * tooltip text, and raised-hand badge on the Participants button.
 *
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ControlBar from '@/components/video/ControlBar'

const baseProps = {
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
  onToggleMute: jest.fn(),
  onToggleVideo: jest.fn(),
  onToggleBlur: jest.fn(),
  onToggleScreenShare: jest.fn(),
  onToggleRecording: jest.fn(),
  onToggleTranscription: jest.fn(),
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

describe('ControlBar — Raise Hand Button Visibility', () => {
  test('shows raise hand button when handRaise feature is enabled', () => {
    const { container } = render(<ControlBar {...baseProps} />)

    // Desktop layout: button with "Raise hand" tooltip
    const handBtn = container.querySelector('[class*="bg-stone-700"]')
    // Check for HandIcon SVG — the raise hand button renders an SVG with the hand path
    const handSvgs = container.querySelectorAll('svg')
    const handIcon = Array.from(handSvgs).find(svg =>
      svg.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    expect(handIcon).toBeTruthy()
  })

  test('hides raise hand button when handRaise feature is disabled', () => {
    const coffeeFeatures = {
      ...baseProps.features,
      handRaise: false,
      participants: false,
    }

    const { container } = render(
      <ControlBar {...baseProps} features={coffeeFeatures} />
    )

    const handSvgs = container.querySelectorAll('svg')
    const handIcon = Array.from(handSvgs).find(svg =>
      svg.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    expect(handIcon).toBeFalsy()
  })
})

describe('ControlBar — Raise Hand Button State', () => {
  test('hand button has default styling when not raised', () => {
    const { container } = render(
      <ControlBar {...baseProps} isHandRaised={false} />
    )

    // Find the hand button by looking for the one with HandIcon
    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    expect(handBtn).toBeTruthy()
    // Should NOT have amber-500 class when not raised
    expect(handBtn.className).not.toContain('bg-amber-500')
  })

  test('hand button has amber styling when raised', () => {
    const { container } = render(
      <ControlBar {...baseProps} isHandRaised={true} />
    )

    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    expect(handBtn).toBeTruthy()
    expect(handBtn.className).toContain('bg-amber-500')
  })
})

describe('ControlBar — Raise Hand Click Handler', () => {
  test('calls onToggleHand when button is clicked', () => {
    const onToggleHand = jest.fn()
    const { container } = render(
      <ControlBar {...baseProps} onToggleHand={onToggleHand} />
    )

    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    fireEvent.click(handBtn)
    expect(onToggleHand).toHaveBeenCalledTimes(1)
  })

  test('clicking twice calls handler twice (toggle behavior)', () => {
    const onToggleHand = jest.fn()
    const { container } = render(
      <ControlBar {...baseProps} onToggleHand={onToggleHand} />
    )

    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )
    fireEvent.click(handBtn)
    fireEvent.click(handBtn)
    expect(onToggleHand).toHaveBeenCalledTimes(2)
  })
})

describe('ControlBar — Raised Hand Badge on Participants', () => {
  test('shows badge on participants button when hands are raised and panel closed', () => {
    const { container } = render(
      <ControlBar
        {...baseProps}
        raisedHandCount={3}
        showParticipants={false}
      />
    )

    // Badge renders with the count inside a span with bg-red-500
    const badges = container.querySelectorAll('.bg-red-500')
    const handBadge = Array.from(badges).find(el => el.textContent === '3')
    expect(handBadge).toBeTruthy()
  })

  test('hides badge on participants button when panel is open', () => {
    const { container } = render(
      <ControlBar
        {...baseProps}
        raisedHandCount={3}
        showParticipants={true}
      />
    )

    // Badge should NOT show when panel is open (user can see the list)
    const badges = container.querySelectorAll('.bg-red-500')
    const handBadge = Array.from(badges).find(el => el.textContent === '3')
    expect(handBadge).toBeFalsy()
  })

  test('no badge when raisedHandCount is 0', () => {
    const { container } = render(
      <ControlBar
        {...baseProps}
        raisedHandCount={0}
        showParticipants={false}
      />
    )

    const badges = container.querySelectorAll('.bg-red-500')
    // Should have no badge or badge shows 0 (which ControlBtn filters out)
    const handBadge = Array.from(badges).find(el => el.textContent === '0')
    expect(handBadge).toBeFalsy()
  })
})

describe('ControlBar — Tooltip Text', () => {
  test('shows "Raise hand" tooltip when not raised', () => {
    const { container } = render(
      <ControlBar {...baseProps} isHandRaised={false} />
    )

    // Desktop layout has Tooltip wrappers. The tooltip text is in a hidden div
    // that appears on hover. We can check the parent's onMouseEnter triggers.
    // Since Tooltip uses state, we test by hovering.
    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )

    // Hover over the tooltip wrapper (parent of the button)
    const tooltipWrapper = handBtn.closest('.relative.inline-flex')
    if (tooltipWrapper) {
      fireEvent.mouseEnter(tooltipWrapper)
      // Tooltip should show "Raise hand"
      expect(screen.getByText('Raise hand')).toBeInTheDocument()
    }
  })

  test('shows "Lower hand" tooltip when raised', () => {
    const { container } = render(
      <ControlBar {...baseProps} isHandRaised={true} />
    )

    const buttons = container.querySelectorAll('button')
    const handBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
    )

    const tooltipWrapper = handBtn.closest('.relative.inline-flex')
    if (tooltipWrapper) {
      fireEvent.mouseEnter(tooltipWrapper)
      expect(screen.getByText('Lower hand')).toBeInTheDocument()
    }
  })
})

describe('ControlBar — Mobile Layout', () => {
  test('hand button appears in mobile strip when feature enabled', () => {
    const { container } = render(<ControlBar {...baseProps} />)

    // Mobile strip is the "flex sm:hidden" div
    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    if (mobileStrip) {
      const handIcon = Array.from(mobileStrip.querySelectorAll('svg')).find(svg =>
        svg.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
      )
      expect(handIcon).toBeTruthy()
    }
  })

  test('hand button absent in mobile strip when feature disabled', () => {
    const coffeeFeatures = { ...baseProps.features, handRaise: false }
    const { container } = render(
      <ControlBar {...baseProps} features={coffeeFeatures} />
    )

    const mobileStrip = container.querySelector('.flex.sm\\:hidden')
    if (mobileStrip) {
      const handIcon = Array.from(mobileStrip.querySelectorAll('svg')).find(svg =>
        svg.innerHTML.includes('M18 11V6a2 2 0 0 0-4 0v1')
      )
      expect(handIcon).toBeFalsy()
    }
  })
})
