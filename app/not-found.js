import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FDF8F3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '72px', fontWeight: '700', color: '#3F1906', fontFamily: '"Lora", Georgia, serif' }}>
          404
        </div>
        <p style={{ fontSize: '18px', color: '#8B6F5C', marginTop: '8px', marginBottom: '32px' }}>
          This page could not be found.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            background: '#8B6F5C',
            color: '#FAF7F4',
            borderRadius: '12px',
            textDecoration: 'none',
            fontSize: '15px',
            fontWeight: '600',
            transition: 'background 0.15s',
          }}
        >
          Back to Home
        </Link>
        <p style={{ marginTop: '48px', fontSize: '14px', color: '#B8A089', fontStyle: 'italic', fontFamily: '"Lora", Georgia, serif' }}>
          Find your circle. Move forward.
        </p>
      </div>
    </div>
  )
}
