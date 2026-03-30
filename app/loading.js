export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FDF8F3',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Nav skeleton */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(139, 111, 92, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EDE6DF', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ width: '100px', height: '20px', borderRadius: '6px', background: '#EDE6DF', animation: 'shimmer 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '160px', height: '38px', borderRadius: '20px', background: '#EDE6DF', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#EDE6DF', animation: 'shimmer 1.5s infinite' }} />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '8px' }}>
        {[80, 70, 60, 60].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: '36px', borderRadius: '20px', background: i === 0 ? '#D4C4B0' : '#EDE6DF', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>

      {/* Content skeleton */}
      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        {/* Title */}
        <div style={{ width: '260px', height: '32px', borderRadius: '8px', background: '#EDE6DF', marginBottom: '8px', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ width: '180px', height: '16px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '32px', animation: 'shimmer 1.5s infinite', animationDelay: '0.1s' }} />

        {/* Card skeletons */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.7)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '12px',
            border: '1px solid rgba(139, 111, 92, 0.08)',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            animation: 'shimmer 1.5s infinite',
            animationDelay: `${i * 0.15}s`,
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EDE6DF', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: '60%', height: '16px', borderRadius: '6px', background: '#EDE6DF', marginBottom: '8px' }} />
              <div style={{ width: '40%', height: '12px', borderRadius: '4px', background: '#F5EDE4' }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
