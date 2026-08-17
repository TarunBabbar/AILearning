// Create a user account in the database configured in .env (DATABASE_URL).
// Usage: npx tsx scripts/create-user.ts <email> "<name>" <password>
import { PrismaClient } from "@prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { hashPassword } from "../lib/user-auth";

dotenv.config({ override: true });

const email = (process.argv[2] || "").trim().toLowerCase();
const name = (process.argv[3] || "").trim();
const password = process.argv[4] || "";

if (!email || !name || password.length < 6) {
  console.error(
    "Usage: npx tsx scripts/create-user.ts <email> \"<name>\" <password>"
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
const p = new PrismaClient({ adapter });

async function main() {
  const existing = await p.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User already exists: ${email}`);
    await p.$disconnect();
    process.exit(1);
  }
  const user = await p.user.create({
    data: { email, name, passwordHash: hashPassword(password) },
    select: { id: true, email: true, name: true },
  });
  console.log(`Created: ${JSON.stringify(user)}`);
  await p.$disconnect();
}

main();
