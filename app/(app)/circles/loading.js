export default function CirclesLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ width: '140px', height: '24px', borderRadius: '8px', background: 'rgba(139,111,92,0.08)' }} />
        <div style={{ width: '100px', height: '36px', borderRadius: '18px', background: 'rgba(139,111,92,0.06)' }} />
      </div>
      {/* Circle cards skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '140px', borderRadius: '14px', background: 'rgba(139,111,92,0.05)', border: '1px solid rgba(139,111,92,0.08)' }} />
        ))}
      </div>
    </div>
  )
}
