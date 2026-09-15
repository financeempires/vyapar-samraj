import type { NextConfig } from 'next'

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8085'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  experimental: {},
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
