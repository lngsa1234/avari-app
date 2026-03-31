export default function DiscoverLoading() {
  return (
    <div>
      {/* Search bar skeleton */}
      <div style={{ width: '100%', height: '44px', borderRadius: '22px', background: 'rgba(139,111,92,0.06)', marginBottom: '24px' }} />
      {/* Filter chips skeleton */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: '80px', height: '32px', borderRadius: '16px', background: 'rgba(139,111,92,0.06)' }} />
        ))}
      </div>
      {/* Cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ height: '200px', borderRadius: '14px', background: 'rgba(139,111,92,0.05)', border: '1px solid rgba(139,111,92,0.08)' }} />
        ))}
      </div>
    </div>
  )
}
