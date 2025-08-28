/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker production build configuration
  output: 'standalone',
  
  // Disable all static optimization to avoid useSearchParams issues
  distDir: '.next',
  trailingSlash: false,
  poweredByHeader: false,
  
  
  // Disable ESLint during build in Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build in Docker
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Allow Cloudflare tunnel origins for public hosting (strings only, no regex)
  // allowedDevOrigins: [
  //   'mtv-accessibility-loving-mm.trycloudflare.com',
  //   'heading-cutting-decades-ghz.trycloudflare.com',
  // ],
  webpack: (config, { isServer }) => {
    // Ignore pptxgenjs Node.js dependencies in browser builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig