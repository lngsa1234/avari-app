/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Disable redirects in development
    if (process.env.NODE_ENV === 'development') {
      return []
    }
    return []
  }
}

module.exports = nextConfig
