import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env with override so a stray ambient DATABASE_URL (e.g. a global
// Windows env var) does not shadow the project's .env value.
loadEnv({ override: true, path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
