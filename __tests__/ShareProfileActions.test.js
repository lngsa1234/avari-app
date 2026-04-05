import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

jest.mock('qrcode.react', () => ({
  QRCodeSVG: (props) => <svg data-testid="qr-code" id={props.id} />,
}))

import ShareProfileModal from '@/components/ShareProfileModal'

const baseProps = {
  userId: 'user-123',
  username: 'lynn.wang',
  name: 'Lynn Wang',
  onClose: jest.fn(),
}

describe('ShareProfileModal — Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset clipboard mock
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
  })

  test('Copy Link calls navigator.clipboard.writeText with profile URL', async () => {
    render(<ShareProfileModal {...baseProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Copy Link'))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/people/lynn.wang')
    )
  })

  test('Copy Link button shows "Copied!" after click', async () => {
    render(<ShareProfileModal {...baseProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Copy Link'))
    })
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  test('Copy Link reverts to original text after 2 seconds', async () => {
    jest.useFakeTimers()
    render(<ShareProfileModal {...baseProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Copy Link'))
    })
    expect(screen.getByText('Copied!')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(2100) })
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
    jest.useRealTimers()
  })

  test('Share button calls navigator.share when available', async () => {
    const shareMock = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share: shareMock })
    render(<ShareProfileModal {...baseProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Share'))
    })
    expect(shareMock).toHaveBeenCalledWith({
      title: '@lynn.wang on CircleW',
      url: expect.stringContaining('/people/lynn.wang'),
    })
    delete navigator.share
  })

  test('Share button does not throw when navigator.share is unavailable', () => {
    delete navigator.share
    render(<ShareProfileModal {...baseProps} />)
    expect(() => {
      fireEvent.click(screen.getByText('Share'))
    }).not.toThrow()
  })

  test('profile URL uses username when available', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByText('@lynn.wang on CircleW')).toBeInTheDocument()
  })

  test('profile URL falls back to userId when no username', () => {
    render(<ShareProfileModal {...baseProps} username={null} />)
    expect(screen.getByText('Lynn Wang on CircleW')).toBeInTheDocument()
  })

  test('profile URL falls back to "Profile" when no username or name', () => {
    render(<ShareProfileModal {...baseProps} username={null} name={null} />)
    expect(screen.getByText('Profile on CircleW')).toBeInTheDocument()
  })

  test('Download button exists', () => {
    render(<ShareProfileModal {...baseProps} />)
    expect(screen.getByText('Download')).toBeInTheDocument()
  })

  test('Download click does not crash when QR element missing', () => {
    // In jsdom, getElementById for the QR SVG may not work as expected.
    // The handler guards with `if (!svg) return;` so it should not throw.
    render(<ShareProfileModal {...baseProps} />)
    // Remove the QR element to test the guard
    const qr = document.getElementById('profile-qr-code')
    if (qr) qr.remove()
    expect(() => fireEvent.click(screen.getByText('Download'))).not.toThrow()
  })
})
