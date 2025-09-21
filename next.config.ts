import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'nimet.gov.ng',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },


  async headers() {
    return [
      {
        source: "/(.*)", // Apply to all routes
        headers: [
          { key: "X-Forwarded-Proto", value: "https" },
          { key: "X-Forwarded-Host", value: "sadis.nimet.gov.ng" },
        ],
      },
    ];
  },
};

export default nextConfig;
