import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["playwright", "playwright-core"],
  // Pin the project root so Next/npm don't get confused by the stray
  // package-lock.json in the parent directory (AILearning/) and treat that
  // as the workspace root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;