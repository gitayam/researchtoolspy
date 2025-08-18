/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker production build configuration
  output: 'standalone',
  
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