'use client'

/**
 * Template — re-renders on every navigation within (app)/.
 * Adds a subtle fade-in to smooth page transitions.
 */
export default function AppTemplate({ children }) {
  return (
    <div
      style={{
        animation: 'fadeIn 150ms ease-out',
        minHeight: '60vh',
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
      `}</style>
      {children}
    </div>
  )
}
