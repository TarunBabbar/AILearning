import { config as loadEnv } from "dotenv";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = process.env.PINECONE_API_KEY || "";
  if (!key) throw new Error("PINECONE_API_KEY not set in .env");
  try {
    // Check whoami
    const who = await fetch("https://api.pinecone.io/whoami", {
      headers: { "Api-Key": key },
    });
    console.log("whoami:", who.status, await who.text());

    // List indexes
    const res = await fetch("https://api.pinecone.io/indexes", {
      headers: { "Api-Key": key },
    });
    const data = await res.json();
    console.log("Indexes:", JSON.stringify(data.indexes?.map((i: { name: string }) => i.name)));
  } catch (e) {
    console.error("Error:", e instanceof Error ? e.message : e);
  }
}
main();
