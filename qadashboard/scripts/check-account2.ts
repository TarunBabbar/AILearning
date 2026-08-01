import { config as loadEnv } from "dotenv";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = process.env.PINECONE_API_KEY || "";
  if (!key) throw new Error("PINECONE_API_KEY not set in .env");
  try {
    const res = await fetch("https://api.pinecone.io/indexes", {
      headers: { "Api-Key": key },
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.slice(0, 2000));
  } catch (e) {
    console.error("Error:", e instanceof Error ? e.message : e);
  }
}
main();
