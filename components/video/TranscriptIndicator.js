'use client';

import { colors, fonts } from '@/lib/designTokens';

const STATES = {
  pending: {
    dotColor: '#C9A96E',
    text: 'Transcription pending approval',
    animate: false,
  },
  accepted: {
    dotColor: '#E74C3C',
    text: 'Transcript & recap enabled',
    animate: true,
  },
  host: {
    dotColor: '#E74C3C',
    text: 'Transcript & recap enabled by host',
    animate: true,
  },
};

export default function TranscriptIndicator({ status, mode, onStop, isHost }) {
  if (!status || status === 'declined' || status === 'exhausted') return null;

  const displayMode = mode === 'host' && status === 'accepted' ? 'host' : status;
  const state = STATES[displayMode];
  if (!state) return null;

  const showStop = (mode === 'mutual' && status === 'accepted') ||
                   (mode === 'host' && isHost && status === 'accepted');

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      padding: '6px 12px',
      fontFamily: fonts.sans,
      fontSize: 12,
      color: '#E8DDD3',
    }}>
      <style>{`
        @keyframes consentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: state.dotColor,
        display: 'inline-block',
        flexShrink: 0,
        animation: state.animate ? 'consentPulse 2s infinite' : 'none',
      }} />

      <span style={{ fontWeight: 500 }}>
        {state.text}
      </span>

      {showStop && onStop && (
        <button
          onClick={onStop}
          style={{
            marginLeft: 4,
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#A89080',
            fontFamily: fonts.sans,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Stop
        </button>
      )}
    </div>
  );
}
