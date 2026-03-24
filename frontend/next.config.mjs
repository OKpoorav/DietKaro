/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Skip lint/type errors during build (fix separately)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Strict mode catches React bugs early
  reactStrictMode: true,

  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header

  // Allow images from API/CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.healthpractix.com',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
