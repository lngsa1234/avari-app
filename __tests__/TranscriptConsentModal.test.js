/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TranscriptConsentModal from '@/components/video/TranscriptConsentModal';

describe('TranscriptConsentModal', () => {
  const defaultProps = {
    requesterName: 'Alex',
    onAccept: jest.fn(),
    onDecline: jest.fn(),
    isVisible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when not visible', () => {
    const { container } = render(
      <TranscriptConsentModal {...defaultProps} isVisible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders modal with requester name', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    expect(screen.getByText(/Alex would like to enable live transcription/)).toBeTruthy();
  });

  test('renders accept button', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    expect(screen.getByText('Allow Transcription')).toBeTruthy();
  });

  test('renders decline button', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    expect(screen.getByText('No Thanks')).toBeTruthy();
  });

  test('accept button fires onAccept callback', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Allow Transcription'));
    expect(defaultProps.onAccept).toHaveBeenCalledTimes(1);
  });

  test('decline button fires onDecline callback', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByText('No Thanks'));
    expect(defaultProps.onDecline).toHaveBeenCalledTimes(1);
  });

  test('both buttons have equal visual prominence', () => {
    render(<TranscriptConsentModal {...defaultProps} />);
    const acceptBtn = screen.getByText('Allow Transcription');
    const declineBtn = screen.getByText('No Thanks');
    // Both buttons should be full-width blocks
    expect(acceptBtn.style.width).toBe('100%');
    expect(declineBtn.style.width).toBe('100%');
  });
});
