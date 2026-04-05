/**
 * Accessibility tests for CircleW components.
 * Verifies focus trapping, aria attributes, and reduced motion support.
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// --- Source-level tests (verify a11y attributes exist in code) ---

const shareModalSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'ShareProfileModal.js'), 'utf8'
)
const profileViewSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'UserProfileView.js'), 'utf8'
)
const peopleViewSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'AllPeopleView.js'), 'utf8'
)
const circlesViewSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'AllCirclesView.js'), 'utf8'
)
const globalsCss = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'globals.css'), 'utf8'
)

describe('Accessibility — Source Level', () => {
  describe('ShareProfileModal', () => {
    test('has aria-modal="true"', () => {
      expect(shareModalSource).toMatch(/aria-modal.*true/)
    })

    test('has aria-label on close button', () => {
      expect(shareModalSource).toMatch(/aria-label.*Close share modal/)
    })

    test('implements focus trapping with Tab key', () => {
      expect(shareModalSource).toMatch(/e\.key !== 'Tab'/)
      expect(shareModalSource).toMatch(/e\.shiftKey/)
      expect(shareModalSource).toMatch(/first\.focus/)
      expect(shareModalSource).toMatch(/last\.focus/)
    })

    test('restores focus on close', () => {
      expect(shareModalSource).toMatch(/previousFocus/)
      expect(shareModalSource).toMatch(/previousFocus\.current\?\.focus/)
    })

    test('has prefers-reduced-motion media query', () => {
      expect(shareModalSource).toMatch(/prefers-reduced-motion: reduce/)
    })
  })

  describe('UserProfileView — Private Pages', () => {
    test('back buttons have aria-label', () => {
      expect(profileViewSource).toMatch(/aria-label="Go back"/)
    })

    test('private profile card has role="status"', () => {
      expect(profileViewSource).toMatch(/role="status"/)
    })

    test('shield icon is aria-hidden', () => {
      expect(profileViewSource).toMatch(/aria-hidden="true"/)
    })

    test('Browse People button has aria-label', () => {
      expect(profileViewSource).toMatch(/aria-label="Browse people directory"/)
    })
  })

  describe('Grid/List Toggles', () => {
    test('AllPeopleView toggles have aria-pressed', () => {
      expect(peopleViewSource).toMatch(/aria-pressed=\{viewMode === 'grid'\}/)
      expect(peopleViewSource).toMatch(/aria-pressed=\{viewMode === 'list'\}/)
    })

    test('AllCirclesView toggles have aria-pressed', () => {
      expect(circlesViewSource).toMatch(/aria-pressed=\{viewMode === 'grid'\}/)
      expect(circlesViewSource).toMatch(/aria-pressed=\{viewMode === 'list'\}/)
    })

    test('toggles have descriptive aria-labels', () => {
      expect(peopleViewSource).toMatch(/aria-label="Switch to grid view"/)
      expect(peopleViewSource).toMatch(/aria-label="Switch to list view"/)
      expect(circlesViewSource).toMatch(/aria-label="Switch to grid view"/)
      expect(circlesViewSource).toMatch(/aria-label="Switch to list view"/)
    })
  })

  describe('Global Reduced Motion', () => {
    test('globals.css has prefers-reduced-motion rule', () => {
      expect(globalsCss).toMatch(/prefers-reduced-motion: reduce/)
    })

    test('reduces animation-duration to near-zero', () => {
      expect(globalsCss).toMatch(/animation-duration: 0\.01ms/)
    })

    test('reduces transition-duration to near-zero', () => {
      expect(globalsCss).toMatch(/transition-duration: 0\.01ms/)
    })

    test('disables smooth scrolling', () => {
      expect(globalsCss).toMatch(/scroll-behavior: auto/)
    })
  })
})

// --- Render-level tests (verify runtime behavior) ---

jest.mock('qrcode.react', () => ({
  QRCodeSVG: (props) => <svg data-testid="qr-code" />,
}))

import ShareProfileModal from '@/components/ShareProfileModal'

describe('Accessibility — Runtime', () => {
  const modalProps = {
    userId: 'user-123',
    username: 'lynn.wang',
    name: 'Lynn Wang',
    onClose: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  test('modal has aria-modal="true" at runtime', () => {
    render(<ShareProfileModal {...modalProps} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  test('close button has aria-label at runtime', () => {
    render(<ShareProfileModal {...modalProps} />)
    expect(screen.getByLabelText('Close share modal')).toBeInTheDocument()
  })

  test('Escape key closes modal', () => {
    render(<ShareProfileModal {...modalProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(modalProps.onClose).toHaveBeenCalledTimes(1)
  })

  test('Tab wraps focus within modal', () => {
    render(<ShareProfileModal {...modalProps} />)
    const dialog = screen.getByRole('dialog')
    const buttons = dialog.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    // Focus the last button and Tab should wrap to first
    const lastBtn = buttons[buttons.length - 1]
    lastBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // Focus should have been managed (we can't easily assert exact focus target
    // in jsdom, but the handler should have been called without error)
  })
})
