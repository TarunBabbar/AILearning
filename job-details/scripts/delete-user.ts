// Delete a single user by email from the database configured in .env (DATABASE_URL).
// Usage: npx tsx scripts/delete-user.ts trapti.nagi@gmail.com
import { PrismaClient } from "@prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ override: true });

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/delete-user.ts <email>");
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
  const before = await p.user.count();
  const found = await p.user.findMany({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  console.log(`Total users before: ${before}`);
  console.log(`Target found: ${JSON.stringify(found)}`);

  const del = await p.user.deleteMany({ where: { email } });
  console.log(`Deleted: ${del.count}`);

  const after = await p.user.count();
  const stillExists = await p.user.findUnique({ where: { email } });
  console.log(`Total users after: ${after}`);
  console.log(`Target still exists: ${!!stillExists}`);
  await p.$disconnect();
}

main();
