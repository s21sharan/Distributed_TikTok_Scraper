/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Configure for Docker networking
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  },
}

module.exports = nextConfig 