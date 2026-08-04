import fs from "fs";
import path from "path";

// Read the FastAPI server port from the shared api_config.json (single source of truth)
const apiConfigPath = path.join(process.cwd(), "api_config.json");
let apiPort = "8000";
try {
  const apiConfig = JSON.parse(fs.readFileSync(apiConfigPath, "utf-8"));
  if (apiConfig.port) apiPort = String(apiConfig.port);
} catch {
  // fall back to default only if the config file is missing
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://127.0.0.1:${apiPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
