/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages configuration
  // Edge Runtime is configured per-route, not globally

  // Output configuration for Cloudflare Pages
  output: 'export',

  // Disable image optimization (handled by Cloudflare)
  images: {
    unoptimized: true,
  },

  // Environment variables for Cloudflare
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.researchtoolspy.com',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://app.researchtoolspy.com',
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
  },

  // Webpack configuration for Cloudflare compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Cloudflare Pages specific optimizations
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        os: false,
        util: false,
        path: false,
      };
    }
    return config;
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects for old routes
  async redirects() {
    return [
      {
        source: '/frameworks',
        destination: '/analysis-frameworks',
        permanent: true,
      },
    ];
  },

  // Disable server-side features for static export
  trailingSlash: true,

  // TypeScript and ESLint
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;