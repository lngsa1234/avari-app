/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TranscriptIndicator from '@/components/video/TranscriptIndicator';

describe('TranscriptIndicator', () => {
  test('renders nothing when status is null', () => {
    const { container } = render(
      <TranscriptIndicator status={null} mode="mutual" />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when status is declined', () => {
    const { container } = render(
      <TranscriptIndicator status="declined" mode="mutual" />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when status is exhausted', () => {
    const { container } = render(
      <TranscriptIndicator status="exhausted" mode="mutual" />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders pending state with amber text', () => {
    render(<TranscriptIndicator status="pending" mode="mutual" />);
    expect(screen.getByText('Transcription pending approval')).toBeTruthy();
  });

  test('renders active state with transcript enabled text', () => {
    render(
      <TranscriptIndicator status="accepted" mode="mutual" onStop={jest.fn()} />
    );
    expect(screen.getByText('Transcript & recap enabled')).toBeTruthy();
  });

  test('renders Stop button in mutual mode when accepted', () => {
    const onStop = jest.fn();
    render(
      <TranscriptIndicator status="accepted" mode="mutual" onStop={onStop} />
    );
    const stopBtn = screen.getByText('Stop');
    expect(stopBtn).toBeTruthy();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('renders host banner text in host mode', () => {
    render(
      <TranscriptIndicator status="accepted" mode="host" isHost={true} onStop={jest.fn()} />
    );
    expect(screen.getByText('Transcript & recap enabled by host')).toBeTruthy();
  });

  test('shows Stop button for host in host mode', () => {
    render(
      <TranscriptIndicator status="accepted" mode="host" isHost={true} onStop={jest.fn()} />
    );
    expect(screen.getByText('Stop')).toBeTruthy();
  });

  test('hides Stop button for non-host in host mode', () => {
    render(
      <TranscriptIndicator status="accepted" mode="host" isHost={false} onStop={jest.fn()} />
    );
    expect(screen.queryByText('Stop')).toBeNull();
  });
});
