import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";

// Load .env with override so a stray ambient variable of the same name
// (e.g. OPENROUTER_API_KEY set in the OS environment) does NOT shadow the
// .env value. Next.js's own .env loading never overrides existing vars.
loadEnv({ override: true, path: ".env" });

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
