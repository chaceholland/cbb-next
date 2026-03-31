import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dtnozcqkuzhjmjvsfjqk.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.sidearmdev.com",
      },
      {
        protocol: "https",
        hostname: "dxbhsrqyrr690.cloudfront.net",
      },
    ],
  },
};
export default nextConfig;
