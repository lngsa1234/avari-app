'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * ReportIssueSheet — floating "Report" trigger + popup panel for live
 * call issue reporting. Self-contained: renders both the floating
 * trigger button (bottom-right of the call page, above the control bar)
 * and the popup panel that opens above it.
 *
 * Two-step flow: user taps the trigger to open, picks an issue from a
 * 2-column grid of preset tiles, then taps "Send report" to submit.
 * On success, briefly shows a thank-you confirmation before closing.
 * On error, shows "Try again" without losing the selection.
 *
 * Position is fixed bottom-right with `bottom: 100px` to clear the
 * call page's ControlBar (which is roughly 70-90px tall at the bottom
 * of the screen). Reference design from app/UX reference/WebRTCReportButton.jsx
 * called for `bottom: 24px` but that assumed a fullscreen video with
 * no bottom controls.
 *
 * @param {(issueType: string) => Promise<void>} onSubmit
 *   Async callback the parent provides. Should resolve on success and
 *   throw on failure. The component handles all status UI internally.
 */

const ISSUES = [
  { id: 'no_audio',      icon: '🔇', label: 'No audio' },
  { id: 'no_video',      icon: '📹', label: 'No video' },
  { id: 'disconnecting', icon: '🔄', label: 'Keeps disconnecting' },
  { id: 'laggy',         icon: '🐌', label: 'Very laggy' },
  { id: 'cant_see',      icon: '👻', label: 'Can\'t see other person' },
  { id: 'echo',          icon: '🔊', label: 'Echo / feedback' },
  { id: 'other',         icon: '💬', label: 'Other' },
];

export default function ReportIssueSheet({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  const closeTimeoutRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
    setStatus('idle');
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleToggle = () => {
    if (open) {
      handleClose();
    } else {
      setOpen(true);
      setSelected(null);
      setStatus('idle');
    }
  };

  const handleSubmit = async () => {
    if (!selected || status === 'sending') return;
    setStatus('sending');
    try {
      await onSubmit(selected);
      setStatus('sent');
      // Auto-close after 1.8s on success
      closeTimeoutRef.current = setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      console.error('[ReportIssueSheet] Submit failed:', err);
      setStatus('error');
    }
  };

  return (
    <>
      <style>{`
        @keyframes cwReportSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes cwReportFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        .cwReportTrigger {
          position: fixed;
          bottom: 108px;
          right: 16px;
          z-index: 60;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 11px 6px 9px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 100px;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.04em;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
          opacity: 0.85;
        }
        .cwReportTrigger:hover { opacity: 1; }
        .cwReportPanel {
          position: fixed;
          bottom: 150px;
          right: 16px;
          z-index: 61;
          width: 260px;
          max-width: calc(100vw - 32px);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(193,154,107,0.05);
          overflow: hidden;
          animation: cwReportSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        @media (max-width: 480px) {
          .cwReportTrigger {
            bottom: 96px;
            right: 10px;
            padding: 6px 9px;
            gap: 0;
          }
          .cwReportTrigger .cwReportLabel { display: none; }
          .cwReportPanel {
            bottom: 138px;
            right: 10px;
            left: 10px;
            width: auto;
            max-width: none;
          }
        }
        @media (min-width: 481px) and (max-width: 768px) {
          .cwReportTrigger { bottom: 100px; }
          .cwReportPanel { bottom: 142px; }
        }
      `}</style>

      {/* Floating trigger button — bottom-right, above the ControlBar */}
      <button
        type="button"
        onClick={handleToggle}
        title="Report a call issue"
        aria-label="Report call issue"
        aria-expanded={open}
        className="cwReportTrigger"
        style={{
          background: open ? 'rgba(44, 30, 20, 0.95)' : 'rgba(44, 30, 20, 0.78)',
          border: `1px solid ${open ? 'rgba(193, 154, 107, 0.55)' : 'rgba(193, 154, 107, 0.22)'}`,
          color: open ? '#c19a6b' : 'rgba(237, 220, 195, 0.72)',
        }}
      >
        <span style={{ fontSize: '12px', lineHeight: 1 }}>⚑</span>
        <span className="cwReportLabel" style={{ fontSize: '11px' }}>Report</span>
      </button>

      {/* Panel — pops above the trigger when open */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cw-report-title"
          className="cwReportPanel"
          style={{
            background: 'rgba(28, 18, 12, 0.96)',
            border: '1px solid rgba(193, 154, 107, 0.2)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid rgba(193, 154, 107, 0.1)',
            }}
          >
            <span
              id="cw-report-title"
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#e8d5b7',
                letterSpacing: '0.02em',
              }}
            >
              What went wrong?
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(193, 154, 107, 0.5)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {status === 'sent' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '28px 16px 24px',
                animation: 'cwReportFadeIn 0.3s ease',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(193, 154, 107, 0.15)',
                  border: '1px solid rgba(193, 154, 107, 0.3)',
                  borderRadius: '50%',
                  fontSize: '16px',
                  color: '#c19a6b',
                }}
              >
                ✓
              </span>
              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(237, 220, 195, 0.65)',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                Thank you — we&apos;ll look into it.
              </p>
            </div>
          ) : (
            <>
              {/* Issues grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  padding: '12px',
                }}
              >
                {ISSUES.map((issue) => {
                  const isSelected = selected === issue.id;
                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => setSelected(issue.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '10px 8px',
                        background: isSelected
                          ? 'rgba(193, 154, 107, 0.15)'
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? 'rgba(193, 154, 107, 0.5)' : 'rgba(193, 154, 107, 0.1)'}`,
                        borderRadius: '10px',
                        color: isSelected ? '#c19a6b' : 'rgba(237, 220, 195, 0.65)',
                        fontSize: '11px',
                        fontWeight: 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        lineHeight: 1.3,
                        boxShadow: isSelected
                          ? 'inset 0 0 12px rgba(193, 154, 107, 0.05)'
                          : 'none',
                      }}
                    >
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{issue.icon}</span>
                      <span style={{ fontSize: '10.5px', letterSpacing: '0.02em' }}>
                        {issue.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Submit button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selected || status === 'sending'}
                style={{
                  display: 'block',
                  width: 'calc(100% - 24px)',
                  margin: '0 12px 10px',
                  padding: '10px',
                  background: !selected
                    ? 'rgba(193, 154, 107, 0.15)'
                    : 'linear-gradient(135deg, #c19a6b, #a0784a)',
                  border: 'none',
                  borderRadius: '10px',
                  color: !selected ? 'rgba(193, 154, 107, 0.3)' : '#1c120c',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  cursor: !selected
                    ? 'not-allowed'
                    : status === 'sending'
                      ? 'wait'
                      : 'pointer',
                  opacity: status === 'sending' ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {status === 'sending'
                  ? 'Sending\u2026'
                  : status === 'error'
                    ? 'Try again'
                    : 'Send report'}
              </button>

              <p
                style={{
                  fontSize: '10px',
                  color: 'rgba(193, 154, 107, 0.35)',
                  textAlign: 'center',
                  padding: '0 12px 14px',
                  margin: 0,
                  letterSpacing: '0.02em',
                }}
              >
                Your call continues — this sends in the background.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
