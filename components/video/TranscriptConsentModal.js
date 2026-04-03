'use client';

import { colors, fonts } from '@/lib/designTokens';

export default function TranscriptConsentModal({ requesterName, onAccept, onDecline, isVisible }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: colors.bg,
        borderRadius: 16,
        padding: 24,
        maxWidth: 340,
        width: '90%',
        boxShadow: `0 8px 32px ${colors.shadow}`,
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ textAlign: 'center', fontSize: 32, marginBottom: 8 }}>
          📝
        </div>

        <h3 style={{
          fontFamily: fonts.serif,
          fontSize: 18,
          fontWeight: 600,
          color: colors.text,
          textAlign: 'center',
          margin: '0 0 8px',
        }}>
          Enable Transcript & Recap?
        </h3>

        <p style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 1.5,
          margin: '0 0 20px',
        }}>
          {requesterName} would like to enable live transcription and AI recap for this coffee chat. Both participants will see the transcript.
        </p>

        <button
          onClick={onAccept}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: colors.buttonBg,
            color: colors.buttonText,
            fontFamily: fonts.sans,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          Allow Transcription
        </button>

        <button
          onClick={onDecline}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: `1px solid ${colors.borderMedium}`,
            background: 'transparent',
            color: colors.textMuted,
            fontFamily: fonts.sans,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          No Thanks
        </button>
      </div>
    </div>
  );
}
