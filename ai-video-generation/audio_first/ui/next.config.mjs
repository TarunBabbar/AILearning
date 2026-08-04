import fs from "fs";
import path from "path";

const apiPort = "8001";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `http://127.0.0.1:${apiPort}/api/:path*` },
    ];
  },
};

export default nextConfig;
