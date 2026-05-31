import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/user",
        destination: "/",
      },
    ];
  },
};

export default nextConfig;
