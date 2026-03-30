export default function RecapsLoading() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FDF8F3', padding: '32px 24px', maxWidth: '896px', margin: '0 auto' }}>
      <div style={{ width: '200px', height: '32px', borderRadius: '8px', background: '#EDE6DF', marginBottom: '8px', animation: 'shimmer 1.5s infinite' }} />
      <div style={{ width: '280px', height: '14px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '32px', animation: 'shimmer 1.5s infinite' }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: '80px', borderRadius: '16px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(139,111,92,0.08)', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[60, 90, 110].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: '36px', borderRadius: '20px', background: '#EDE6DF', animation: 'shimmer 1.5s infinite' }} />
        ))}
      </div>

      {/* Recap card skeleton */}
      <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(139,111,92,0.08)', animation: 'shimmer 1.5s infinite' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#EDE6DF' }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '200px', height: '18px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '8px' }} />
            <div style={{ width: '150px', height: '12px', borderRadius: '4px', background: '#F5EDE4' }} />
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
    </div>
  )
}
