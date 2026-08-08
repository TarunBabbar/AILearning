import { defineConfig, env } from "prisma/config";

// Temporary config to reach the Neon prod DB.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("NEON_DATABASE_URL"),
  },
});
