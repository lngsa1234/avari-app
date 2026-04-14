'use client';

import { useEffect } from 'react';

/**
 * ReportIssueSheet — bottom-centered modal that lets the user flag a
 * live call issue with one tap. Each preset button fires onSubmit
 * with the issue id and closes the sheet. Fire-and-forget: the sheet
 * doesn't wait for the submit to complete before closing, so the user
 * can immediately return to the call.
 *
 * The parent component handles the actual submission — typically via
 * a handler that captures call diagnostics and POSTs to /api/feedback
 * with category: 'report' and the snapshot in page_context.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {(issueType: string) => void} onSubmit
 */
const ISSUES = [
  { id: 'no_audio', label: "I can't hear them" },
  { id: 'no_video', label: "I can't see them" },
  { id: 'they_cant_hear_me', label: "They can't hear me" },
  { id: 'they_cant_see_me', label: "They can't see me" },
  { id: 'keeps_disconnecting', label: 'Call keeps disconnecting' },
  { id: 'laggy', label: 'Call is laggy or frozen' },
  { id: 'other', label: 'Something else' },
];

export default function ReportIssueSheet({ open, onClose, onSubmit }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 70,
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-issue-title"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 80,
          width: 'min(440px, 92vw)',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: '#FAF7F4',
          borderRadius: '20px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
          padding: '24px',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <h2
          id="report-issue-title"
          style={{
            margin: '0 0 6px',
            fontSize: '18px',
            fontWeight: 700,
            color: '#2C1F15',
          }}
        >
          Something wrong?
        </h2>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#8B7355',
          }}
        >
          Tap what you&apos;re experiencing. We&apos;ll capture the current call
          state so we can debug what went wrong.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ISSUES.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSubmit(issue.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#FFFFFF',
                border: '1px solid #E0D0BE',
                color: '#3D2E22',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F5EDE4';
                e.currentTarget.style.borderColor = '#C4956A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E0D0BE';
              }}
            >
              {issue.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            borderRadius: '12px',
            background: 'transparent',
            border: 'none',
            color: '#8B7355',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
