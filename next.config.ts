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
      { protocol: "https", hostname: "arizonawildcats.com" },
      { protocol: "https", hostname: "arkansasrazorbacks.com" },
      { protocol: "https", hostname: "gopsusports.com" },
      { protocol: "https", hostname: "dbupatriots.com" },
      { protocol: "https", hostname: "miamihurricanes.com" },
      { protocol: "https", hostname: "gamecocksonline.com" },
      { protocol: "https", hostname: "ramblinwreck.com" },
      { protocol: "https", hostname: "ksuowls.com" },
      { protocol: "https", hostname: "fightingirish.com" },
    ],
  },
};
export default nextConfig;
