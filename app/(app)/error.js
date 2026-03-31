'use client'

import { fonts } from '@/lib/designTokens'

/**
 * Shared error boundary for all authenticated routes.
 * Catches render errors and provides a retry button.
 */
export default function AuthenticatedError({ error, reset }) {
  return (
    <div style={{
      minHeight: '50vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: fonts.sans,
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#3D2B1F',
          marginBottom: '8px',
          fontFamily: fonts.serif,
        }}>
          Something went wrong
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#7A6855',
          marginBottom: '24px',
          lineHeight: '1.5',
        }}>
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            background: '#5C4033',
            color: '#FAF5EF',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            cursor: 'pointer',
            fontFamily: fonts.sans,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
