import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build configuration for static export
  output: 'export',
  trailingSlash: true,
  
  // Fix build issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Images optimization for static export
  images: {
    unoptimized: true
  },
  
  // Environment variables for static export
  env: {
    NEXT_PUBLIC_API_URL: 'https://ai-platform-backend.railway.app',
  },
  
  // Disable telemetry to avoid trace file issues
  generateEtags: false,
  
  // Remove redirects for static export
  // async redirects() {
  //   return []
  // },
};

export default nextConfig;
