import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: '/media/thumbs/:file*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.xvideos-cdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.xvideos.com',
      },
      {
        protocol: 'https',
        hostname: '*.pornhub.com',
      },
      {
        protocol: 'https',
        hostname: '*.phncdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.redtube.com',
      },
      {
        protocol: 'https',
        hostname: '*.youporn.com',
      },
      {
        protocol: 'https',
        hostname: '*.xhamster.com',
      },
      {
        protocol: 'https',
        hostname: '*.youtube.com',
      },
      {
        protocol: 'https',
        hostname: '*.ytimg.com',
      },
    ],
  },
}

export default nextConfig
