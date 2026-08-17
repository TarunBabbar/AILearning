// Check if a user exists in the DB configured in .env (read-only).
// Usage: npx tsx scripts/check-user.ts <email>
import { PrismaClient } from "@prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ override: true });

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/check-user.ts <email>");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const p = new PrismaClient({ adapter });

async function main() {
  const user = await p.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  console.log(user ? `EXISTS: ${JSON.stringify(user)}` : "NOT FOUND");
  await p.$disconnect();
}

main();
