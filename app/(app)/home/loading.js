import { fonts } from '@/lib/designTokens'

export default function HomeLoading() {
  return (
    <div style={{ fontFamily: fonts.sans }}>
      {/* Greeting skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ width: '220px', height: '28px', borderRadius: '8px', background: 'rgba(139,111,92,0.08)', marginBottom: '8px' }} />
        <div style={{ width: '160px', height: '16px', borderRadius: '6px', background: 'rgba(139,111,92,0.06)' }} />
      </div>

      {/* Stats row skeleton */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: '72px', borderRadius: '14px', background: 'rgba(139,111,92,0.06)' }} />
        ))}
      </div>

      {/* Upcoming meetups skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ width: '180px', height: '20px', borderRadius: '6px', background: 'rgba(139,111,92,0.08)', marginBottom: '16px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '88px', borderRadius: '14px', background: 'rgba(139,111,92,0.05)', border: '1px solid rgba(139,111,92,0.08)' }} />
          ))}
        </div>
      </div>

      {/* People to meet skeleton */}
      <div>
        <div style={{ width: '160px', height: '20px', borderRadius: '6px', background: 'rgba(139,111,92,0.08)', marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '12px', overflow: 'hidden' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: '160px', height: '200px', borderRadius: '14px', background: 'rgba(139,111,92,0.05)', border: '1px solid rgba(139,111,92,0.08)', flexShrink: 0 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
