/**
 * Component integration tests for Raise Hand in ParticipantsPanel.
 *
 * Renders the real ParticipantsPanel component with raise hand state and
 * verifies: hand badge rendering, host-only controls, sort order, and
 * Lower All button visibility.
 *
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ParticipantsPanel from '@/components/video/ParticipantsPanel'

const baseProps = {
  currentUser: { id: 'user-host', name: 'Host User', email: 'host@test.com' },
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  participantCount: 3,
  isHost: false,
  transcriptionLanguage: 'en-US',
}

const remoteParticipants = [
  { id: 'user-a', name: 'Alice', hasAudio: true, hasVideo: true, hasScreen: false, connectionQuality: 'good' },
  { id: 'user-b', name: 'Bob', hasAudio: false, hasVideo: true, hasScreen: false, connectionQuality: 'good' },
  { id: 'user-c', name: 'Carol', hasAudio: true, hasVideo: false, hasScreen: false, connectionQuality: 'good' },
]

describe('ParticipantsPanel — Raise Hand Rendering', () => {
  test('shows hand emoji next to participant with raised hand', () => {
    const raisedHands = [
      { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 },
    ]

    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
      />
    )

    // The hand emoji should appear in the DOM
    const handEmojis = container.querySelectorAll('span')
    const handSpans = Array.from(handEmojis).filter(el => el.textContent === '✋')
    expect(handSpans.length).toBeGreaterThanOrEqual(1)
  })

  test('does not show hand emoji when no hands are raised', () => {
    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
        raisedHands={[]}
      />
    )

    const handSpans = Array.from(container.querySelectorAll('span'))
      .filter(el => el.textContent === '✋')
    expect(handSpans).toHaveLength(0)
  })

  test('shows hand emoji for current user when they have raised hand', () => {
    const raisedHands = [
      { userId: 'user-host', name: 'Host User', avatarUrl: null, raisedAt: 1000 },
    ]

    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
      />
    )

    const handSpans = Array.from(container.querySelectorAll('span'))
      .filter(el => el.textContent === '✋')
    expect(handSpans.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ParticipantsPanel — Host Controls', () => {
  const raisedHands = [
    { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 },
    { userId: 'user-b', name: 'Bob', avatarUrl: null, raisedAt: 2000 },
  ]

  test('shows "Lower All Hands" button for host when hands are raised', () => {
    render(
      <ParticipantsPanel
        {...baseProps}
        isHost={true}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
        onLowerAllHands={jest.fn()}
      />
    )

    const lowerAllBtn = screen.getByText(/Lower All Hands/i)
    expect(lowerAllBtn).toBeInTheDocument()
    expect(lowerAllBtn.textContent).toContain('2')
  })

  test('hides "Lower All Hands" button when no hands are raised', () => {
    render(
      <ParticipantsPanel
        {...baseProps}
        isHost={true}
        remoteParticipants={remoteParticipants}
        raisedHands={[]}
        onLowerAllHands={jest.fn()}
      />
    )

    expect(screen.queryByText(/Lower All Hands/i)).not.toBeInTheDocument()
  })

  test('hides "Lower All Hands" for non-host users', () => {
    render(
      <ParticipantsPanel
        {...baseProps}
        isHost={false}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
        onLowerAllHands={jest.fn()}
      />
    )

    expect(screen.queryByText(/Lower All Hands/i)).not.toBeInTheDocument()
  })

  test('calls onLowerAllHands when button is clicked', () => {
    const onLowerAllHands = jest.fn()
    render(
      <ParticipantsPanel
        {...baseProps}
        isHost={true}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
        onLowerAllHands={onLowerAllHands}
      />
    )

    fireEvent.click(screen.getByText(/Lower All Hands/i))
    expect(onLowerAllHands).toHaveBeenCalledTimes(1)
  })

  test('shows lower hand button per raised participant for host', () => {
    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        isHost={true}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
        onLowerHand={jest.fn()}
      />
    )

    // Host should see individual "Lower hand" buttons (title attr)
    const lowerBtns = container.querySelectorAll('[title="Lower hand"]')
    expect(lowerBtns).toHaveLength(2) // user-a and user-b
  })

  test('does not show lower hand buttons for non-host', () => {
    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        isHost={false}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
        onLowerHand={jest.fn()}
      />
    )

    const lowerBtns = container.querySelectorAll('[title="Lower hand"]')
    expect(lowerBtns).toHaveLength(0)
  })

  test('calls onLowerHand with correct userId when individual lower clicked', () => {
    const onLowerHand = jest.fn()
    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        isHost={true}
        remoteParticipants={remoteParticipants}
        raisedHands={[{ userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 1000 }]}
        onLowerHand={onLowerHand}
      />
    )

    const lowerBtn = container.querySelector('[title="Lower hand"]')
    fireEvent.click(lowerBtn)
    expect(onLowerHand).toHaveBeenCalledWith('user-a')
  })
})

describe('ParticipantsPanel — Sort Order', () => {
  test('raised-hand participants appear before non-raised', () => {
    // Carol (user-c) has hand raised, should appear before Alice and Bob
    const raisedHands = [
      { userId: 'user-c', name: 'Carol', avatarUrl: null, raisedAt: 1000 },
    ]

    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
      />
    )

    // Get all participant name elements (skip the "You" label and other text)
    const nameElements = container.querySelectorAll('.text-sm.font-semibold.truncate')
    const names = Array.from(nameElements).map(el => el.textContent)

    // First name is Host User (current user always first), then Carol (raised), then others
    expect(names[0]).toBe('Host User')
    expect(names[1]).toBe('Carol')
  })

  test('multiple raised hands preserve queue order', () => {
    // Bob raised first, then Alice
    const raisedHands = [
      { userId: 'user-b', name: 'Bob', avatarUrl: null, raisedAt: 1000 },
      { userId: 'user-a', name: 'Alice', avatarUrl: null, raisedAt: 2000 },
    ]

    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
        raisedHands={raisedHands}
      />
    )

    const nameElements = container.querySelectorAll('.text-sm.font-semibold.truncate')
    const names = Array.from(nameElements).map(el => el.textContent)

    // Host first, then Bob (raised first), Alice (raised second), Carol (not raised)
    expect(names[0]).toBe('Host User')
    expect(names[1]).toBe('Bob')
    expect(names[2]).toBe('Alice')
    expect(names[3]).toBe('Carol')
  })
})

describe('ParticipantsPanel — Empty/Edge States', () => {
  test('renders without raisedHands prop (defaults to empty)', () => {
    const { container } = render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={remoteParticipants}
      />
    )

    // Should render without errors
    expect(container).toBeTruthy()
    const handSpans = Array.from(container.querySelectorAll('span'))
      .filter(el => el.textContent === '✋')
    expect(handSpans).toHaveLength(0)
  })

  test('renders with no remote participants and raised hands', () => {
    render(
      <ParticipantsPanel
        {...baseProps}
        remoteParticipants={[]}
        raisedHands={[{ userId: 'user-host', name: 'Host', avatarUrl: null, raisedAt: 1000 }]}
      />
    )

    expect(screen.getByText(/Waiting for others to join/i)).toBeInTheDocument()
  })
})
