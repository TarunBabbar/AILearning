import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Prefer project .env over a stray Windows/Cursor DATABASE_URL.
loadEnv({ path: ".env", override: true });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
