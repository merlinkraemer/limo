import type { NextConfig } from "next";
import { buildRemotePatterns } from "./src/lib/image-hosts";

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    // Compressed derivatives instead of the multi-MB camera originals.
    formats: ['image/avif', 'image/webp'],
    // Local development serves Storage (and the seeded sample photos) over
    // loopback/seed hosts; production stays closed to those.
    dangerouslyAllowLocalIP: !isProduction,
    remotePatterns: buildRemotePatterns(
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      },
      { allowDevSeedImages: !isProduction }
    ),
  },
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
