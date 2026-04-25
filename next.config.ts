import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/weekly', destination: '/history', permanent: false },
      { source: '/monthly', destination: '/history', permanent: false },
    ];
  },
};

export default nextConfig;
