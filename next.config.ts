import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dtnozcqkuzhjmjvsfjqk.supabase.co' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'images.sidearmdev.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'd1baseball.com' },
    ],
  },
};
export default nextConfig;
