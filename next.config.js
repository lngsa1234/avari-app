/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Disable redirects in development
    if (process.env.NODE_ENV === 'development') {
      return []
    }
    return []
  },
  async headers() {
    return [
      {
        // Cache Supabase Storage images aggressively in the browser
        source: '/:path*',
        has: [{ type: 'header', key: 'referer' }],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
