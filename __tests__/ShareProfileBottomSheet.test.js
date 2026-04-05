import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock qrcode.react
jest.mock('qrcode.react', () => ({
  QRCodeSVG: (props) => <svg data-testid="qr-code" {...props} />,
}))

import ShareProfileModal from '@/components/ShareProfileModal'

const baseProps = {
  userId: 'user-123',
  username: 'lynn.wang',
  name: 'Lynn Wang',
  onClose: jest.fn(),
}

describe('ShareProfileModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders dialog with share profile label', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Share profile')
  })

  test('shows display handle with username', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByText('@lynn.wang on CircleW')).toBeInTheDocument()
  })

  test('shows QR code', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  })

  test('shows Share, Copy Link, and Download buttons', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByText('Share')).toBeInTheDocument()
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
    expect(screen.getByText('Download')).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    render(<ShareProfileModal {...baseProps} />)
    // Click the X button (the close button in the header)
    const closeButtons = screen.getAllByRole('button')
    // The second button should be the X close button (after Share Profile header)
    fireEvent.click(closeButtons.find(b => b.querySelector('.lucide-x')))
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking backdrop calls onClose', () => {
    render(<ShareProfileModal {...baseProps} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test('Escape key calls onClose', () => {
    render(<ShareProfileModal {...baseProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  test('applies bottom sheet styles on mobile viewport', () => {
    // Simulate mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
    window.dispatchEvent(new Event('resize'))

    render(<ShareProfileModal {...baseProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.alignItems).toBe('flex-end')
  })

  test('applies centered styles on desktop viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    window.dispatchEvent(new Event('resize'))

    render(<ShareProfileModal {...baseProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.alignItems).toBe('center')
  })

  test('falls back to name when no username', () => {
    render(<ShareProfileModal {...baseProps} username={null} />)
    expect(screen.getByText('Lynn Wang on CircleW')).toBeInTheDocument()
  })
})
