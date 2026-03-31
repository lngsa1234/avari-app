export default function CoffeeLoading() {
  return (
    <div>
      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ width: '120px', height: '36px', borderRadius: '18px', background: 'rgba(139,111,92,0.06)' }} />
        ))}
      </div>
      {/* Event cards skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '120px', borderRadius: '14px', background: 'rgba(139,111,92,0.05)', border: '1px solid rgba(139,111,92,0.08)' }} />
        ))}
      </div>
    </div>
  )
}
