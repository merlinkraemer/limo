import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Allow cross-origin requests in development
  async headers() {
    return [
      {
        source: '/_next',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
