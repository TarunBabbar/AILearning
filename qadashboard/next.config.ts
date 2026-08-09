import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Prefer project .env over a stray Windows/Cursor DATABASE_URL (e.g. file:./prisma/dev.db).
loadEnv({ path: ".env", override: true });

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
