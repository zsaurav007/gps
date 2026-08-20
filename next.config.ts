import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', 
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // Required for multi-threading with external assets
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin', // Required to enable SharedArrayBuffer
          },
        ],
      },
    ];
  },
};

export default nextConfig;