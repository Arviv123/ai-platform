/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production build configuration
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  
  // Image optimization for static export
  images: {
    unoptimized: true
  },
  
  // Enable strict mode for better development
  reactStrictMode: true,
  
  // Temporarily allow build to complete during refactoring
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://nedlan-ai-api.onrender.com',
    NEXT_PUBLIC_APP_NAME: 'נדל"ן AI Platform',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '2.0.0'
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
}

module.exports = nextConfig